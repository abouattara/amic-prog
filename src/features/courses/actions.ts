'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ActionResult } from '@/types'

const CourseSchema = z.object({
  title: z.string().min(5, 'Titre requis (min 5 caractères)'),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, 'Slug invalide (lettres minuscules, chiffres, tirets)'),
  description: z.string().min(10, 'Description requise'),
  shortDesc: z.string().optional(),
  price: z.coerce.number().min(0, 'Prix invalide'),
  currency: z.string().default('XOF'),
  categoryId: z.string().optional(),
  level: z.string().optional(),
  language: z.string().default('fr'),
  thumbnailUrl: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED']).default('DRAFT'),
})

function isAdmin(role?: string) {
  return role === 'ADMIN' || role === 'INSTRUCTOR'
}

export async function createCourseAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) {
    return { success: false, error: 'Non autorisé.' }
  }

  const raw = Object.fromEntries(
    ['title', 'slug', 'description', 'shortDesc', 'price', 'currency', 'categoryId', 'level', 'language', 'thumbnailUrl', 'status']
      .map((k) => [k, formData.get(k) ?? '']),
  )

  const parsed = CourseSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { price, thumbnailUrl, categoryId, shortDesc, level, ...data } = parsed.data

  const slugConflict = await prisma.course.findUnique({ where: { slug: data.slug }, select: { id: true } })
  if (slugConflict) {
    return { success: false, fieldErrors: { slug: ['Ce slug est déjà utilisé.'] } }
  }

  const course = await prisma.course.create({
    data: {
      ...data,
      price: Math.round(price * 100),
      thumbnailUrl: thumbnailUrl || null,
      shortDesc: shortDesc || null,
      level: level || null,
      categoryId: categoryId || null,
      instructorId: session.user.id,
    },
  })

  revalidatePath('/admin/formations')
  return { success: true, data: { id: course.id, slug: course.slug } }
}

export async function updateCourseAction(courseId: string, formData: FormData): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) {
    return { success: false, error: 'Non autorisé.' }
  }

  const raw = Object.fromEntries(
    ['title', 'slug', 'description', 'shortDesc', 'price', 'currency', 'categoryId', 'level', 'language', 'thumbnailUrl', 'status']
      .map((k) => [k, formData.get(k) ?? '']),
  )

  const parsed = CourseSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { price, thumbnailUrl, categoryId, shortDesc, level, ...data } = parsed.data

  const slugConflict = await prisma.course.findFirst({
    where: { slug: data.slug, NOT: { id: courseId } },
    select: { id: true },
  })
  if (slugConflict) {
    return { success: false, fieldErrors: { slug: ['Ce slug est déjà utilisé.'] } }
  }

  await prisma.course.update({
    where: { id: courseId },
    data: {
      ...data,
      price: Math.round(price * 100),
      thumbnailUrl: thumbnailUrl || null,
      shortDesc: shortDesc || null,
      level: level || null,
      categoryId: categoryId || null,
    },
  })

  revalidatePath('/admin/formations')
  revalidatePath(`/admin/formations/${courseId}`)
  revalidatePath('/formations')
  return { success: true }
}

export async function deleteCourseAction(courseId: string): Promise<void> {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') return

  await prisma.course.delete({ where: { id: courseId } })
  revalidatePath('/admin/formations')
  redirect('/admin/formations')
}
