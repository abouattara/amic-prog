import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Clock, PlayCircle, FileText, CheckCircle, Lock } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getCourseBySlug, checkEnrollment } from '@/features/courses/queries'
import { formatPrice, formatDuration } from '@/lib/utils'
import EnrollButton from './EnrollButton'

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth()
  const userId = session?.user?.id
  const { slug } = await params

  const result = await getCourseBySlug(slug, userId)
  if (!result) notFound()

  const { course } = result
  const isEnrolled = result.enrollment !== null

  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0)
  const totalDurationSec = course.modules.reduce(
    (acc, m) => acc + m.lessons.reduce((a, l) => a + (l.video?.duration ?? 0), 0),
    0,
  )
  const instructorName = `${course.instructor.firstName} ${course.instructor.lastName}`.trim()

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:grid lg:grid-cols-3 lg:gap-10">
      {/* Main */}
      <div className="lg:col-span-2">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-4">
          <Link href="/formations" className="hover:text-blue-600">Formations</Link>
          {course.category && (
            <>
              <span className="mx-1">›</span>
              <Link href={`/formations?categorie=${course.category.slug}`} className="hover:text-blue-600">
                {course.category.name}
              </Link>
            </>
          )}
          <span className="mx-1">›</span>
          <span className="text-gray-900">{course.title}</span>
        </nav>

        {course.thumbnailUrl && (
          <div className="mb-6 overflow-hidden rounded-xl">
            <img src={course.thumbnailUrl} alt={course.title} className="w-full object-cover max-h-72" />
          </div>
        )}

        <h1 className="text-3xl font-bold text-gray-900">{course.title}</h1>
        <p className="mt-3 text-lg text-gray-600">{course.shortDesc}</p>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1"><PlayCircle className="h-4 w-4" />{totalLessons} leçon{totalLessons > 1 ? 's' : ''}</span>
          {totalDurationSec > 0 && (
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{formatDuration(totalDurationSec)}</span>
          )}
          {instructorName && <span>Formateur : <strong>{instructorName}</strong></span>}
        </div>

        {/* Description */}
        {course.description && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">Description</h2>
            <div className="mt-3 prose prose-sm max-w-none text-gray-600 whitespace-pre-line">
              {course.description}
            </div>
          </div>
        )}

        {/* Programme */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900">Programme</h2>
          <div className="mt-4 space-y-3">
            {course.modules.map((mod) => (
              <div key={mod.id} className="rounded-lg border border-gray-200">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-t-lg">
                  <span className="font-medium text-gray-800">{mod.title}</span>
                  <span className="text-xs text-gray-500">{mod.lessons.length} leçon{mod.lessons.length > 1 ? 's' : ''}</span>
                </div>
                <ul>
                  {mod.lessons.map((lesson, i) => (
                    <li key={lesson.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i < mod.lessons.length - 1 ? 'border-b border-gray-100' : ''}`}>
                      {lesson.type === 'VIDEO' ? (
                        <PlayCircle className="h-4 w-4 flex-shrink-0 text-blue-500" />
                      ) : (
                        <FileText className="h-4 w-4 flex-shrink-0 text-orange-500" />
                      )}
                      <span className="flex-1 text-gray-700">{lesson.title}</span>
                      {lesson.isFree ? (
                        <span className="text-xs text-green-600 font-medium">Aperçu gratuit</span>
                      ) : !isEnrolled ? (
                        <Lock className="h-3.5 w-3.5 text-gray-400" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      )}
                      {lesson.video?.duration ? (
                        <span className="text-xs text-gray-400 w-12 text-right">{formatDuration(lesson.video.duration)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside>
        <div className="sticky top-24 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-3xl font-bold text-blue-700">
            {course.price === 0 ? 'Gratuit' : formatPrice(course.price, course.currency)}
          </div>

          {isEnrolled ? (
            <Link
              href={`/dashboard/formations/${course.slug}`}
              className="mt-4 flex w-full items-center justify-center rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 transition-colors"
            >
              Continuer la formation →
            </Link>
          ) : (
            <EnrollButton courseId={course.id} price={course.price} userId={userId} />
          )}

          <ul className="mt-5 space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" />Accès à vie</li>
            <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" />Certificat inclus</li>
            <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" />Contenu téléchargeable</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
