import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { recalculateCourseProgressForAll } from './recalculate-progress'
import type { ActionResult } from '@/types'

function isAdmin(role: string): boolean {
  return role === 'ADMIN' || role === 'INSTRUCTOR'
}

const LessonSchema = z.object({
  title: z.string().min(2, 'Titre requis (min 2 caractères)'),
  type: z.enum(['VIDEO', 'DOCUMENT', 'TEXT', 'QUIZ']),
  description: z.string().optional(),
  isFree: z.boolean().default(false),
})

export type LessonInput = {
  title: string
  type: string
  description?: string
  isFree?: boolean
}

export async function createLessonCore(
  userRole: string,
  moduleId: string,
  input: LessonInput,
): Promise<ActionResult<{ id: string; courseId: string }>> {
  if (!isAdmin(userRole)) return { success: false, error: 'Non autorisé.' }

  const parsed = LessonSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const mod = await prisma.courseModule.findUnique({
    where: { id: moduleId },
    select: { courseId: true },
  })
  if (!mod) return { success: false, error: 'Module introuvable.' }

  const last = await prisma.lesson.findFirst({
    where: { moduleId },
    orderBy: { position: 'desc' },
    select: { position: true },
  })
  const position = (last?.position ?? 0) + 1

  const lesson = await prisma.lesson.create({
    data: {
      moduleId,
      title: parsed.data.title,
      type: parsed.data.type,
      description: parsed.data.description || null,
      isFree: parsed.data.isFree ?? false,
      position,
    },
  })

  // Recalcule totalLessons (augmente) pour tous les enrollments
  await recalculateCourseProgressForAll(mod.courseId)

  return { success: true, data: { id: lesson.id, courseId: mod.courseId } }
}

export async function updateLessonCore(
  userRole: string,
  lessonId: string,
  input: LessonInput,
): Promise<ActionResult<{ courseId: string }>> {
  if (!isAdmin(userRole)) return { success: false, error: 'Non autorisé.' }

  const parsed = LessonSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  })
  if (!lesson) return { success: false, error: 'Leçon introuvable.' }

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      title: parsed.data.title,
      type: parsed.data.type,
      description: parsed.data.description || null,
      isFree: parsed.data.isFree ?? false,
    },
  })

  return { success: true, data: { courseId: lesson.module.courseId } }
}

export async function deleteLessonCore(
  userRole: string,
  lessonId: string,
): Promise<ActionResult<{ courseId: string }>> {
  if (!isAdmin(userRole)) return { success: false, error: 'Non autorisé.' }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  })
  if (!lesson) return { success: false, error: 'Leçon introuvable.' }

  const courseId = lesson.module.courseId

  // LessonProgress n'a pas de onDelete: Cascade sur Lesson — suppression manuelle
  await prisma.lessonProgress.deleteMany({ where: { lessonId } })
  await prisma.lesson.delete({ where: { id: lessonId } })

  // Recalcule totalLessons + completedCount pour tous les enrollments
  // completedAt préservé — les suppressions admin ne déclenchent pas de certificat
  await recalculateCourseProgressForAll(courseId)

  return { success: true, data: { courseId } }
}

export async function moveLessonCore(
  userRole: string,
  lessonId: string,
  direction: 'up' | 'down',
): Promise<ActionResult<{ courseId: string }>> {
  if (!isAdmin(userRole)) return { success: false, error: 'Non autorisé.' }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  })
  if (!lesson) return { success: false, error: 'Leçon introuvable.' }

  const neighbor = await prisma.lesson.findFirst({
    where: {
      moduleId: lesson.moduleId,
      position: direction === 'up' ? { lt: lesson.position } : { gt: lesson.position },
    },
    orderBy: { position: direction === 'up' ? 'desc' : 'asc' },
    select: { id: true, position: true },
  })
  if (!neighbor) return { success: true, data: { courseId: lesson.module.courseId } }

  await prisma.$transaction(async (tx) => {
    await tx.lesson.update({ where: { id: lessonId }, data: { position: -lesson.position } })
    await tx.lesson.update({ where: { id: neighbor.id }, data: { position: lesson.position } })
    await tx.lesson.update({ where: { id: lessonId }, data: { position: neighbor.position } })
  })

  return { success: true, data: { courseId: lesson.module.courseId } }
}
