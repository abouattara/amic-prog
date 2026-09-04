'use server'

import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { markLessonCompleteCore } from './core'
import type { ActionResult } from '@/types'

export async function markLessonComplete(lessonId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Non authentifié.' }

  const result = await markLessonCompleteCore(session.user.id, lessonId)

  if (result.success) {
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/formations')
  }

  return result
}

export { markLessonCompleteCore }
