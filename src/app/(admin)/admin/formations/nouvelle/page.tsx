import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import CourseForm from '../_components/CourseForm'

export const metadata = { title: 'Nouvelle formation - Admin' }

export default async function NewCoursePage() {
  const categories = await prisma.courseCategory.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  })

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link
          href="/admin/formations"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"
        >
          <ChevronLeft className="h-4 w-4" /> Retour aux formations
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Nouvelle formation</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <CourseForm mode="create" categories={categories} />
      </div>
    </div>
  )
}
