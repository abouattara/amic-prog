import { prisma } from '@/lib/prisma'

/**
 * Recalcule CourseProgress pour tous les enrollments du cours.
 * Appelé après ajout/suppression d'une leçon ou d'un module.
 * N'affecte PAS completedAt — seul markLessonCompleteCore peut le positionner.
 * Ne déclenche PAS checkAndIssueCertificate — les modifications structurelles
 * (admin) ne comptent pas comme une progression étudiant.
 */
export async function recalculateCourseProgressForAll(courseId: string): Promise<void> {
  const [totalLessons, enrollments] = await Promise.all([
    prisma.lesson.count({ where: { module: { courseId } } }),
    prisma.enrollment.findMany({ where: { courseId }, select: { id: true } }),
  ])

  for (const { id: enrollmentId } of enrollments) {
    const completedCount = await prisma.lessonProgress.count({
      where: { enrollmentId, completed: true },
    })
    const percentage = totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0

    await prisma.courseProgress.upsert({
      where: { enrollmentId },
      create: { enrollmentId, completedCount, totalLessons, percentage },
      update: { completedCount, totalLessons, percentage },
      // completedAt intentionnellement préservé : les suppressions admin ne réinitialisent pas la complétion
    })
  }
}
