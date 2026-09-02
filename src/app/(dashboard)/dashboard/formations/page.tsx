import { auth } from '@/lib/auth'
import Link from 'next/link'
import { BookOpen, Award, CheckCircle } from 'lucide-react'
import { getUserEnrollments } from '@/features/courses/queries'

export const metadata = { title: 'Mes formations' }

export default async function MyFormationsPage() {
  const session = await auth()
  const enrollments = await getUserEnrollments(session!.user.id)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Mes formations</h1>
      <p className="mt-1 text-gray-500">{enrollments.length} formation{enrollments.length > 1 ? 's' : ''} au total</p>

      {enrollments.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 text-gray-500">Vous n&apos;êtes inscrit à aucune formation.</p>
          <Link href="/formations" className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            Explorer le catalogue
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((e) => {
            const progress = e.courseProgress?.percentage ?? 0
            const isCompleted = !!e.courseProgress?.completedAt

            return (
              <Link
                key={e.id}
                href={`/dashboard/formations/${e.course.slug}`}
                className="group block rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow"
              >
                <div className="h-36 w-full overflow-hidden rounded-t-xl bg-blue-50 flex items-center justify-center">
                  {e.course.thumbnailUrl ? (
                    <img src={e.course.thumbnailUrl} alt={e.course.title} className="h-full w-full object-cover" />
                  ) : (
                    <BookOpen className="h-10 w-10 text-blue-300" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-700 transition-colors">
                      {e.course.title}
                    </h2>
                    {isCompleted && <Award className="h-5 w-5 flex-shrink-0 text-yellow-500" />}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    par {e.course.instructor.firstName} {e.course.instructor.lastName}
                  </p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{Math.round(progress)}% complété</span>
                      {isCompleted && (
                        <span className="flex items-center gap-0.5 text-green-600 font-medium">
                          <CheckCircle className="h-3.5 w-3.5" /> Terminé
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-200">
                      <div
                        className={`h-1.5 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-blue-600'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
