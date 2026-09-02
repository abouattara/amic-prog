import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import { Plus } from 'lucide-react'

export const metadata = { title: 'Formations - Admin' }

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publié',
  UNPUBLISHED: 'Non publié',
  ARCHIVED: 'Archivé',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PUBLISHED: 'bg-green-100 text-green-700',
  UNPUBLISHED: 'bg-orange-100 text-orange-700',
  ARCHIVED: 'bg-red-100 text-red-700',
}

export default async function AdminFormationsPage() {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      category: { select: { name: true } },
      instructor: { select: { firstName: true, lastName: true } },
      _count: { select: { enrollments: true } },
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Formations</h1>
        <Link
          href="/admin/formations/nouvelle"
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Nouvelle formation
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Titre</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Catégorie</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Prix</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Inscrits</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {courses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Aucune formation
                </td>
              </tr>
            ) : (
              courses.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                    <div className="truncate">{c.title}</div>
                    <div className="text-xs text-gray-400">
                      {c.instructor.firstName} {c.instructor.lastName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.category?.name ?? '—'}</td>
                  <td className="px-4 py-3 font-medium">
                    {c.price === 0 ? 'Gratuit' : formatPrice(c.price, c.currency)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c._count.enrollments}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/formations/${c.id}`}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Éditer
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
