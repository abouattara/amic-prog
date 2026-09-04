import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCourseBySlug, checkEnrollment } from '@/features/courses/queries'
import { prisma } from '@/lib/prisma'
import { PlayCircle, FileText, CheckCircle, Award, HelpCircle, Download } from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import Link from 'next/link'
import LessonCompleteButton from './_components/LessonCompleteButton'
import { getSignedLessonUrl } from '@/features/media/signed-url-core'

export default async function CoursePlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ lecon?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { slug } = await params
  const sp = await searchParams

  const result = await getCourseBySlug(slug, session.user.id)
  if (!result) notFound()

  const { course } = result
  const isEnrolled = await checkEnrollment(session.user.id, course.id)
  if (!isEnrolled) redirect(`/formations/${slug}`)

  // Find enrollment + lesson progress
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
    include: {
      progress: { select: { lessonId: true, completed: true } },
      courseProgress: true,
    },
  })

  const allLessons = course.modules.flatMap((m) => m.lessons)
  const completedIds = new Set(
    enrollment?.progress.filter((p) => p.completed).map((p) => p.lessonId) ?? [],
  )

  // Active lesson (full details fetched separately)
  const activeLessonId = sp.lecon ?? allLessons[0]?.id
  const activeLesson = activeLessonId
    ? await prisma.lesson.findUnique({
        where: { id: activeLessonId },
        include: { video: true },
      })
    : null

  // Generate short-lived signed URL for media access (VIDEO / DOCUMENT)
  const signedMedia =
    activeLesson && (activeLesson.type === 'VIDEO' || activeLesson.type === 'DOCUMENT')
      ? await getSignedLessonUrl(activeLesson.id, session.user.id)
      : null

  // Quizzes du cours (pour la sidebar)
  const quizzes = await prisma.quiz.findMany({
    where: { courseId: course.id },
    select: { id: true, title: true },
    orderBy: { createdAt: 'asc' },
  })

  const certificate = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
    select: { certificateNumber: true },
  })

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-72 flex-col border-r border-gray-200 bg-white lg:flex overflow-y-auto">
        <div className="border-b border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 line-clamp-2 text-sm">{course.title}</h2>
          <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200">
            <div
              className="h-1.5 rounded-full bg-blue-600"
              style={{ width: `${enrollment?.courseProgress?.percentage ?? 0}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {Math.round(enrollment?.courseProgress?.percentage ?? 0)}% complété
          </p>
        </div>

        {certificate && (
          <div className="border-b border-gray-200 p-4">
            <Link
              href={`/verify/${certificate.certificateNumber}`}
              className="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-100"
            >
              <Award className="h-4 w-4" /> Voir mon certificat
            </Link>
          </div>
        )}

        <div className="flex-1 space-y-3 p-3">
          {course.modules.map((mod) => (
            <div key={mod.id}>
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                {mod.title}
              </p>
              <ul className="space-y-0.5">
                {mod.lessons.map((lesson) => {
                  const isCompleted = completedIds.has(lesson.id)
                  const isActive = lesson.id === activeLesson?.id
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={`/dashboard/formations/${slug}?lecon=${lesson.id}`}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {lesson.type === 'VIDEO' ? (
                          <PlayCircle className="h-3.5 w-3.5 flex-shrink-0" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                        )}
                        <span className="flex-1 line-clamp-2 leading-tight">{lesson.title}</span>
                        {isCompleted && (
                          <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {quizzes.length > 0 && (
            <div className="border-t border-gray-100 mt-3 pt-3">
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                Quiz
              </p>
              <ul className="space-y-0.5">
                {quizzes.map((quiz) => (
                  <li key={quiz.id}>
                    <Link
                      href={`/dashboard/formations/${slug}/quiz/${quiz.id}`}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <HelpCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="flex-1 line-clamp-2 leading-tight">{quiz.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>

      {/* Player area */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-gray-50">
        {activeLesson ? (
          <>
            {/* Video player */}
            {activeLesson.type === 'VIDEO' && (
              <div className="bg-black aspect-video w-full">
                {signedMedia ? (
                  <video
                    key={signedMedia.url}
                    src={signedMedia.url}
                    controls
                    controlsList="nodownload"
                    className="w-full h-full"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-white">
                    <div>
                      <PlayCircle className="mx-auto h-16 w-16 opacity-40" />
                      <p className="mt-2 text-sm opacity-50">
                        {activeLesson.video ? 'Erreur de lecture' : 'Aucune vidéo uploadée'}
                      </p>
                      {activeLesson.video?.duration && (
                        <p className="text-xs opacity-30 mt-1">{formatDuration(activeLesson.video.duration)}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Document viewer */}
            {activeLesson.type === 'DOCUMENT' && signedMedia && (
              <div className="border-b border-gray-200 bg-gray-100 p-4 flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-500 flex-shrink-0" />
                <a
                  href={signedMedia.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" />
                  Ouvrir le document PDF
                </a>
                <span className="text-xs text-gray-400">
                  Lien valide {Math.round((signedMedia.expiresAt.getTime() - Date.now()) / 60000)} min
                </span>
              </div>
            )}
            <div className="p-6">
              <h1 className="text-xl font-bold text-gray-900">{activeLesson.title}</h1>
              {activeLesson.description && (
                <p className="mt-2 text-gray-600">{activeLesson.description}</p>
              )}
              {/* Marquer comme terminé */}
              <div className="mt-6">
                <LessonCompleteButton
                  lessonId={activeLesson.id}
                  isCompleted={completedIds.has(activeLesson.id)}
                />
              </div>

              {/* Navigation */}
              <div className="mt-4 flex gap-3">
                {(() => {
                  const idx = allLessons.findIndex((l) => l.id === activeLesson.id)
                  const prev = idx > 0 ? allLessons[idx - 1] : null
                  const next = idx < allLessons.length - 1 ? allLessons[idx + 1] : null
                  return (
                    <>
                      {prev && (
                        <Link
                          href={`/dashboard/formations/${slug}?lecon=${prev.id}`}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                        >
                          ← Précédent
                        </Link>
                      )}
                      {next && (
                        <Link
                          href={`/dashboard/formations/${slug}?lecon=${next.id}`}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          Suivant →
                        </Link>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-gray-500">Sélectionnez une leçon pour commencer.</p>
          </div>
        )}
      </div>
    </div>
  )
}
