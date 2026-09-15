/**
 * Script de test manuel pour l'envoi d'email (SMTP ou Resend).
 * Usage : npx tsx scripts/send-test-email.ts <adresse@email.com> [event]
 * Exemple : npx tsx scripts/send-test-email.ts admin@exemple.com QUIZ_PASSED
 *
 * Charge automatiquement .env.local depuis la racine du projet.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Charge .env.local avant tout autre import ─────────────────────────────────
function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const raw = trimmed.slice(eqIdx + 1).trim()
      const val = raw.replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    console.warn('[send-test-email] .env.local introuvable — variables d\'env attendues dans l\'environnement.')
  }
}
loadEnvLocal()

// ── Imports après chargement des variables ────────────────────────────────────
import { buildEmailContent } from '../src/services/email-templates'
import type { SendNotificationParams } from '../src/services/notification-provider'
import type { NotificationEvent } from '@prisma/client'

const to = process.argv[2]
const eventArg = (process.argv[3] ?? 'QUIZ_PASSED') as NotificationEvent

if (!to) {
  console.error('Usage: npx tsx scripts/send-test-email.ts <adresse@email.com> [event]')
  process.exit(1)
}

const providerType = process.env.EMAIL_PROVIDER || 'mock'
const emailFrom = process.env.EMAIL_FROM ?? process.env.EMAIL_SMTP_USER ?? 'no-reply@localhost'

const testParams: SendNotificationParams = {
  userId: 'test-script',
  event: eventArg,
  title: `[TEST] Notification ${eventArg}`,
  body: `Ceci est un email de test pour l'événement ${eventArg}, envoyé depuis le script send-test-email.`,
}

const { subject, html } = buildEmailContent(testParams)

console.log(`[send-test-email] Provider: ${providerType}`)
console.log(`[send-test-email] Envoi de "${subject}" → ${to}`)

async function main() {
  if (providerType === 'smtp') {
    const user = process.env.EMAIL_SMTP_USER ?? ''
    const pass = process.env.EMAIL_SMTP_PASS ?? ''
    const host = process.env.EMAIL_SMTP_HOST ?? 'smtp.gmail.com'
    const port = parseInt(process.env.EMAIL_SMTP_PORT ?? '587', 10)

    if (!user || !pass) {
      console.error('[send-test-email] EMAIL_SMTP_USER ou EMAIL_SMTP_PASS absent dans .env.local')
      process.exit(1)
    }

    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })

    console.log(`[send-test-email] SMTP: ${host}:${port} | from: ${emailFrom}`)

    const info = await transporter.sendMail({ from: emailFrom, to, subject, html })
    console.log(`[send-test-email] Email envoyé. messageId: ${info.messageId}`)

  } else if (providerType === 'resend') {
    const apiKey = process.env.EMAIL_API_KEY ?? ''
    if (!apiKey) {
      console.error('[send-test-email] EMAIL_API_KEY absent dans .env.local')
      process.exit(1)
    }

    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({ from: emailFrom, to, subject, html })

    if (error) {
      console.error('[send-test-email] Echec Resend :', error)
      process.exit(1)
    }
    console.log(`[send-test-email] Email envoyé. ID Resend: ${data?.id}`)

  } else {
    console.error(`[send-test-email] EMAIL_PROVIDER="${providerType}" ne permet pas d'envoi réel.`)
    console.error('Changez EMAIL_PROVIDER en "smtp" ou "resend" dans .env.local pour tester.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[send-test-email] Erreur inattendue :', err)
  process.exit(1)
})
