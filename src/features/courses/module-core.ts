import { prisma } from '@/lib/prisma'
import { recalculateCourseProgressForAll } from './recalculate-progress'
import type { ActionResult } from '@/types'

function isAdmin(role: string): boolean {
  return role === 'ADMIN' || role === 'INSTRUCTOR'
}

export async function createModuleCore(
  userRole: string,
  courseId: string,
  title: string,
): Promise<ActionResult<{ id: string }>> {
  if (!isAdmin(userRole)) return { success: false, error: 'Non autorisé.' }
  const t = title.trim()
  if (!t) return { success: false, error: 'Titre requis.' }

  const last = await prisma.courseModule.findFirst({
    where: { courseId },
    orderBy: { position: 'desc' },
    select: { position: true },
  })
  const position = (last?.position ?? 0) + 1
  const mod = await prisma.courseModule.create({ data: { courseId, title: t, position } })
  return { success: true, data: { id: mod.id } }
}

export async function updateModuleCore(
  userRole: string,
  moduleId: string,
  title: string,
): Promise<ActionResult> {
  if (!isAdmin(userRole)) return { success: false, error: 'Non autorisé.' }
  const t = title.trim()
  if (!t) return { success: false, error: 'Titre requis.' }
  await prisma.courseModule.update({ where: { id: moduleId }, data: { title: t } })
  return { success: true }
}

export async function deleteModuleCore(
  userRole: string,
  moduleId: string,
): Promise<ActionResult<{ courseId: string }>> {
  if (!isAdmin(userRole)) return { success: false, error: 'Non autorisé.' }

  const mod = await prisma.courseModule.findUnique({
    where: { id: moduleId },
    select: { courseId: true, lessons: { select: { id: true } } },
  })
  if (!mod) return { success: false, error: 'Module introuvable.' }

  const lessonIds = mod.lessons.map((l) => l.id)
  // LessonProgress n'a pas de onDelete: Cascade sur Lesson — suppression manuelle obligatoire
  if (lessonIds.length > 0) {
    await prisma.lessonProgress.deleteMany({ where: { lessonId: { in: lessonIds } } })
  }
  await prisma.courseModule.delete({ where: { id: moduleId } })
  await recalculateCourseProgressForAll(mod.courseId)

  return { success: true, data: { courseId: mod.courseId } }
}

export async function moveModuleCore(
  userRole: string,
  moduleId: string,
  direction: 'up' | 'down',
): Promise<ActionResult<{ courseId: string }>> {
  if (!isAdmin(userRole)) return { success: false, error: 'Non autorisé.' }

  const mod = await prisma.courseModule.findUnique({
    where: { id: moduleId },
    select: { courseId: true, position: true },
  })
  if (!mod) return { success: false, error: 'Module introuvable.' }

  const neighbor = await prisma.courseModule.findFirst({
    where: {
      courseId: mod.courseId,
      position: direction === 'up' ? { lt: mod.position } : { gt: mod.position },
    },
    orderBy: { position: direction === 'up' ? 'desc' : 'asc' },
    select: { id: true, position: true },
  })
  if (!neighbor) return { success: true, data: { courseId: mod.courseId } }

  // Swap avec position temporaire négative pour éviter la violation de contrainte unique
  await prisma.$transaction(async (tx) => {
    await tx.courseModule.update({ where: { id: moduleId }, data: { position: -mod.position } })
    await tx.courseModule.update({ where: { id: neighbor.id }, data: { position: mod.position } })
    await tx.courseModule.update({ where: { id: moduleId }, data: { position: neighbor.position } })
  })

  return { success: true, data: { courseId: mod.courseId } }
}
