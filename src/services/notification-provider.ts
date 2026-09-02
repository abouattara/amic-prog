import { NotificationEvent } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface SendNotificationParams {
  userId: string
  event: NotificationEvent
  title: string
  body: string
  email?: string
  metadata?: Record<string, string>
}

export interface INotificationProvider {
  send(params: SendNotificationParams): Promise<void>
}

// ── Mock provider ────────────────────────────────────────────────────────────
class MockNotificationProvider implements INotificationProvider {
  async send(params: SendNotificationParams): Promise<void> {
    console.log(`[Notification:mock] ${params.event} → user:${params.userId} | ${params.title}`)
    // Always persist in-app notification
    await prisma.notification.create({
      data: {
        userId: params.userId,
        event: params.event,
        title: params.title,
        body: params.body,
      },
    })
  }
}

function createNotificationProvider(): INotificationProvider {
  const provider = process.env.EMAIL_PROVIDER ?? 'mock'
  if (provider === 'mock') return new MockNotificationProvider()
  // Future: Resend / SMTP provider
  throw new Error(`Unknown EMAIL_PROVIDER: ${provider}`)
}

export const notificationProvider = createNotificationProvider()
