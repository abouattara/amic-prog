import { auth } from '@/lib/auth'
import Link from 'next/link'
import { BookOpen, Award, Clock } from 'lucide-react'
import { getUserEnrollments } from '@/features/courses/queries'

export const metadata = { title: 'Tableau de bord' }

export default async function DashboardPage() {
  const session = await auth()
  const enrollments = await getUserEnrollments(session!.user.id)

  const completed = enrollments.filter((e) => e.courseProgress?.completedAt)
  const inProgress = enrollments.filter((e) => !e.courseProgress?.completedAt)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">
        Bonjour, {session!.user.name?.split(' ')[0]} 👋
      </h1>
      <p className="mt-1 text-gray-500">Voici votre tableau de bord de formation.</p>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatCard icon={<BookOpen className="h-5 w-5 text-blue-600" />} label="Formations" value={enrollments.length} />
        <StatCard icon={<Clock className="h-5 w-5 text-orange-500" />} label="En cours" value={inProgress.length} />
        <StatCard icon={<Award className="h-5 w-5 text-green-500" />} label="Terminées" value={completed.length} />
      </div>

      {/* Recent */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Continuer mes formations</h2>
          <Link href="/dashboard/formations" className="text-sm text-blue-600 hover:text-blue-800">Voir tout →</Link>
        </div>
        <div className="mt-4 space-y-3">
          {inProgress.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white py-10 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-2 text-gray-500">Vous n&apos;êtes inscrit à aucune formation.</p>
              <Link href="/formations" className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Explorer les formations
              </Link>
            </div>
          ) : (
            inProgress.slice(0, 3).map((e) => (
              <Link
                key={e.id}
                href={`/dashboard/formations/${e.course.slug}`}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
              >
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-blue-50 flex items-center justify-center">
                  {e.course.thumbnailUrl ? (
                    <img src={e.course.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <BookOpen className="h-6 w-6 text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-gray-900">{e.course.title}</p>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200">
                    <div
                      className="h-1.5 rounded-full bg-blue-600"
                      style={{ width: `${e.courseProgress?.percentage ?? 0}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {Math.round(e.courseProgress?.percentage ?? 0)}% complété
                  </p>
                </div>
                <span className="text-sm text-blue-600">→</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      {icon}
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  )
}
