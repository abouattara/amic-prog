import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import CourseForm from '../_components/CourseForm'
import { deleteCourseAction } from '@/features/courses/actions'

export const metadata = { title: 'Éditer la formation - Admin' }

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [course, categories] = await Promise.all([
    prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        shortDesc: true,
        price: true,
        currency: true,
        categoryId: true,
        level: true,
        language: true,
        thumbnailUrl: true,
        status: true,
      },
    }),
    prisma.courseCategory.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
  ])

  if (!course) notFound()

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/admin/formations"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"
          >
            <ChevronLeft className="h-4 w-4" /> Retour aux formations
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Éditer la formation</h1>
          <p className="text-sm text-gray-400 mt-0.5">{course.title}</p>
        </div>
        <form action={deleteCourseAction.bind(null, course.id)}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            onClick={(e) => {
              if (!confirm('Supprimer cette formation ? Cette action est irréversible.')) {
                e.preventDefault()
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Supprimer
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <CourseForm mode="edit" categories={categories} course={course} />
      </div>
    </div>
  )
}
