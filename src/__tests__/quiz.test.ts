/**
 * Tests d'intégration pour submitQuizAttemptCore.
 * Nécessite la DB en cours d'exécution : npm run db:start
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { submitQuizAttemptCore, hasPassedQuiz } from '@/features/quiz/core'
import { prisma } from '@/lib/prisma'

const P = `quiz_${Date.now()}`

describe('submitQuizAttemptCore', () => {
  let userId: string
  let alienUserId: string
  let courseId: string
  let quizId: string
  let q1Id: string // MCQ, 1 pt
  let q2Id: string // MCQ, 1 pt
  let opt1CorrectId: string
  let opt1WrongId: string
  let opt2CorrectId: string
  let opt2WrongId: string

  // ── Setup ────────────────────────────────────────────────────────────────────
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'Quiz',
        email: `${P}@test.com`,
        passwordHash: 'noop',
        profile: { create: {} },
      },
    })
    userId = user.id

    const alien = await prisma.user.create({
      data: {
        firstName: 'Alien',
        lastName: 'NoEnroll',
        email: `${P}_alien@test.com`,
        passwordHash: 'noop',
        profile: { create: {} },
      },
    })
    alienUserId = alien.id

    const category = await prisma.courseCategory.create({
      data: { name: `${P}_cat`, slug: `${P}-cat` },
    })
    const course = await prisma.course.create({
      data: {
        title: `${P} Cours`,
        slug: `${P}-cours`,
        description: 'Cours de test pour les quiz',
        instructorId: userId,
        categoryId: category.id,
      },
    })
    courseId = course.id

    await prisma.enrollment.create({ data: { userId, courseId } })

    // Quiz : 2 questions MCQ, 1 pt chacune, passingScore = 70, maxAttempts = 3
    const quiz = await prisma.quiz.create({
      data: {
        courseId,
        title: `${P} Quiz`,
        passingScore: 70,
        maxAttempts: 3,
      },
    })
    quizId = quiz.id

    // Question 1
    const q1 = await prisma.quizQuestion.create({
      data: { quizId, questionText: 'Q1?', type: 'MCQ', position: 1, points: 1 },
    })
    q1Id = q1.id
    const [opt1c, opt1w] = await Promise.all([
      prisma.quizOption.create({ data: { questionId: q1Id, text: 'Correct', isCorrect: true, position: 1 } }),
      prisma.quizOption.create({ data: { questionId: q1Id, text: 'Faux', isCorrect: false, position: 2 } }),
    ])
    opt1CorrectId = opt1c.id
    opt1WrongId = opt1w.id

    // Question 2
    const q2 = await prisma.quizQuestion.create({
      data: { quizId, questionText: 'Q2?', type: 'MCQ', position: 2, points: 1 },
    })
    q2Id = q2.id
    const [opt2c, opt2w] = await Promise.all([
      prisma.quizOption.create({ data: { questionId: q2Id, text: 'Correct', isCorrect: true, position: 1 } }),
      prisma.quizOption.create({ data: { questionId: q2Id, text: 'Faux', isCorrect: false, position: 2 } }),
    ])
    opt2CorrectId = opt2c.id
    opt2WrongId = opt2w.id
  })

  // ── Teardown ─────────────────────────────────────────────────────────────────
  afterAll(async () => {
    // QuizAnswer supprimé en cascade par QuizAttempt
    await prisma.quizAttempt.deleteMany({ where: { quizId } })
    await prisma.quiz.delete({ where: { id: quizId } })
    await prisma.enrollment.deleteMany({ where: { userId } })
    await prisma.course.delete({ where: { id: courseId } })
    await prisma.courseCategory.deleteMany({ where: { slug: `${P}-cat` } })
    await prisma.profile.deleteMany({ where: { userId: { in: [userId, alienUserId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [userId, alienUserId] } } })
    await prisma.$disconnect()
  })

  // ── Tests ────────────────────────────────────────────────────────────────────

  it('refuse sans enrollment (FORBIDDEN)', async () => {
    const result = await submitQuizAttemptCore(alienUserId, quizId, [
      { questionId: q1Id, optionIds: [opt1CorrectId] },
      { questionId: q2Id, optionIds: [opt2CorrectId] },
    ])
    expect(result.success).toBe(false)
    expect(result.error).toBe('FORBIDDEN')
  })

  it('quiz inexistant → erreur claire', async () => {
    const result = await submitQuizAttemptCore(userId, 'inexistant-quiz-id', [])
    expect(result.success).toBe(false)
    expect(result.error).toBe('Quiz introuvable.')
  })

  it('0/2 bonnes réponses → score 0 %, non validé', async () => {
    const result = await submitQuizAttemptCore(userId, quizId, [
      { questionId: q1Id, optionIds: [opt1WrongId] },
      { questionId: q2Id, optionIds: [opt2WrongId] },
    ])
    expect(result.success).toBe(true)
    expect(result.data?.score).toBe(0)
    expect(result.data?.passed).toBe(false)
    expect(result.data?.pointsEarned).toBe(0)
    expect(result.data?.pointsTotal).toBe(2)
    expect(result.data?.attemptsUsed).toBe(1)
  })

  it('1/2 bonnes réponses → score 50 %, non validé (seuil 70 %)', async () => {
    const result = await submitQuizAttemptCore(userId, quizId, [
      { questionId: q1Id, optionIds: [opt1CorrectId] },
      { questionId: q2Id, optionIds: [opt2WrongId] },
    ])
    expect(result.success).toBe(true)
    expect(result.data?.score).toBe(50)
    expect(result.data?.passed).toBe(false)
    expect(result.data?.pointsEarned).toBe(1)
    expect(result.data?.attemptsUsed).toBe(2)
  })

  it('2/2 bonnes réponses → score 100 %, validé, completedAt renseigné', async () => {
    const result = await submitQuizAttemptCore(userId, quizId, [
      { questionId: q1Id, optionIds: [opt1CorrectId] },
      { questionId: q2Id, optionIds: [opt2CorrectId] },
    ])
    expect(result.success).toBe(true)
    expect(result.data?.score).toBe(100)
    expect(result.data?.passed).toBe(true)
    expect(result.data?.pointsEarned).toBe(2)
    expect(result.data?.attemptsUsed).toBe(3)

    const attempt = await prisma.quizAttempt.findFirst({
      where: { quizId, userId, passed: true },
      select: { completedAt: true },
    })
    expect(attempt?.completedAt).toBeInstanceOf(Date)
  })

  it('bloqué après réussite (déjà passé)', async () => {
    const result = await submitQuizAttemptCore(userId, quizId, [
      { questionId: q1Id, optionIds: [opt1CorrectId] },
      { questionId: q2Id, optionIds: [opt2CorrectId] },
    ])
    expect(result.success).toBe(false)
    expect(result.error).toBe('Vous avez déjà réussi ce quiz.')
  })

  it('hasPassedQuiz → true après réussite', async () => {
    const passed = await hasPassedQuiz(userId, courseId)
    expect(passed).toBe(true)
  })

  it('hasPassedQuiz → false pour utilisateur sans tentative réussie', async () => {
    const passed = await hasPassedQuiz(alienUserId, courseId)
    expect(passed).toBe(false)
  })
})

describe('submitQuizAttemptCore – maxAttempts épuisé sans réussite', () => {
  let userId2: string
  let courseId2: string
  let quizId2: string
  let q1Id2: string
  let opt1WrongId2: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        firstName: 'Exhausted',
        lastName: 'User',
        email: `${P}_exhaust@test.com`,
        passwordHash: 'noop',
        profile: { create: {} },
      },
    })
    userId2 = user.id

    const category = await prisma.courseCategory.create({
      data: { name: `${P}_cat2`, slug: `${P}-cat2` },
    })
    const course = await prisma.course.create({
      data: {
        title: `${P} Cours2`,
        slug: `${P}-cours2`,
        description: 'Cours test maxAttempts',
        instructorId: userId2,
        categoryId: category.id,
      },
    })
    courseId2 = course.id
    await prisma.enrollment.create({ data: { userId: userId2, courseId: courseId2 } })

    // Quiz maxAttempts = 1
    const quiz = await prisma.quiz.create({
      data: { courseId: courseId2, title: `${P} Quiz2`, passingScore: 70, maxAttempts: 1 },
    })
    quizId2 = quiz.id

    const q = await prisma.quizQuestion.create({
      data: { quizId: quizId2, questionText: 'Q?', type: 'MCQ', position: 1, points: 1 },
    })
    q1Id2 = q.id
    const wrong = await prisma.quizOption.create({
      data: { questionId: q1Id2, text: 'Faux', isCorrect: false, position: 1 },
    })
    opt1WrongId2 = wrong.id
    // ajouter une option correcte (requise pour le schéma)
    await prisma.quizOption.create({
      data: { questionId: q1Id2, text: 'Correct', isCorrect: true, position: 2 },
    })
  })

  afterAll(async () => {
    await prisma.quizAttempt.deleteMany({ where: { quizId: quizId2 } })
    await prisma.quiz.delete({ where: { id: quizId2 } })
    await prisma.enrollment.deleteMany({ where: { userId: userId2 } })
    await prisma.course.delete({ where: { id: courseId2 } })
    await prisma.courseCategory.deleteMany({ where: { slug: `${P}-cat2` } })
    await prisma.profile.deleteMany({ where: { userId: userId2 } })
    await prisma.user.delete({ where: { id: userId2 } })
    await prisma.$disconnect()
  })

  it('première tentative échoue (maxAttempts=1)', async () => {
    const result = await submitQuizAttemptCore(userId2, quizId2, [
      { questionId: q1Id2, optionIds: [opt1WrongId2] },
    ])
    expect(result.success).toBe(true)
    expect(result.data?.passed).toBe(false)
    expect(result.data?.attemptsUsed).toBe(1)
  })

  it('bloqué quand maxAttempts épuisé', async () => {
    const result = await submitQuizAttemptCore(userId2, quizId2, [
      { questionId: q1Id2, optionIds: [opt1WrongId2] },
    ])
    expect(result.success).toBe(false)
    expect(result.error).toContain('maximum de tentatives')
  })
})
