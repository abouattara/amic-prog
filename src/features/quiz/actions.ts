'use server'

import { auth } from '@/lib/auth'
import { submitQuizAttemptCore } from './core'
import type { QuizAnswerInput, QuizAttemptResult } from './core'
import type { ActionResult } from '@/types'

export type { QuizAnswerInput, QuizAttemptResult }

export async function submitQuizAttemptAction(
  quizId: string,
  answers: QuizAnswerInput[],
): Promise<ActionResult<QuizAttemptResult>> {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Non authentifié.' }

  return submitQuizAttemptCore(session.user.id, quizId, answers)
}
