import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import CourseForm from '../_components/CourseForm'
import DeleteCourseButton from '../_components/DeleteCourseButton'
import ModuleEditor from './_components/ModuleEditor'

export const metadata = { title: 'Éditer la formation - Admin' }

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [course, categories, modules] = await Promise.all([
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
    prisma.courseModule.findMany({
      where: { courseId: id },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        title: true,
        position: true,
        lessons: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            type: true,
            position: true,
            description: true,
            isFree: true,
            video: { select: { providerVideoId: true } },
            documents: { orderBy: { createdAt: 'desc' }, take: 1, select: { storageKey: true } },
          },
        },
      },
    }),
  ])

  if (!course) notFound()

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
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
        <DeleteCourseButton courseId={course.id} />
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold text-gray-700">Informations générales</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <CourseForm mode="edit" categories={categories} course={course} />
        </div>
      </section>

      <section>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <ModuleEditor courseId={course.id} modules={modules} />
        </div>
      </section>
    </div>
  )
}
