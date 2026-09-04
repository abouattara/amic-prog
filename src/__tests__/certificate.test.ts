/**
 * Tests d'intégration pour checkAndIssueCertificate.
 * Nécessite la DB en cours d'exécution : npm run db:start
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { checkAndIssueCertificate } from '@/features/certificates/core'
import { prisma } from '@/lib/prisma'

const P = `cert_${Date.now()}`

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createUser(suffix: string) {
  return prisma.user.create({
    data: {
      firstName: 'Test',
      lastName: `Cert${suffix}`,
      email: `${P}_${suffix}@test.com`,
      passwordHash: 'noop',
      profile: { create: {} },
    },
  })
}

async function createCourseWithCategory(instructorId: string, suffix: string) {
  const category = await prisma.courseCategory.create({
    data: { name: `${P}_cat_${suffix}`, slug: `${P}-cat-${suffix}` },
  })
  const course = await prisma.course.create({
    data: {
      title: `${P} Cours ${suffix}`,
      slug: `${P}-cours-${suffix}`,
      description: 'Cours test certificat',
      instructorId,
      categoryId: category.id,
    },
  })
  return { course, categoryId: category.id }
}

async function setCourseCompleted(enrollmentId: string) {
  await prisma.courseProgress.upsert({
    where: { enrollmentId },
    create: { enrollmentId, completedCount: 1, totalLessons: 1, percentage: 100, completedAt: new Date() },
    update: { percentage: 100, completedCount: 1, totalLessons: 1, completedAt: new Date() },
  })
}

// ── Suite principale (cours avec un quiz) ─────────────────────────────────────

describe('checkAndIssueCertificate', () => {
  let userId: string
  let courseId: string
  let categoryId: string
  let enrollmentId: string
  let quizId: string

  beforeAll(async () => {
    const user = await createUser('main')
    userId = user.id

    const { course, categoryId: catId } = await createCourseWithCategory(userId, 'main')
    courseId = course.id
    categoryId = catId

    const enrollment = await prisma.enrollment.create({ data: { userId, courseId } })
    enrollmentId = enrollment.id

    const quiz = await prisma.quiz.create({
      data: { courseId, title: `${P} Quiz`, passingScore: 70, maxAttempts: 3 },
    })
    quizId = quiz.id
  })

  afterAll(async () => {
    await prisma.quizAttempt.deleteMany({ where: { quizId } })
    await prisma.quiz.delete({ where: { id: quizId } })
    await prisma.certificate.deleteMany({ where: { courseId } })
    await prisma.courseProgress.deleteMany({ where: { enrollmentId } })
    await prisma.enrollment.delete({ where: { id: enrollmentId } })
    await prisma.course.delete({ where: { id: courseId } })
    await prisma.courseCategory.delete({ where: { id: categoryId } })
    await prisma.profile.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('pas de certificat si cours non complete (completedAt = null)', async () => {
    // Quiz réussi mais pas de courseProgress.completedAt
    await prisma.quizAttempt.create({ data: { userId, quizId, score: 100, passed: true } })

    await checkAndIssueCertificate(userId, courseId)

    const cert = await prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    })
    expect(cert).toBeNull()
  })

  it('pas de certificat si quiz non reussi (cours complet, aucun attempt passing)', async () => {
    // Supprimer l'attempt réussi du test précédent
    await prisma.quizAttempt.deleteMany({ where: { quizId, userId, passed: true } })

    // Marquer le cours comme complété
    await setCourseCompleted(enrollmentId)

    await checkAndIssueCertificate(userId, courseId)

    const cert = await prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    })
    expect(cert).toBeNull()
  })

  it('certificat emis si les deux conditions sont reunies', async () => {
    // Ajouter une tentative réussie (cours déjà marqué complété par le test précédent)
    await prisma.quizAttempt.create({ data: { userId, quizId, score: 100, passed: true } })

    await checkAndIssueCertificate(userId, courseId)

    const cert = await prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    })
    expect(cert).not.toBeNull()
    expect(cert!.userId).toBe(userId)
    expect(cert!.courseId).toBe(courseId)
  })

  it('certificateNumber : 24 caracteres hexadecimaux majuscules', async () => {
    const cert = await prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    })
    expect(cert!.certificateNumber).toMatch(/^[0-9A-F]{24}$/)
  })

  it('idempotence : appels repetes ne creent pas de doublon', async () => {
    await checkAndIssueCertificate(userId, courseId)
    await checkAndIssueCertificate(userId, courseId)

    const count = await prisma.certificate.count({ where: { userId, courseId } })
    expect(count).toBe(1)
  })

  it('donnees coherentes pour la page /verify', async () => {
    const cert = await prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        course: { select: { title: true, instructor: { select: { firstName: true, lastName: true } } } },
      },
    })
    expect(cert).not.toBeNull()
    expect(cert!.user.firstName).toBe('Test')
    expect(cert!.course.title).toContain(`${P}`)
    expect(cert!.issuedAt).toBeInstanceOf(Date)
    expect(cert!.certificateNumber).toHaveLength(24)
  })

  it('/verify : numero invalide → findUnique retourne null', async () => {
    const cert = await prisma.certificate.findUnique({
      where: { certificateNumber: 'NUMEROINVALIDE000000' },
    })
    expect(cert).toBeNull()
  })
})

// ── Cours sans quiz ───────────────────────────────────────────────────────────

describe('checkAndIssueCertificate – cours sans quiz', () => {
  let userId2: string
  let courseId2: string
  let categoryId2: string
  let enrollmentId2: string

  beforeAll(async () => {
    const user = await createUser('noquiz')
    userId2 = user.id

    const { course, categoryId } = await createCourseWithCategory(userId2, 'noquiz')
    courseId2 = course.id
    categoryId2 = categoryId

    const enrollment = await prisma.enrollment.create({ data: { userId: userId2, courseId: courseId2 } })
    enrollmentId2 = enrollment.id

    await setCourseCompleted(enrollmentId2)
  })

  afterAll(async () => {
    await prisma.certificate.deleteMany({ where: { courseId: courseId2 } })
    await prisma.courseProgress.deleteMany({ where: { enrollmentId: enrollmentId2 } })
    await prisma.enrollment.delete({ where: { id: enrollmentId2 } })
    await prisma.course.delete({ where: { id: courseId2 } })
    await prisma.courseCategory.delete({ where: { id: categoryId2 } })
    await prisma.profile.deleteMany({ where: { userId: userId2 } })
    await prisma.user.delete({ where: { id: userId2 } })
    await prisma.$disconnect()
  })

  it('certificat emis si cours complet et aucun quiz (pas de blocage quiz)', async () => {
    await checkAndIssueCertificate(userId2, courseId2)

    const cert = await prisma.certificate.findUnique({
      where: { userId_courseId: { userId: userId2, courseId: courseId2 } },
    })
    expect(cert).not.toBeNull()
    expect(cert!.certificateNumber).toMatch(/^[0-9A-F]{24}$/)
  })
})

// ── Unicite des numeros ───────────────────────────────────────────────────────

describe('certificateNumber – unicite entre utilisateurs', () => {
  it('deux certificats distincts ont des numeros differents', async () => {
    const [userA, userB] = await Promise.all([createUser('uniqA'), createUser('uniqB')])
    const [{ course: cA, categoryId: catA }, { course: cB, categoryId: catB }] = await Promise.all([
      createCourseWithCategory(userA.id, 'uniqA'),
      createCourseWithCategory(userB.id, 'uniqB'),
    ])
    const [enrollA, enrollB] = await Promise.all([
      prisma.enrollment.create({ data: { userId: userA.id, courseId: cA.id } }),
      prisma.enrollment.create({ data: { userId: userB.id, courseId: cB.id } }),
    ])
    await Promise.all([setCourseCompleted(enrollA.id), setCourseCompleted(enrollB.id)])
    await Promise.all([
      checkAndIssueCertificate(userA.id, cA.id),
      checkAndIssueCertificate(userB.id, cB.id),
    ])

    const [certA, certB] = await Promise.all([
      prisma.certificate.findUnique({ where: { userId_courseId: { userId: userA.id, courseId: cA.id } } }),
      prisma.certificate.findUnique({ where: { userId_courseId: { userId: userB.id, courseId: cB.id } } }),
    ])
    expect(certA).not.toBeNull()
    expect(certB).not.toBeNull()
    expect(certA!.certificateNumber).not.toBe(certB!.certificateNumber)

    // Teardown
    await prisma.certificate.deleteMany({ where: { courseId: { in: [cA.id, cB.id] } } })
    await Promise.all([
      prisma.courseProgress.deleteMany({ where: { enrollmentId: enrollA.id } }),
      prisma.courseProgress.deleteMany({ where: { enrollmentId: enrollB.id } }),
    ])
    await Promise.all([
      prisma.enrollment.delete({ where: { id: enrollA.id } }),
      prisma.enrollment.delete({ where: { id: enrollB.id } }),
    ])
    await Promise.all([
      prisma.course.delete({ where: { id: cA.id } }),
      prisma.course.delete({ where: { id: cB.id } }),
    ])
    await Promise.all([
      prisma.courseCategory.delete({ where: { id: catA } }),
      prisma.courseCategory.delete({ where: { id: catB } }),
    ])
    await prisma.profile.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } })
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } })
    await prisma.$disconnect()
  })
})
