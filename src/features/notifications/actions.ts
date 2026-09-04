'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { markNotificationAsReadCore } from './core'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'

export async function markNotificationAsReadAction(notificationId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Non authentifié.' }

  const result = await markNotificationAsReadCore(session.user.id, notificationId)
  if (result.success) revalidatePath('/dashboard/notifications')
  return result
}

export async function markAllNotificationsAsReadAction(): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Non authentifié.' }

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true, readAt: new Date() },
  })
  revalidatePath('/dashboard/notifications')
  return { success: true }
}
