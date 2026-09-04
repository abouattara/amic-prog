'use server'

import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { createModuleCore, updateModuleCore, deleteModuleCore, moveModuleCore } from './module-core'
import type { ActionResult } from '@/types'

function role(session: Awaited<ReturnType<typeof auth>>): string {
  return session?.user?.role ?? ''
}

export async function createModuleAction(
  courseId: string,
  title: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Non autorisé.' }
  const result = await createModuleCore(role(session), courseId, title)
  if (result.success) revalidatePath(`/admin/formations/${courseId}`)
  return result
}

export async function updateModuleAction(
  moduleId: string,
  courseId: string,
  title: string,
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Non autorisé.' }
  const result = await updateModuleCore(role(session), moduleId, title)
  if (result.success) revalidatePath(`/admin/formations/${courseId}`)
  return result
}

export async function deleteModuleAction(moduleId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Non autorisé.' }
  const result = await deleteModuleCore(role(session), moduleId)
  if (result.success && result.data) revalidatePath(`/admin/formations/${result.data.courseId}`)
  return { success: result.success, error: result.error }
}

export async function moveModuleAction(
  moduleId: string,
  direction: 'up' | 'down',
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Non autorisé.' }
  const result = await moveModuleCore(role(session), moduleId, direction)
  if (result.success && result.data) revalidatePath(`/admin/formations/${result.data.courseId}`)
  return { success: result.success, error: result.error }
}
