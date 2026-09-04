/**
 * Script de test manuel pour l'envoi d'email via Resend.
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
      // Retire les guillemets éventuels
      const val = raw.replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    console.warn('[send-test-email] .env.local introuvable — variables d\'env attendues dans l\'environnement.')
  }
}
loadEnvLocal()

// ── Imports après chargement des variables ────────────────────────────────────
import { Resend } from 'resend'
import { buildEmailContent } from '../src/services/email-templates'
import type { SendNotificationParams } from '../src/services/notification-provider'
import type { NotificationEvent } from '@prisma/client'

const to = process.argv[2]
const eventArg = (process.argv[3] ?? 'QUIZ_PASSED') as NotificationEvent

if (!to) {
  console.error('Usage: npx tsx scripts/send-test-email.ts <adresse@email.com> [event]')
  process.exit(1)
}

const apiKey = process.env.EMAIL_API_KEY ?? ''
const from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'

if (!apiKey) {
  console.error('[send-test-email] EMAIL_API_KEY absent — impossible d\'envoyer via Resend.')
  process.exit(1)
}

const testParams: SendNotificationParams = {
  userId: 'test-script',
  event: eventArg,
  title: `[TEST] Notification ${eventArg}`,
  body: `Ceci est un email de test pour l'événement ${eventArg}, envoyé depuis le script send-test-email.`,
}

const { subject, html } = buildEmailContent(testParams)

console.log(`[send-test-email] Envoi de "${subject}" → ${to}`)
console.log(`[send-test-email] From: ${from} | Provider: Resend`)

async function main() {
  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send({ from, to, subject, html })

  if (error) {
    console.error('[send-test-email] Echec :', error)
    process.exit(1)
  } else {
    console.log(`[send-test-email] Email envoyé. ID Resend : ${data?.id}`)
  }
}

main().catch((err) => {
  console.error('[send-test-email] Erreur inattendue :', err)
  process.exit(1)
})
