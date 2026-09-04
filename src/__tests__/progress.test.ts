/**
 * Tests d'intégration pour markLessonCompleteCore.
 * Nécessite la DB en cours d'exécution : npm run db:start
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { markLessonCompleteCore } from '@/features/progress/core'
import { prisma } from '@/lib/prisma'

// Préfixe unique par run pour éviter les collisions
const P = `test_${Date.now()}`

describe('markLessonCompleteCore', () => {
  let userId: string
  let alienUserId: string
  let courseId: string
  let enrollmentId: string
  let lessonIds: string[] // 4 leçons

  // ── Setup ────────────────────────────────────────────────────────────────────
  beforeAll(async () => {
    // Utilisateur principal (inscrit)
    const user = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'Progress',
        email: `${P}@test.com`,
        passwordHash: 'noop',
        profile: { create: {} },
      },
    })
    userId = user.id

    // Utilisateur sans enrollment
    const alien = await prisma.user.create({
      data: {
        firstName: 'Alien',
        lastName: 'User',
        email: `${P}_alien@test.com`,
        passwordHash: 'noop',
        profile: { create: {} },
      },
    })
    alienUserId = alien.id

    // Catégorie + cours
    const category = await prisma.courseCategory.create({
      data: { name: `${P}_cat`, slug: `${P}-cat` },
    })
    const course = await prisma.course.create({
      data: {
        title: `${P} Cours`,
        slug: `${P}-cours`,
        description: 'Cours de test pour les tests de progression',
        instructorId: userId,
        categoryId: category.id,
      },
    })
    courseId = course.id

    // 2 modules × 2 leçons = 4 leçons au total
    const mod1 = await prisma.courseModule.create({
      data: { courseId, title: 'Module 1', position: 1 },
    })
    const mod2 = await prisma.courseModule.create({
      data: { courseId, title: 'Module 2', position: 2 },
    })
    const lessons = await Promise.all([
      prisma.lesson.create({ data: { moduleId: mod1.id, title: 'Leçon 1', type: 'VIDEO', position: 1 } }),
      prisma.lesson.create({ data: { moduleId: mod1.id, title: 'Leçon 2', type: 'VIDEO', position: 2 } }),
      prisma.lesson.create({ data: { moduleId: mod2.id, title: 'Leçon 3', type: 'VIDEO', position: 1 } }),
      prisma.lesson.create({ data: { moduleId: mod2.id, title: 'Leçon 4', type: 'VIDEO', position: 2 } }),
    ])
    lessonIds = lessons.map((l) => l.id)

    // Enrollment + CourseProgress initial
    const enrollment = await prisma.enrollment.create({
      data: { userId, courseId },
    })
    enrollmentId = enrollment.id
    await prisma.courseProgress.create({
      data: { enrollmentId, totalLessons: 4, completedCount: 0, percentage: 0 },
    })
  })

  // ── Teardown ─────────────────────────────────────────────────────────────────
  afterAll(async () => {
    // L'ordre respecte les foreign keys
    await prisma.lessonProgress.deleteMany({ where: { enrollmentId } })
    await prisma.courseProgress.deleteMany({ where: { enrollmentId } })
    // onCourseCompleted peut avoir créé un Certificate → supprimer avant le cours
    await prisma.certificate.deleteMany({ where: { courseId } })
    await prisma.enrollment.deleteMany({ where: { userId } })
    // Cascade: modules + leçons supprimés avec le cours
    await prisma.course.delete({ where: { id: courseId } })
    await prisma.courseCategory.deleteMany({ where: { slug: `${P}-cat` } })
    await prisma.profile.deleteMany({ where: { userId: { in: [userId, alienUserId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [userId, alienUserId] } } })
    await prisma.$disconnect()
  })

  // ── Tests ────────────────────────────────────────────────────────────────────

  it('refuse sans enrollment (FORBIDDEN)', async () => {
    const result = await markLessonCompleteCore(alienUserId, lessonIds[0])
    expect(result.success).toBe(false)
    expect(result.error).toBe('FORBIDDEN')
  })

  it('leçon inexistante → erreur claire', async () => {
    const result = await markLessonCompleteCore(userId, 'id-qui-nexiste-pas')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Leçon introuvable.')
  })

  it('1/4 leçons complétées → 25 %', async () => {
    const result = await markLessonCompleteCore(userId, lessonIds[0])
    expect(result.success).toBe(true)

    const progress = await prisma.courseProgress.findUnique({ where: { enrollmentId } })
    expect(progress?.percentage).toBe(25)
    expect(progress?.completedCount).toBe(1)
    expect(progress?.completedAt).toBeNull()
  })

  it('2/4 leçons complétées → 50 %', async () => {
    await markLessonCompleteCore(userId, lessonIds[1])

    const progress = await prisma.courseProgress.findUnique({ where: { enrollmentId } })
    expect(progress?.percentage).toBe(50)
    expect(progress?.completedCount).toBe(2)
  })

  it('idempotence : rejouer leçon 1 (déjà complétée) laisse le pourcentage à 50 %', async () => {
    const result = await markLessonCompleteCore(userId, lessonIds[0])
    expect(result.success).toBe(true)

    const progress = await prisma.courseProgress.findUnique({ where: { enrollmentId } })
    expect(progress?.percentage).toBe(50) // toujours 50 %, pas 75 %
    expect(progress?.completedCount).toBe(2) // 2 leçons uniques, pas 3

    const lpCount = await prisma.lessonProgress.count({ where: { enrollmentId } })
    expect(lpCount).toBe(2) // pas de doublon
  })

  it('4/4 leçons → 100 %, completedAt renseigné, onCourseCompleted déclenché', async () => {
    await markLessonCompleteCore(userId, lessonIds[2])
    const result = await markLessonCompleteCore(userId, lessonIds[3])
    expect(result.success).toBe(true)

    const progress = await prisma.courseProgress.findUnique({ where: { enrollmentId } })
    expect(progress?.percentage).toBe(100)
    expect(progress?.completedCount).toBe(4)
    expect(progress?.completedAt).not.toBeNull()
    expect(progress?.completedAt).toBeInstanceOf(Date)
  })

  it('idempotence à 100 % : rejouer une leçon ne réinitialise pas completedAt', async () => {
    const before = await prisma.courseProgress.findUnique({
      where: { enrollmentId },
      select: { completedAt: true },
    })

    await markLessonCompleteCore(userId, lessonIds[0]) // déjà complétée

    const after = await prisma.courseProgress.findUnique({
      where: { enrollmentId },
      select: { completedAt: true, percentage: true },
    })

    expect(after?.percentage).toBe(100)
    // completedAt inchangé (même valeur)
    expect(after?.completedAt?.toISOString()).toBe(before?.completedAt?.toISOString())
  })
})
