'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'

function isAdmin(role?: string) {
  return role === 'ADMIN' || role === 'INSTRUCTOR'
}

const CategorySchema = z.object({
  name: z.string().min(2, 'Nom requis (min 2 caractères)'),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'Slug invalide (lettres minuscules, chiffres, tirets)'),
  description: z.string().optional(),
})

export async function createCategoryAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) return { success: false, error: 'Non autorisé.' }

  const parsed = CategorySchema.safeParse({
    name: formData.get('name') ?? '',
    slug: formData.get('slug') ?? '',
    description: (formData.get('description') as string) || undefined,
  })
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }

  const existing = await prisma.courseCategory.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true },
  })
  if (existing) return { success: false, fieldErrors: { slug: ['Ce slug est déjà utilisé.'] } }

  const cat = await prisma.courseCategory.create({ data: parsed.data })
  revalidatePath('/admin/categories')
  revalidatePath('/formations')
  return { success: true, data: { id: cat.id } }
}

export async function updateCategoryAction(
  categoryId: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) return { success: false, error: 'Non autorisé.' }

  const parsed = CategorySchema.safeParse({
    name: formData.get('name') ?? '',
    slug: formData.get('slug') ?? '',
    description: (formData.get('description') as string) || undefined,
  })
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }

  const conflict = await prisma.courseCategory.findFirst({
    where: { slug: parsed.data.slug, NOT: { id: categoryId } },
    select: { id: true },
  })
  if (conflict) return { success: false, fieldErrors: { slug: ['Ce slug est déjà utilisé.'] } }

  await prisma.courseCategory.update({ where: { id: categoryId }, data: parsed.data })
  revalidatePath('/admin/categories')
  revalidatePath('/formations')
  return { success: true }
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') return { success: false, error: 'Non autorisé.' }

  try {
    await prisma.courseCategory.delete({ where: { id: categoryId } })
    revalidatePath('/admin/categories')
    revalidatePath('/formations')
    return { success: true }
  } catch {
    return {
      success: false,
      error: 'Impossible de supprimer : des formations référencent cette catégorie.',
    }
  }
}
