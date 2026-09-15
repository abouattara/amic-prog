import { NotificationEvent } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildEmailContent } from './email-templates'

export interface SendNotificationParams {
  userId: string
  event: NotificationEvent
  title: string
  body: string
  sourceId?: string             // transmis au record Notification pour idempotence
  email?: string
  metadata?: Record<string, string>
}

export interface INotificationProvider {
  send(params: SendNotificationParams): Promise<void>
}

// ── Resend client interface (pour l'injection et les tests) ──────────────────
interface ResendEmailOptions {
  from: string
  to: string
  subject: string
  html: string
}

interface ResendClient {
  emails: {
    send(opts: ResendEmailOptions): Promise<{ data?: { id: string } | null; error?: unknown }>
  }
}

// ── SMTP transporter interface (pour l'injection et les tests) ───────────────
interface SmtpMailOptions {
  from: string
  to: string
  subject: string
  html: string
}

interface SmtpTransporter {
  sendMail(options: SmtpMailOptions): Promise<{ messageId?: string }>
}

// ── Mock provider ────────────────────────────────────────────────────────────
export class MockNotificationProvider implements INotificationProvider {
  async send(params: SendNotificationParams): Promise<void> {
    console.log(`[Notification:mock] ${params.event} → user:${params.userId} | ${params.title}`)
    await prisma.notification.create({
      data: {
        userId: params.userId,
        event: params.event,
        title: params.title,
        body: params.body,
        sourceId: params.sourceId,
      },
    })
  }
}

// ── Resend email provider ────────────────────────────────────────────────────
export class ResendEmailProvider implements INotificationProvider {
  private readonly from: string

  constructor(private readonly client: ResendClient) {
    this.from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
  }

  async send(params: SendNotificationParams): Promise<void> {
    // 1. Persistance en DB — action principale, jamais bloquée par l'email
    await prisma.notification.create({
      data: {
        userId: params.userId,
        event: params.event,
        title: params.title,
        body: params.body,
        sourceId: params.sourceId,
      },
    })

    // 2. Récupération de l'adresse email (param ou DB)
    let to = params.email
    if (!to) {
      const user = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { email: true },
      })
      to = user?.email ?? undefined
    }

    if (!to) {
      console.warn(`[Notification:resend] email introuvable pour user:${params.userId} — pas d'envoi email`)
      return
    }

    // 3. Envoi email — isolé, l'échec ne remonte jamais
    try {
      const { subject, html } = buildEmailContent(params)
      const { error } = await this.client.emails.send({ from: this.from, to, subject, html })
      if (error) {
        console.error(`[Notification:resend] échec envoi (${params.event}) → ${to}:`, error)
      } else {
        console.log(`[Notification:resend] email envoyé (${params.event}) → ${to}`)
      }
    } catch (err) {
      console.error(`[Notification:resend] exception lors de l'envoi (${params.event}):`, err)
    }
  }
}

// ── SMTP email provider ──────────────────────────────────────────────────────
export class SmtpEmailProvider implements INotificationProvider {
  private readonly from: string

  constructor(private readonly transporter: SmtpTransporter) {
    this.from = process.env.EMAIL_FROM ?? process.env.EMAIL_SMTP_USER ?? 'no-reply@localhost'
  }

  async send(params: SendNotificationParams): Promise<void> {
    // 1. Persistance en DB — action principale, jamais bloquée par l'email
    await prisma.notification.create({
      data: {
        userId: params.userId,
        event: params.event,
        title: params.title,
        body: params.body,
        sourceId: params.sourceId,
      },
    })

    // 2. Récupération de l'adresse email (param ou DB)
    let to = params.email
    if (!to) {
      const user = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { email: true },
      })
      to = user?.email ?? undefined
    }

    if (!to) {
      console.warn(`[Notification:smtp] email introuvable pour user:${params.userId} — pas d'envoi email`)
      return
    }

    // 3. Envoi email — isolé, l'échec ne remonte jamais
    try {
      const { subject, html } = buildEmailContent(params)
      const info = await this.transporter.sendMail({ from: this.from, to, subject, html })
      console.log(`[Notification:smtp] email envoyé (${params.event}) → ${to} | messageId: ${info.messageId}`)
    } catch (err) {
      console.error(`[Notification:smtp] exception lors de l'envoi (${params.event}):`, err)
    }
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────
export function createNotificationProvider(): INotificationProvider {
  const provider = process.env.EMAIL_PROVIDER || 'mock'

  if (provider === 'smtp') {
    const user = process.env.EMAIL_SMTP_USER ?? ''
    const pass = process.env.EMAIL_SMTP_PASS ?? ''
    if (!user || !pass) {
      console.warn('[NotificationProvider] EMAIL_PROVIDER=smtp mais EMAIL_SMTP_USER/EMAIL_SMTP_PASS absent — fallback sur mock')
      return new MockNotificationProvider()
    }
    const host = process.env.EMAIL_SMTP_HOST ?? 'smtp.gmail.com'
    const port = parseInt(process.env.EMAIL_SMTP_PORT ?? '587', 10)
    const { createTransport } = require('nodemailer') as typeof import('nodemailer')
    const transporter = createTransport({ host, port, secure: port === 465, auth: { user, pass } })
    return new SmtpEmailProvider(transporter)
  }

  if (provider === 'resend') {
    const apiKey = process.env.EMAIL_API_KEY ?? ''
    if (!apiKey) {
      console.warn('[NotificationProvider] EMAIL_PROVIDER=resend mais EMAIL_API_KEY absent — fallback sur mock')
      return new MockNotificationProvider()
    }
    const { Resend } = require('resend') as typeof import('resend')
    return new ResendEmailProvider(new Resend(apiKey))
  }

  if (provider !== 'mock') {
    console.warn(`[NotificationProvider] EMAIL_PROVIDER inconnu "${provider}" — fallback sur mock`)
  }

  return new MockNotificationProvider()
}

export const notificationProvider = createNotificationProvider()
