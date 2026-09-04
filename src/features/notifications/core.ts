import { prisma } from '@/lib/prisma'
import { notificationProvider } from '@/services/notification-provider'
import type { NotificationEvent } from '@prisma/client'
import type { ActionResult } from '@/types'

export interface NotificationParams {
  userId: string
  event: NotificationEvent
  title: string
  body: string
  /**
   * ID de la ressource déclencheuse (quizId, courseId…).
   * Quand fourni, garantit l'idempotence : si une notification
   * (userId, event, sourceId) existe déjà, la création est ignorée.
   */
  sourceId?: string
}

/**
 * Crée une notification via le provider avec déduplication par (userId, event, sourceId).
 * Lève une exception en cas d'erreur — l'appelant doit entourer d'un try/catch isolé.
 */
export async function sendNotificationSafe(params: NotificationParams): Promise<void> {
  if (params.sourceId) {
    const exists = await prisma.notification.findFirst({
      where: { userId: params.userId, event: params.event, sourceId: params.sourceId },
      select: { id: true },
    })
    if (exists) return
  }
  await notificationProvider.send(params)
}

/**
 * Envoie une notification NEW_COURSE à tous les apprenants actifs de la plateforme.
 * Idempotente : sourceId = courseId, évite les doublons si la formation est
 * dépubliée puis republiée.
 */
export async function notifyNewCourse(courseId: string, courseTitle: string): Promise<void> {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT', isActive: true },
    select: { id: true },
  })
  await Promise.all(
    students.map((s) =>
      sendNotificationSafe({
        userId: s.id,
        event: 'NEW_COURSE',
        title: 'Nouvelle formation disponible !',
        body: `La formation « ${courseTitle} » vient d'être publiée. Découvrez-la dès maintenant.`,
        sourceId: courseId,
      }).catch((err) => console.error(`[Notification:NEW_COURSE] userId=${s.id}`, err)),
    ),
  )
}

/**
 * Marque une notification comme lue. Vérifie que la notification appartient bien
 * à l'utilisateur connecté. Idempotent (readAt conservé si déjà lu).
 */
export async function markNotificationAsReadCore(
  userId: string,
  notificationId: string,
): Promise<ActionResult> {
  const notif = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { userId: true, read: true },
  })
  if (!notif) return { success: false, error: 'Notification introuvable.' }
  if (notif.userId !== userId) return { success: false, error: 'Non autorisé.' }
  if (notif.read) return { success: true } // déjà lue — idempotent

  await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true, readAt: new Date() },
  })
  return { success: true }
}
