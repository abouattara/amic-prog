import { prisma } from '@/lib/prisma'
import type { ActionResult } from '@/types'
import { sendNotificationSafe } from '@/features/notifications/core'

export type QuizAnswerInput = {
  questionId: string
  optionIds?: string[]  // MCQ, MULTIPLE_CHOICE, TRUE_FALSE
  answerText?: string   // SHORT_ANSWER
}

export type QuizAttemptResult = {
  attemptId: string
  score: number         // 0–100 entier
  passed: boolean
  passingScore: number
  pointsEarned: number
  pointsTotal: number
  attemptsUsed: number
  maxAttempts: number
  details: {
    questionId: string
    correct: boolean
    points: number
    explanation: string | null
    correctOptionIds: string[]  // pour affichage post-submission
  }[]
}

async function onQuizPassed(userId: string, courseId: string, quizId: string): Promise<void> {
  const { checkAndIssueCertificate } = await import('@/features/certificates/core')
  await checkAndIssueCertificate(userId, courseId)

  // Notification QUIZ_PASSED — try/catch isolé : un échec ne bloque pas la soumission
  try {
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { title: true } })
    await sendNotificationSafe({
      userId,
      event: 'QUIZ_PASSED',
      title: 'Quiz réussi !',
      body: `Vous avez réussi le quiz « ${quiz?.title ?? 'inconnu'} ». Continuez comme ça !`,
      sourceId: quizId,
    })
  } catch (err) {
    console.error('[Notification:QUIZ_PASSED]', err)
  }
}

/**
 * Logique principale — sans dépendances Next.js, testable directement.
 *
 * Choix tentatives multiples :
 *   - Autorisé jusqu'à quiz.maxAttempts (valeur du schéma, défaut 3).
 *   - Si déjà réussi → bloqué (inutile de retenter, score meilleur que seuil déjà atteint).
 *   - Si maxAttempts épuisé sans réussite → bloqué.
 *   - Toutes les tentatives sont conservées ; hasPassedQuiz cherche ANY attempt.passed = true.
 */
export async function submitQuizAttemptCore(
  userId: string,
  quizId: string,
  answers: QuizAnswerInput[],
): Promise<ActionResult<QuizAttemptResult>> {
  // 1. Charger le quiz complet (questions + options avec isCorrect côté serveur uniquement)
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { position: 'asc' },
        include: { options: { orderBy: { position: 'asc' } } },
      },
    },
  })
  if (!quiz) return { success: false, error: 'Quiz introuvable.' }

  // 2. Vérifier l'enrollment
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: quiz.courseId } },
    select: { id: true },
  })
  if (!enrollment) return { success: false, error: 'FORBIDDEN' }

  // 3. Vérifier limite de tentatives
  const existingAttempts = await prisma.quizAttempt.findMany({
    where: { userId, quizId },
    select: { id: true, passed: true },
    orderBy: { startedAt: 'desc' },
  })

  if (existingAttempts.some((a) => a.passed)) {
    return { success: false, error: 'Vous avez déjà réussi ce quiz.' }
  }
  if (existingAttempts.length >= quiz.maxAttempts) {
    return {
      success: false,
      error: `Nombre maximum de tentatives atteint (${quiz.maxAttempts}).`,
    }
  }

  // 4. Créer la tentative (score provisoire 0)
  const attempt = await prisma.quizAttempt.create({
    data: { userId, quizId, score: 0, passed: false },
  })

  // 5. Corriger chaque question côté serveur
  const answerMap = new Map(answers.map((a) => [a.questionId, a]))
  let pointsEarned = 0
  let pointsTotal = 0

  const details: QuizAttemptResult['details'] = []
  const quizAnswerRows: {
    attemptId: string
    questionId: string
    answerText: string | null
    isCorrect: boolean
  }[] = []

  for (const question of quiz.questions) {
    const input = answerMap.get(question.id)
    const pts = question.points
    pointsTotal += pts

    const correctOptions = question.options.filter((o) => o.isCorrect)
    const correctIds = new Set(correctOptions.map((o) => o.id))
    let isCorrect = false
    let storedText: string | null = null

    switch (question.type) {
      case 'MCQ':
      case 'TRUE_FALSE': {
        const selected = input?.optionIds?.[0] ?? null
        isCorrect = !!selected && correctIds.has(selected)
        storedText = selected
        break
      }
      case 'MULTIPLE_CHOICE': {
        const selected = new Set(input?.optionIds ?? [])
        // Correct ssi l'ensemble sélectionné == ensemble correct exactement
        isCorrect =
          selected.size === correctIds.size && [...selected].every((id) => correctIds.has(id))
        storedText = [...selected].join(',') || null
        break
      }
      case 'SHORT_ANSWER': {
        const text = (input?.answerText ?? '').trim().toLowerCase()
        const acceptedTexts = correctOptions.map((o) => o.text.trim().toLowerCase())
        isCorrect = acceptedTexts.length > 0 && acceptedTexts.includes(text)
        storedText = input?.answerText ?? null
        break
      }
    }

    if (isCorrect) pointsEarned += pts

    quizAnswerRows.push({
      attemptId: attempt.id,
      questionId: question.id,
      answerText: storedText,
      isCorrect,
    })

    details.push({
      questionId: question.id,
      correct: isCorrect,
      points: pts,
      explanation: question.explanation ?? null,
      correctOptionIds: correctOptions.map((o) => o.id),
    })
  }

  // 6. Score et seuil
  const score = pointsTotal > 0 ? Math.round((pointsEarned / pointsTotal) * 100) : 0
  const passed = score >= quiz.passingScore

  // 7. Persister réponses + mettre à jour la tentative
  await prisma.quizAnswer.createMany({ data: quizAnswerRows })
  await prisma.quizAttempt.update({
    where: { id: attempt.id },
    data: { score, passed, completedAt: new Date() },
  })

  // 8. Déclencher le hook si réussi
  if (passed) {
    await onQuizPassed(userId, quiz.courseId, quizId)
  }

  return {
    success: true,
    data: {
      attemptId: attempt.id,
      score,
      passed,
      passingScore: quiz.passingScore,
      pointsEarned,
      pointsTotal,
      attemptsUsed: existingAttempts.length + 1,
      maxAttempts: quiz.maxAttempts,
      details,
    },
  }
}

/** Vrai si tous les quiz du cours ont été réussis (ou s'il n'y a pas de quiz). */
export async function hasPassedQuiz(userId: string, courseId: string): Promise<boolean> {
  const quizzes = await prisma.quiz.findMany({ where: { courseId }, select: { id: true } })
  if (quizzes.length === 0) return true

  for (const quiz of quizzes) {
    const passed = await prisma.quizAttempt.findFirst({
      where: { userId, quizId: quiz.id, passed: true },
      select: { id: true },
    })
    if (!passed) return false
  }
  return true
}

/** Résumé des tentatives passées pour affichage UI. */
export async function getQuizAttemptSummary(userId: string, quizId: string) {
  return prisma.quizAttempt.findMany({
    where: { userId, quizId },
    orderBy: { startedAt: 'desc' },
    select: { id: true, score: true, passed: true, completedAt: true, startedAt: true },
  })
}
