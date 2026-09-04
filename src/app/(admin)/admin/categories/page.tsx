import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CategoryManager from './_components/CategoryManager'

export const metadata = { title: 'Catégories - Admin' }

export default async function CategoriesPage() {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'INSTRUCTOR')) {
    redirect('/dashboard')
  }

  const categories = await prisma.courseCategory.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { courses: true } } },
  })

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catégories</h1>
        <p className="mt-1 text-sm text-gray-400">
          Gérez les catégories de formations. Une catégorie référencée par des formations ne peut pas être supprimée.
        </p>
      </div>
      <CategoryManager categories={categories} />
    </div>
  )
}
