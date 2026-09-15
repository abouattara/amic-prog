'use server'

import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { createLessonCore, updateLessonCore, deleteLessonCore, moveLessonCore } from './lesson-core'
import type { LessonInput } from './lesson-core'
import type { ActionResult } from '@/types'
import type { Session } from 'next-auth'

export type { LessonInput }

function role(session: Session | null): string {
  return session?.user?.role ?? ''
}

export async function createLessonAction(
  moduleId: string,
  input: LessonInput,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Non autorisé.' }
  const result = await createLessonCore(role(session), moduleId, input)
  if (result.success && result.data) revalidatePath(`/admin/formations/${result.data.courseId}`)
  return { success: result.success, error: result.error, data: result.data ? { id: result.data.id } : undefined }
}

export async function updateLessonAction(
  lessonId: string,
  input: LessonInput,
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Non autorisé.' }
  const result = await updateLessonCore(role(session), lessonId, input)
  if (result.success && result.data) revalidatePath(`/admin/formations/${result.data.courseId}`)
  return { success: result.success, error: result.error }
}

export async function deleteLessonAction(lessonId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Non autorisé.' }
  const result = await deleteLessonCore(role(session), lessonId)
  if (result.success && result.data) revalidatePath(`/admin/formations/${result.data.courseId}`)
  return { success: result.success, error: result.error }
}

export async function moveLessonAction(
  lessonId: string,
  direction: 'up' | 'down',
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Non autorisé.' }
  const result = await moveLessonCore(role(session), lessonId, direction)
  if (result.success && result.data) revalidatePath(`/admin/formations/${result.data.courseId}`)
  return { success: result.success, error: result.error }
}
