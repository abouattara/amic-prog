import Link from 'next/link'
import { Search } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'

interface SearchParams {
  q?: string
  categorie?: string
  page?: string
}

async function getCoursesAndCategories(sp: SearchParams) {
  const page = Math.max(1, Number(sp.page ?? 1))
  const PAGE_SIZE = 9

  const where = {
    status: 'PUBLISHED' as const,
    ...(sp.q
      ? {
          OR: [
            { title: { contains: sp.q, mode: 'insensitive' as const } },
            { shortDesc: { contains: sp.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(sp.categorie ? { category: { slug: sp.categorie } } : {}),
  }

  const [courses, total, categories] = await Promise.all([
    prisma.course.findMany({
      where,
      include: { category: true, instructor: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.course.count({ where }),
    prisma.courseCategory.findMany({ orderBy: { name: 'asc' } }),
  ])

  return { courses, total, categories, page, pageCount: Math.ceil(total / PAGE_SIZE) }
}

export default async function FormationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const { courses, total, categories, page, pageCount } = await getCoursesAndCategories(sp)

  const buildUrl = (overrides: Partial<SearchParams>) => {
    const p = new URLSearchParams()
    const merged = { q: sp.q, categorie: sp.categorie, page: String(page), ...overrides }
    if (merged.q) p.set('q', merged.q)
    if (merged.categorie) p.set('categorie', merged.categorie)
    if (merged.page && merged.page !== '1') p.set('page', merged.page)
    const qs = p.toString()
    return `/formations${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">Catalogue des formations</h1>
      <p className="mt-1 text-gray-500">{total} formation{total > 1 ? 's' : ''} disponible{total > 1 ? 's' : ''}</p>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-3">
        <form method="GET" action="/formations" className="flex flex-1 min-w-52 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              name="q"
              defaultValue={sp.q}
              placeholder="Rechercher une formation..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          {sp.categorie && <input type="hidden" name="categorie" value={sp.categorie} />}
          <button type="submit" className="ml-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            OK
          </button>
        </form>

        <div className="flex flex-wrap gap-2 items-center">
          <Link
            href={buildUrl({ categorie: undefined, page: '1' })}
            className={`rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
              !sp.categorie ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'
            }`}
          >
            Toutes
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={buildUrl({ categorie: cat.slug, page: '1' })}
              className={`rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
                sp.categorie === cat.slug ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {courses.length === 0 ? (
          <p className="col-span-3 py-16 text-center text-gray-500">Aucune formation trouvée.</p>
        ) : (
          courses.map((course) => (
            <Link
              key={course.id}
              href={`/formations/${course.slug}`}
              className="group block rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="h-44 w-full overflow-hidden rounded-t-xl bg-blue-50 flex items-center justify-center">
                {course.thumbnailUrl ? (
                  <img src={course.thumbnailUrl} alt={course.title} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl">📚</span>
                )}
              </div>
              <div className="p-4">
                {course.category && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    {course.category.name}
                  </span>
                )}
                <h2 className="mt-2 font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-700 transition-colors">
                  {course.title}
                </h2>
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">{course.shortDesc}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    par {`${course.instructor.firstName} ${course.instructor.lastName}`.trim() || 'Formateur'}
                  </span>
                  <span className="font-bold text-blue-700">
                    {course.price === 0 ? 'Gratuit' : formatPrice(course.price, course.currency)}
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="mt-10 flex justify-center gap-2">
          {page > 1 && (
            <Link href={buildUrl({ page: String(page - 1) })} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
              ← Précédent
            </Link>
          )}
          <span className="rounded-lg border bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            Page {page} / {pageCount}
          </span>
          {page < pageCount && (
            <Link href={buildUrl({ page: String(page + 1) })} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
              Suivant →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
