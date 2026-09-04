import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getQuizAttemptSummary } from '@/features/quiz/core'
import QuizForm from './QuizForm'

export const metadata = { title: 'Quiz' }

export default async function QuizPage({
  params,
}: {
  params: Promise<{ slug: string; quizId: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { slug, quizId } = await params

  // Charger quiz + questions + options (isCorrect lu uniquement côté serveur)
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { position: 'asc' },
        include: { options: { orderBy: { position: 'asc' } } },
      },
    },
  })
  if (!quiz) notFound()

  // Vérifier enrollment (FORBIDDEN si absent)
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: quiz.courseId } },
    select: { id: true },
  })
  if (!enrollment) redirect(`/formations/${slug}`)

  const attempts = await getQuizAttemptSummary(session.user.id, quizId)
  const alreadyPassed = attempts.some((a) => a.passed)
  const attemptsUsed = attempts.length
  const canAttempt = !alreadyPassed && attemptsUsed < quiz.maxAttempts

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Retour */}
      <Link
        href={`/dashboard/formations/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-6"
      >
        <ChevronLeft className="h-4 w-4" /> Retour à la formation
      </Link>

      {/* En-tête quiz */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
        {quiz.description && <p className="mt-1 text-gray-500">{quiz.description}</p>}
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
          <span>{quiz.questions.length} question{quiz.questions.length > 1 ? 's' : ''}</span>
          <span>Score requis : {quiz.passingScore}%</span>
          <span>
            Tentatives : {attemptsUsed}/{quiz.maxAttempts}
          </span>
        </div>
      </div>

      {/* Historique des tentatives */}
      {attempts.length > 0 && (
        <div className="mb-6 space-y-2">
          <p className="text-sm font-medium text-gray-600">Tentatives précédentes :</p>
          {attempts.map((a, i) => (
            <div
              key={a.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-2 text-sm ${
                a.passed ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
              }`}
            >
              <span className="text-gray-700">Tentative {attempts.length - i}</span>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900">{a.score}%</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    a.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}
                >
                  {a.passed ? 'Réussi' : 'Échoué'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* État bloqué */}
      {alreadyPassed && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-lg font-semibold text-green-800">🎉 Quiz réussi !</p>
          <p className="mt-1 text-sm text-green-600">
            Vous avez validé ce quiz avec un score de{' '}
            {attempts.find((a) => a.passed)?.score}%.
          </p>
        </div>
      )}

      {!alreadyPassed && !canAttempt && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-lg font-semibold text-red-800">Tentatives épuisées</p>
          <p className="mt-1 text-sm text-red-600">
            Vous avez atteint le nombre maximum de tentatives ({quiz.maxAttempts}).
          </p>
        </div>
      )}

      {/* Formulaire quiz */}
      {canAttempt && <QuizForm quiz={quiz} attemptsUsed={attemptsUsed} />}
    </div>
  )
}
