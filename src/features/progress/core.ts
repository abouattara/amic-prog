import { prisma } from '@/lib/prisma'
import type { ActionResult } from '@/types'
import { checkAndIssueCertificate } from '@/features/certificates/core'

async function onCourseCompleted(userId: string, courseId: string): Promise<void> {
  await checkAndIssueCertificate(userId, courseId)
  // TODO Phase 8 : envoyer notification CERTIFICATE_AVAILABLE
}

/**
 * Marque une leçon comme terminée pour un utilisateur donné.
 * Idempotente : appels répétés ne dupliquent ni la progression ni le completedAt.
 */
export async function markLessonCompleteCore(
  userId: string,
  lessonId: string,
): Promise<ActionResult> {
  // 1. Résoudre leçon → module → cours
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, module: { select: { courseId: true } } },
  })
  if (!lesson) return { success: false, error: 'Leçon introuvable.' }

  const courseId = lesson.module.courseId

  // 2. Vérifier l'enrollment (FORBIDDEN si absent)
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  })
  if (!enrollment) return { success: false, error: 'FORBIDDEN' }

  // 3. Upsert LessonProgress — idempotent via unique(enrollmentId, lessonId)
  await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
    create: { enrollmentId: enrollment.id, lessonId, completed: true },
    update: { completed: true },
  })

  // 4. Recalculer CourseProgress
  const [completedCount, totalLessons] = await Promise.all([
    prisma.lessonProgress.count({
      where: { enrollmentId: enrollment.id, completed: true },
    }),
    prisma.lesson.count({
      where: { module: { courseId } },
    }),
  ])

  const percentage = totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0
  const isNowComplete = percentage >= 100

  // Lire l'état actuel pour ne pas écraser un completedAt déjà positionné
  const existing = await prisma.courseProgress.findUnique({
    where: { enrollmentId: enrollment.id },
    select: { completedAt: true },
  })

  await prisma.courseProgress.upsert({
    where: { enrollmentId: enrollment.id },
    create: {
      enrollmentId: enrollment.id,
      completedCount,
      totalLessons,
      percentage,
      completedAt: isNowComplete ? new Date() : null,
    },
    update: {
      completedCount,
      totalLessons,
      percentage,
      // Positionner completedAt uniquement la première fois que l'on atteint 100 %
      ...(isNowComplete && !existing?.completedAt ? { completedAt: new Date() } : {}),
    },
  })

  // 5. Déclencher le hook de complétion (une seule fois)
  if (isNowComplete && !existing?.completedAt) {
    await onCourseCompleted(userId, courseId)
  }

  return { success: true }
}
