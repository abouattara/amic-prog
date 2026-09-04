'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ActionResult } from '@/types'
import { notifyNewCourse } from '@/features/notifications/core'

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

  const raw = {
    title: formData.get('title') ?? '',
    slug: formData.get('slug') ?? '',
    description: formData.get('description') ?? '',
    shortDesc: formData.get('shortDesc') ?? '',
    price: formData.get('price') ?? '0',
    currency: (formData.get('currency') as string) || 'XOF',
    categoryId: formData.get('categoryId') ?? '',
    level: formData.get('level') ?? '',
    language: (formData.get('language') as string) || 'fr',
    thumbnailUrl: formData.get('thumbnailUrl') ?? '',
    status: formData.get('status') ?? 'DRAFT',
  }

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

  const raw = {
    title: formData.get('title') ?? '',
    slug: formData.get('slug') ?? '',
    description: formData.get('description') ?? '',
    shortDesc: formData.get('shortDesc') ?? '',
    price: formData.get('price') ?? '0',
    currency: (formData.get('currency') as string) || 'XOF',
    categoryId: formData.get('categoryId') ?? '',
    level: formData.get('level') ?? '',
    language: (formData.get('language') as string) || 'fr',
    thumbnailUrl: formData.get('thumbnailUrl') ?? '',
    status: formData.get('status') ?? 'DRAFT',
  }

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

  // Lire le statut courant pour détecter la transition vers PUBLISHED
  const prevCourse = await prisma.course.findUnique({
    where: { id: courseId },
    select: { status: true },
  })

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

  // NEW_COURSE : notifier les apprenants lors de la première publication
  // Choix : tous les utilisateurs avec rôle STUDENT actifs sur la plateforme.
  // try/catch isolé — un échec de notification ne bloque pas la mise à jour.
  if (prevCourse?.status !== 'PUBLISHED' && parsed.data.status === 'PUBLISHED') {
    try {
      await notifyNewCourse(courseId, parsed.data.title)
    } catch (err) {
      console.error('[Notification:NEW_COURSE]', err)
    }
  }

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
