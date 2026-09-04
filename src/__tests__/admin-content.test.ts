/**
 * Tests d'intégration : gestion des modules, leçons et recalcul de progression.
 * Nécessite la DB : npm run db:start
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createModuleCore, updateModuleCore, deleteModuleCore, moveModuleCore } from '@/features/courses/module-core'
import { createLessonCore, updateLessonCore, deleteLessonCore, moveLessonCore } from '@/features/courses/lesson-core'

const P = `adm_${Date.now()}`

// ── Setup global ──────────────────────────────────────────────────────────────

let adminId: string
let studentId: string
let courseId: string
let categoryId: string

beforeAll(async () => {
  const [admin, student] = await Promise.all([
    prisma.user.create({ data: { firstName: 'Admin', lastName: 'Test', email: `${P}_admin@t.com`, passwordHash: 'noop', role: 'ADMIN', profile: { create: {} } } }),
    prisma.user.create({ data: { firstName: 'Student', lastName: 'Test', email: `${P}_student@t.com`, passwordHash: 'noop', role: 'STUDENT', profile: { create: {} } } }),
  ])
  adminId = admin.id
  studentId = student.id

  const cat = await prisma.courseCategory.create({ data: { name: `${P}_cat`, slug: `${P}-cat` } })
  categoryId = cat.id

  const course = await prisma.course.create({
    data: { title: `${P} Cours`, slug: `${P}-cours`, description: 'Cours admin test', instructorId: adminId, categoryId },
  })
  courseId = course.id
})

afterAll(async () => {
  // Cascade via course → modules → lessons ; LessonProgress / CourseProgress via enrollment
  await prisma.certificate.deleteMany({ where: { courseId } })
  const enrollments = await prisma.enrollment.findMany({ where: { courseId }, select: { id: true } })
  for (const { id } of enrollments) {
    await prisma.lessonProgress.deleteMany({ where: { enrollmentId: id } })
    await prisma.courseProgress.deleteMany({ where: { enrollmentId: id } })
  }
  await prisma.enrollment.deleteMany({ where: { courseId } })

  // Supprimer LessonProgress orphelins (si des lessons ont été supprimées avec lessonId orphelin)
  const modules = await prisma.courseModule.findMany({ where: { courseId }, include: { lessons: true } })
  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      await prisma.lessonProgress.deleteMany({ where: { lessonId: lesson.id } })
    }
  }

  await prisma.course.delete({ where: { id: courseId } })
  await prisma.courseCategory.delete({ where: { id: categoryId } })
  await prisma.profile.deleteMany({ where: { userId: { in: [adminId, studentId] } } })
  await prisma.user.deleteMany({ where: { id: { in: [adminId, studentId] } } })
  await prisma.$disconnect()
})

// ── RBAC ──────────────────────────────────────────────────────────────────────

describe('RBAC : non-admin refusé', () => {
  it('createModuleCore → STUDENT refusé', async () => {
    const r = await createModuleCore('STUDENT', courseId, 'Test')
    expect(r.success).toBe(false)
    expect(r.error).toBe('Non autorisé.')
  })

  it('createLessonCore → STUDENT refusé', async () => {
    const r = await createLessonCore('STUDENT', 'fake-module-id', { title: 'T', type: 'VIDEO' })
    expect(r.success).toBe(false)
    expect(r.error).toBe('Non autorisé.')
  })

  it('deleteModuleCore → rôle vide refusé', async () => {
    const r = await deleteModuleCore('', 'fake-id')
    expect(r.success).toBe(false)
    expect(r.error).toBe('Non autorisé.')
  })
})

// ── Modules CRUD ──────────────────────────────────────────────────────────────

describe('Module CRUD', () => {
  let modId: string
  let mod2Id: string

  it('createModuleCore : crée un module avec position 1', async () => {
    const r = await createModuleCore('ADMIN', courseId, 'Module A')
    expect(r.success).toBe(true)
    modId = r.data!.id

    const mod = await prisma.courseModule.findUnique({ where: { id: modId } })
    expect(mod?.title).toBe('Module A')
    expect(mod?.position).toBe(1)
  })

  it('createModuleCore : deuxième module reçoit position 2', async () => {
    const r = await createModuleCore('ADMIN', courseId, 'Module B')
    expect(r.success).toBe(true)
    mod2Id = r.data!.id

    const mod = await prisma.courseModule.findUnique({ where: { id: mod2Id } })
    expect(mod?.position).toBe(2)
  })

  it('updateModuleCore : renomme le module', async () => {
    const r = await updateModuleCore('ADMIN', modId, 'Module A renommé')
    expect(r.success).toBe(true)

    const mod = await prisma.courseModule.findUnique({ where: { id: modId } })
    expect(mod?.title).toBe('Module A renommé')
  })

  it('updateModuleCore : titre vide → erreur', async () => {
    const r = await updateModuleCore('ADMIN', modId, '   ')
    expect(r.success).toBe(false)
    expect(r.error).toBe('Titre requis.')
  })

  it('moveModuleCore : descend le module A (1→2) et monte le module B (2→1)', async () => {
    const r = await moveModuleCore('ADMIN', modId, 'down')
    expect(r.success).toBe(true)

    const [a, b] = await Promise.all([
      prisma.courseModule.findUnique({ where: { id: modId } }),
      prisma.courseModule.findUnique({ where: { id: mod2Id } }),
    ])
    expect(a?.position).toBe(2)
    expect(b?.position).toBe(1)
  })

  it('moveModuleCore : impossible de descendre le dernier module (aucun changement)', async () => {
    // modId est maintenant en position 2 (dernier)
    const before = await prisma.courseModule.findUnique({ where: { id: modId }, select: { position: true } })
    const r = await moveModuleCore('ADMIN', modId, 'down')
    expect(r.success).toBe(true) // pas d'erreur, juste rien à faire

    const after = await prisma.courseModule.findUnique({ where: { id: modId }, select: { position: true } })
    expect(after?.position).toBe(before?.position)
  })

  // deleteModuleCore testé après les leçons (besoin du module avec des leçons)
})

// ── Leçons CRUD ───────────────────────────────────────────────────────────────

describe('Leçon CRUD', () => {
  let modId: string
  let lessonId1: string
  let lessonId2: string
  let lessonId3: string

  beforeAll(async () => {
    const mod = await prisma.courseModule.create({
      data: { courseId, title: 'Module Leçons', position: 10 },
    })
    modId = mod.id
  })

  it('createLessonCore : crée la première leçon avec position 1', async () => {
    const r = await createLessonCore('INSTRUCTOR', modId, { title: 'Intro', type: 'VIDEO', description: 'Présentation', isFree: true })
    expect(r.success).toBe(true)
    lessonId1 = r.data!.id

    const l = await prisma.lesson.findUnique({ where: { id: lessonId1 } })
    expect(l?.title).toBe('Intro')
    expect(l?.type).toBe('VIDEO')
    expect(l?.position).toBe(1)
    expect(l?.isFree).toBe(true)
  })

  it('createLessonCore : deuxième leçon → position 2', async () => {
    const r = await createLessonCore('ADMIN', modId, { title: 'Chapitre 1', type: 'DOCUMENT' })
    expect(r.success).toBe(true)
    lessonId2 = r.data!.id

    const l = await prisma.lesson.findUnique({ where: { id: lessonId2 } })
    expect(l?.position).toBe(2)
  })

  it('createLessonCore : troisième leçon → position 3', async () => {
    const r = await createLessonCore('ADMIN', modId, { title: 'Exercice', type: 'QUIZ' })
    expect(r.success).toBe(true)
    lessonId3 = r.data!.id

    const l = await prisma.lesson.findUnique({ where: { id: lessonId3 } })
    expect(l?.position).toBe(3)
  })

  it('updateLessonCore : met à jour titre et type', async () => {
    const r = await updateLessonCore('ADMIN', lessonId1, { title: 'Introduction modifiée', type: 'TEXT' })
    expect(r.success).toBe(true)

    const l = await prisma.lesson.findUnique({ where: { id: lessonId1 } })
    expect(l?.title).toBe('Introduction modifiée')
    expect(l?.type).toBe('TEXT')
  })

  it('moveLessonCore : monte la leçon 2 (position 2→1)', async () => {
    const r = await moveLessonCore('ADMIN', lessonId2, 'up')
    expect(r.success).toBe(true)

    const [l1, l2] = await Promise.all([
      prisma.lesson.findUnique({ where: { id: lessonId1 } }),
      prisma.lesson.findUnique({ where: { id: lessonId2 } }),
    ])
    expect(l2?.position).toBe(1)
    expect(l1?.position).toBe(2)
  })

  it('moveLessonCore : impossible de monter le premier (aucun changement)', async () => {
    // lessonId2 est maintenant en position 1
    const before = await prisma.lesson.findUnique({ where: { id: lessonId2 }, select: { position: true } })
    const r = await moveLessonCore('ADMIN', lessonId2, 'up')
    expect(r.success).toBe(true)

    const after = await prisma.lesson.findUnique({ where: { id: lessonId2 }, select: { position: true } })
    expect(after?.position).toBe(before?.position)
  })

  afterAll(async () => {
    // Nettoyage (les leçons seront supprimées via le module dans afterAll global,
    // mais on delete d'abord les LessonProgress si créés)
    await prisma.lessonProgress.deleteMany({ where: { lessonId: { in: [lessonId1, lessonId2, lessonId3].filter(Boolean) } } })
    await prisma.courseModule.delete({ where: { id: modId } })
  })
})

// ── Cohérence progression après suppression ───────────────────────────────────

describe('Suppression leçon : recalcul CourseProgress', () => {
  let modId: string
  let lessonIds: string[]
  let enrollmentId: string

  beforeAll(async () => {
    // Créer un module avec 3 leçons
    const mod = await prisma.courseModule.create({
      data: { courseId, title: 'Module Progress', position: 20 },
    })
    modId = mod.id

    const [l1, l2, l3] = await Promise.all([
      prisma.lesson.create({ data: { moduleId: modId, title: 'L1', type: 'VIDEO', position: 1 } }),
      prisma.lesson.create({ data: { moduleId: modId, title: 'L2', type: 'VIDEO', position: 2 } }),
      prisma.lesson.create({ data: { moduleId: modId, title: 'L3', type: 'VIDEO', position: 3 } }),
    ])
    lessonIds = [l1.id, l2.id, l3.id]

    // Inscrire l'étudiant
    const enrollment = await prisma.enrollment.create({ data: { userId: studentId, courseId } })
    enrollmentId = enrollment.id

    // Compléter L1 et L2 (2/3 = 66%)
    await prisma.lessonProgress.createMany({
      data: [
        { enrollmentId, lessonId: l1.id, completed: true },
        { enrollmentId, lessonId: l2.id, completed: true },
      ],
    })
    await prisma.courseProgress.create({
      data: { enrollmentId, completedCount: 2, totalLessons: 3, percentage: 66.67 },
    })
  })

  it('2/3 leçons complétées → pourcentage 66.67 %', async () => {
    const cp = await prisma.courseProgress.findUnique({ where: { enrollmentId } })
    expect(Math.round(cp!.percentage)).toBe(67)
    expect(cp!.completedCount).toBe(2)
    expect(cp!.totalLessons).toBe(3)
  })

  it('suppression de L3 (non complétée) → recalcule 2/2 = 100 %, completedAt inchangé (null)', async () => {
    const r = await deleteLessonCore('ADMIN', lessonIds[2])
    expect(r.success).toBe(true)

    const cp = await prisma.courseProgress.findUnique({ where: { enrollmentId } })
    expect(cp!.percentage).toBe(100)
    expect(cp!.completedCount).toBe(2)
    expect(cp!.totalLessons).toBe(2)
    // completedAt reste null — la suppression admin ne déclenche pas le certificat
    expect(cp!.completedAt).toBeNull()
  })

  it('suppression de L2 (complétée) → LessonProgress supprimé, recalcule 1/1 = 100 %', async () => {
    const r = await deleteLessonCore('ADMIN', lessonIds[1])
    expect(r.success).toBe(true)

    // Vérifier que le LessonProgress de L2 est bien supprimé
    const lp = await prisma.lessonProgress.findFirst({ where: { lessonId: lessonIds[1] } })
    expect(lp).toBeNull()

    const cp = await prisma.courseProgress.findUnique({ where: { enrollmentId } })
    expect(cp!.completedCount).toBe(1)
    expect(cp!.totalLessons).toBe(1)
    expect(cp!.percentage).toBe(100)
  })

  it('suppression du module entier (avec L1) → LessonProgress supprimé, totalLessons = 0, percentage = 0', async () => {
    const r = await deleteModuleCore('ADMIN', modId)
    expect(r.success).toBe(true)

    const lp = await prisma.lessonProgress.findFirst({ where: { lessonId: lessonIds[0] } })
    expect(lp).toBeNull()

    const cp = await prisma.courseProgress.findUnique({ where: { enrollmentId } })
    expect(cp!.totalLessons).toBe(0)
    expect(cp!.completedCount).toBe(0)
    expect(cp!.percentage).toBe(0)
  })

  afterAll(async () => {
    await prisma.lessonProgress.deleteMany({ where: { enrollmentId } })
    await prisma.courseProgress.deleteMany({ where: { enrollmentId } })
    await prisma.enrollment.delete({ where: { id: enrollmentId } })
    // Le module a déjà été supprimé par le test
  })
})
