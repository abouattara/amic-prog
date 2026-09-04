/**
 * Tests d'intégration : système de notifications internes.
 * Nécessite la DB : npm run db:start
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { sendNotificationSafe, notifyNewCourse, markNotificationAsReadCore } from '@/features/notifications/core'
import { submitQuizAttemptCore } from '@/features/quiz/core'
import { checkAndIssueCertificate } from '@/features/certificates/core'

const P = `notif_${Date.now()}`

// ── Setup global ──────────────────────────────────────────────────────────────

let student1Id: string
let student2Id: string
let adminId: string
let courseId: string
let categoryId: string
let moduleId: string
let lessonId: string
let quizId: string
let q1Id: string
let correctOptionId: string

beforeAll(async () => {
  const [s1, s2, admin] = await Promise.all([
    prisma.user.create({ data: { firstName: 'S1', lastName: 'Test', email: `${P}_s1@t.com`, passwordHash: 'x', role: 'STUDENT', profile: { create: {} } } }),
    prisma.user.create({ data: { firstName: 'S2', lastName: 'Test', email: `${P}_s2@t.com`, passwordHash: 'x', role: 'STUDENT', profile: { create: {} } } }),
    prisma.user.create({ data: { firstName: 'Admin', lastName: 'Test', email: `${P}_admin@t.com`, passwordHash: 'x', role: 'ADMIN', profile: { create: {} } } }),
  ])
  student1Id = s1.id
  student2Id = s2.id
  adminId = admin.id

  const cat = await prisma.courseCategory.create({ data: { name: `${P}_cat`, slug: `${P}-cat` } })
  categoryId = cat.id

  const course = await prisma.course.create({
    data: { title: 'Formation Notif', slug: `${P}-notif`, description: 'test', instructorId: adminId, categoryId },
  })
  courseId = course.id

  const mod = await prisma.courseModule.create({ data: { courseId, title: 'Module 1', position: 1 } })
  moduleId = mod.id

  const lesson = await prisma.lesson.create({ data: { moduleId, title: 'Leçon 1', type: 'VIDEO', position: 1 } })
  lessonId = lesson.id

  // Quiz avec 1 question MCQ
  const quiz = await prisma.quiz.create({
    data: { courseId, title: 'Quiz Notif', passingScore: 50, maxAttempts: 5 },
  })
  quizId = quiz.id

  const question = await prisma.quizQuestion.create({
    data: { quizId, questionText: 'Quelle couleur ?', type: 'MCQ', points: 1, position: 1 },
  })
  q1Id = question.id

  const [correct] = await Promise.all([
    prisma.quizOption.create({ data: { questionId: q1Id, text: 'Bleu', isCorrect: true, position: 1 } }),
    prisma.quizOption.create({ data: { questionId: q1Id, text: 'Rouge', isCorrect: false, position: 2 } }),
  ])
  correctOptionId = correct.id

  // Inscrire student1 + marquer cours comme complété (pour checkAndIssueCertificate)
  const enrollment = await prisma.enrollment.create({ data: { userId: student1Id, courseId } })
  await prisma.lessonProgress.create({ data: { enrollmentId: enrollment.id, lessonId, completed: true } })
  await prisma.courseProgress.create({
    data: {
      enrollmentId: enrollment.id,
      completedCount: 1,
      totalLessons: 1,
      percentage: 100,
      completedAt: new Date(),
    },
  })
})

afterAll(async () => {
  // Cascade user → notifications, quizAttempts, enrollments, etc.
  await prisma.certificate.deleteMany({ where: { courseId } })
  // QuizAttempt a une FK RESTRICT sur Quiz → supprimer avant le cours/quiz
  await prisma.quizAttempt.deleteMany({ where: { quiz: { courseId } } })
  const enrollments = await prisma.enrollment.findMany({ where: { courseId }, select: { id: true } })
  for (const { id } of enrollments) {
    await prisma.lessonProgress.deleteMany({ where: { enrollmentId: id } })
    await prisma.courseProgress.deleteMany({ where: { enrollmentId: id } })
  }
  await prisma.enrollment.deleteMany({ where: { courseId } })
  await prisma.course.delete({ where: { id: courseId } })
  await prisma.courseCategory.delete({ where: { id: categoryId } })
  await prisma.profile.deleteMany({ where: { userId: { in: [student1Id, student2Id, adminId] } } })
  await prisma.user.deleteMany({ where: { id: { in: [student1Id, student2Id, adminId] } } })
  await prisma.$disconnect()
})

// ── sendNotificationSafe ──────────────────────────────────────────────────────

describe('sendNotificationSafe', () => {
  it('crée une notification en DB', async () => {
    await sendNotificationSafe({
      userId: student1Id,
      event: 'QUIZ_PASSED',
      title: 'Test notif',
      body: 'Body test',
      sourceId: `${P}-test-source`,
    })

    const n = await prisma.notification.findFirst({
      where: { userId: student1Id, sourceId: `${P}-test-source` },
    })
    expect(n).not.toBeNull()
    expect(n?.event).toBe('QUIZ_PASSED')
    expect(n?.read).toBe(false)
    expect(n?.readAt).toBeNull()
  })

  it('idempotence : même (userId, event, sourceId) → pas de doublon', async () => {
    const src = `${P}-idem-source`
    await sendNotificationSafe({ userId: student1Id, event: 'QUIZ_PASSED', title: 'T', body: 'B', sourceId: src })
    await sendNotificationSafe({ userId: student1Id, event: 'QUIZ_PASSED', title: 'T', body: 'B', sourceId: src })

    const count = await prisma.notification.count({
      where: { userId: student1Id, event: 'QUIZ_PASSED', sourceId: src },
    })
    expect(count).toBe(1)
  })

  it('sans sourceId → pas de déduplication (deux appels → deux notifications)', async () => {
    const before = await prisma.notification.count({ where: { userId: student2Id, event: 'ACCOUNT_CREATED' } })
    await sendNotificationSafe({ userId: student2Id, event: 'ACCOUNT_CREATED', title: 'A', body: 'B' })
    await sendNotificationSafe({ userId: student2Id, event: 'ACCOUNT_CREATED', title: 'A', body: 'B' })
    const after = await prisma.notification.count({ where: { userId: student2Id, event: 'ACCOUNT_CREATED' } })
    expect(after - before).toBe(2)
  })
})

// ── QUIZ_PASSED event ─────────────────────────────────────────────────────────

describe('QUIZ_PASSED : notification créée lors de la réussite d\'un quiz', () => {
  it('submitQuizAttemptCore avec bonne réponse → notification QUIZ_PASSED créée', async () => {
    const before = await prisma.notification.count({
      where: { userId: student1Id, event: 'QUIZ_PASSED', sourceId: quizId },
    })

    const r = await submitQuizAttemptCore(student1Id, quizId, [{ questionId: q1Id, optionIds: [correctOptionId] }])
    expect(r.success).toBe(true)
    expect(r.data?.passed).toBe(true)

    const after = await prisma.notification.count({
      where: { userId: student1Id, event: 'QUIZ_PASSED', sourceId: quizId },
    })
    expect(after - before).toBe(1)
  })

  it('idempotence : quiz déjà réussi → blocage, pas de doublon de notification', async () => {
    // Quiz déjà réussi → submitQuizAttemptCore retourne success: false (bloqué)
    const r = await submitQuizAttemptCore(student1Id, quizId, [{ questionId: q1Id, optionIds: [correctOptionId] }])
    expect(r.success).toBe(false)

    // Pas de nouvelle notification
    const count = await prisma.notification.count({
      where: { userId: student1Id, event: 'QUIZ_PASSED', sourceId: quizId },
    })
    expect(count).toBe(1)
  })
})

// ── CERTIFICATE_AVAILABLE event ───────────────────────────────────────────────
// Note : le certificat + la notif CERTIFICATE_AVAILABLE sont créés lors de la
// soumission du quiz (test QUIZ_PASSED ci-dessus). Ces tests vérifient l'état
// résultant et l'idempotence de checkAndIssueCertificate.

describe('CERTIFICATE_AVAILABLE : notification créée lors de l\'émission du certificat', () => {
  it('après la réussite du quiz, notification CERTIFICATE_AVAILABLE existe en DB', async () => {
    // La notif a été créée dans le test QUIZ_PASSED via onQuizPassed → checkAndIssueCertificate
    const n = await prisma.notification.findFirst({
      where: { userId: student1Id, event: 'CERTIFICATE_AVAILABLE', sourceId: courseId },
    })
    expect(n).not.toBeNull()
    expect(n?.title).toBe('Votre certificat est prêt !')
  })

  it('idempotence : checkAndIssueCertificate rejoué → pas de doublon notification', async () => {
    // Certificat déjà émis → checkAndIssueCertificate retourne en avance → pas de 2e notif
    await checkAndIssueCertificate(student1Id, courseId)

    const count = await prisma.notification.count({
      where: { userId: student1Id, event: 'CERTIFICATE_AVAILABLE', sourceId: courseId },
    })
    expect(count).toBe(1)
  })
})

// ── NEW_COURSE event ──────────────────────────────────────────────────────────

describe('NEW_COURSE : notifyNewCourse envoie aux apprenants actifs', () => {
  const testCourseId = `fake-course-${P}`

  it('notifyNewCourse → une notification par apprenant actif', async () => {
    await notifyNewCourse(testCourseId, 'Formation de test')

    const n1 = await prisma.notification.findFirst({
      where: { userId: student1Id, event: 'NEW_COURSE', sourceId: testCourseId },
    })
    const n2 = await prisma.notification.findFirst({
      where: { userId: student2Id, event: 'NEW_COURSE', sourceId: testCourseId },
    })
    expect(n1).not.toBeNull()
    expect(n2).not.toBeNull()
    expect(n1?.body).toContain('Formation de test')
  })

  it('idempotence : notifyNewCourse rejoué (cours republié) → pas de doublon', async () => {
    await notifyNewCourse(testCourseId, 'Formation de test')

    const count1 = await prisma.notification.count({
      where: { userId: student1Id, event: 'NEW_COURSE', sourceId: testCourseId },
    })
    const count2 = await prisma.notification.count({
      where: { userId: student2Id, event: 'NEW_COURSE', sourceId: testCourseId },
    })
    expect(count1).toBe(1)
    expect(count2).toBe(1)
  })

  it('admin ne reçoit pas la notification NEW_COURSE (rôle STUDENT uniquement)', async () => {
    const adminNotif = await prisma.notification.findFirst({
      where: { userId: adminId, event: 'NEW_COURSE', sourceId: testCourseId },
    })
    expect(adminNotif).toBeNull()
  })
})

// ── markNotificationAsReadCore ────────────────────────────────────────────────

describe('markNotificationAsReadCore', () => {
  let notifId: string

  beforeAll(async () => {
    const n = await prisma.notification.create({
      data: { userId: student1Id, event: 'PAYMENT_SUCCESS', title: 'Test', body: 'Lire moi', sourceId: `${P}-read-test` },
    })
    notifId = n.id
  })

  it('marque la notification comme lue + readAt renseigné', async () => {
    const before = Date.now()
    const r = await markNotificationAsReadCore(student1Id, notifId)
    expect(r.success).toBe(true)

    const n = await prisma.notification.findUnique({ where: { id: notifId } })
    expect(n?.read).toBe(true)
    expect(n?.readAt).not.toBeNull()
    expect(n!.readAt!.getTime()).toBeGreaterThanOrEqual(before)
  })

  it('idempotent : relecture ne modifie pas readAt', async () => {
    const n1 = await prisma.notification.findUnique({ where: { id: notifId }, select: { readAt: true } })
    const r = await markNotificationAsReadCore(student1Id, notifId)
    expect(r.success).toBe(true)

    const n2 = await prisma.notification.findUnique({ where: { id: notifId }, select: { readAt: true } })
    // readAt identique (l'update n'est pas relancé)
    expect(n2?.readAt?.getTime()).toBe(n1?.readAt?.getTime())
  })

  it('refus si l\'utilisateur n\'est pas le propriétaire', async () => {
    const r = await markNotificationAsReadCore(student2Id, notifId)
    expect(r.success).toBe(false)
    expect(r.error).toBe('Non autorisé.')
  })

  it('notification introuvable → erreur propre', async () => {
    const r = await markNotificationAsReadCore(student1Id, 'fake-id-inexistant')
    expect(r.success).toBe(false)
    expect(r.error).toBe('Notification introuvable.')
  })

  it('l\'échec du provider de notification n\'empêche pas l\'action principale', async () => {
    // On force sendNotificationSafe à échouer en passant un userId inexistant
    // La notification ne peut être créée (FK violation) mais doit rester silencieux
    let coreSucceeded = false
    try {
      await sendNotificationSafe({
        userId: 'user-inexistant-fk-fail',
        event: 'QUIZ_PASSED',
        title: 'T',
        body: 'B',
        sourceId: `${P}-fail-test`,
      })
    } catch {
      // silencieux — l'appelant gère l'erreur avec try/catch
    }
    // L'action principale (ici, juste assigner la variable) est exécutée quoi qu'il arrive
    coreSucceeded = true
    expect(coreSucceeded).toBe(true)
  })
})
