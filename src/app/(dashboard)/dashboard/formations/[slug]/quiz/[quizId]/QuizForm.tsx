'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, XCircle, ChevronRight } from 'lucide-react'
import { submitQuizAttemptAction } from '@/features/quiz/actions'
import type { QuizAnswerInput, QuizAttemptResult } from '@/features/quiz/actions'

type Option = { id: string; text: string; isCorrect: boolean; position: number }
type Question = {
  id: string
  questionText: string
  type: 'MCQ' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER'
  position: number
  points: number
  explanation: string | null
  options: Option[]
}
type QuizData = {
  id: string
  title: string
  passingScore: number
  maxAttempts: number
  questions: Question[]
}

interface Props {
  quiz: QuizData
  attemptsUsed: number
}

type Answers = Record<string, { optionIds?: string[]; answerText?: string }>

export default function QuizForm({ quiz, attemptsUsed }: Props) {
  const [answers, setAnswers] = useState<Answers>({})
  const [result, setResult] = useState<QuizAttemptResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const setOption = (qId: string, optId: string) =>
    setAnswers((prev) => ({ ...prev, [qId]: { optionIds: [optId] } }))

  const toggleMulti = (qId: string, optId: string) => {
    setAnswers((prev) => {
      const current = prev[qId]?.optionIds ?? []
      const next = current.includes(optId)
        ? current.filter((id) => id !== optId)
        : [...current, optId]
      return { ...prev, [qId]: { optionIds: next } }
    })
  }

  const setText = (qId: string, text: string) =>
    setAnswers((prev) => ({ ...prev, [qId]: { answerText: text } }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const payload: QuizAnswerInput[] = quiz.questions.map((q) => ({
      questionId: q.id,
      optionIds: answers[q.id]?.optionIds,
      answerText: answers[q.id]?.answerText,
    }))

    startTransition(async () => {
      const res = await submitQuizAttemptAction(quiz.id, payload)
      if (res.success && res.data) {
        setResult(res.data)
      } else {
        setError(res.error ?? 'Une erreur est survenue.')
      }
    })
  }

  // ── Phase résultats ───────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-6">
        {/* Score global */}
        <div
          className={`rounded-xl border p-6 text-center ${
            result.passed
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }`}
        >
          <div className="text-4xl font-bold text-gray-900">{result.score}%</div>
          <p className="mt-1 text-sm text-gray-500">
            {result.pointsEarned}/{result.pointsTotal} pts — seuil : {result.passingScore}%
          </p>
          <span
            className={`mt-3 inline-block rounded-full px-4 py-1 text-sm font-semibold ${
              result.passed
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {result.passed ? '🎉 Réussi !' : '❌ Non validé'}
          </span>
          {!result.passed && result.attemptsUsed < result.maxAttempts && (
            <p className="mt-2 text-xs text-gray-500">
              Il vous reste {result.maxAttempts - result.attemptsUsed} tentative(s).
            </p>
          )}
        </div>

        {/* Détail par question */}
        <div className="space-y-4">
          {quiz.questions.map((q, idx) => {
            const detail = result.details.find((d) => d.questionId === q.id)!
            const givenAnswer = answers[q.id]

            return (
              <div
                key={q.id}
                className={`rounded-xl border p-4 ${
                  detail.correct ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/40'
                }`}
              >
                <div className="flex items-start gap-2">
                  {detail.correct ? (
                    <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">
                      Q{idx + 1}. {q.questionText}
                      <span className="ml-2 text-xs text-gray-400">({q.points} pt{q.points > 1 ? 's' : ''})</span>
                    </p>

                    {/* Options avec indication correcte/incorrecte */}
                    {q.type !== 'SHORT_ANSWER' && (
                      <ul className="mt-2 space-y-1">
                        {q.options.map((opt) => {
                          const wasSelected =
                            q.type === 'MULTIPLE_CHOICE'
                              ? givenAnswer?.optionIds?.includes(opt.id)
                              : givenAnswer?.optionIds?.[0] === opt.id
                          return (
                            <li
                              key={opt.id}
                              className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                                opt.isCorrect
                                  ? 'bg-green-100 text-green-800 font-medium'
                                  : wasSelected
                                  ? 'bg-red-100 text-red-700'
                                  : 'text-gray-600'
                              }`}
                            >
                              <ChevronRight className="h-3 w-3 flex-shrink-0" />
                              {opt.text}
                              {opt.isCorrect && ' ✓'}
                              {wasSelected && !opt.isCorrect && ' ✗'}
                            </li>
                          )
                        })}
                      </ul>
                    )}

                    {q.type === 'SHORT_ANSWER' && (
                      <p className="mt-1 text-xs text-gray-600">
                        Votre réponse : <em>{givenAnswer?.answerText || '—'}</em>
                        {!detail.correct && (
                          <span className="ml-2 text-green-700 font-medium">
                            Réponse attendue : {q.options.find((o) => o.isCorrect)?.text}
                          </span>
                        )}
                      </p>
                    )}

                    {detail.explanation && (
                      <p className="mt-2 text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">
                        💡 {detail.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bouton refaire si tentatives restantes */}
        {!result.passed && result.attemptsUsed < result.maxAttempts && (
          <button
            onClick={() => {
              setResult(null)
              setAnswers({})
            }}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Retenter le quiz
          </button>
        )}
      </div>
    )
  }

  // ── Phase quiz ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {quiz.questions.map((q, idx) => (
        <div key={q.id} className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="font-semibold text-gray-900 text-sm mb-1">
            Q{idx + 1}/{quiz.questions.length} — {q.questionText}
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({q.points} pt{q.points > 1 ? 's' : ''})
            </span>
          </p>

          {/* MCQ / TRUE_FALSE : radio */}
          {(q.type === 'MCQ' || q.type === 'TRUE_FALSE') && (
            <div className="mt-3 space-y-2">
              {q.options.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                    answers[q.id]?.optionIds?.[0] === opt.id
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`q_${q.id}`}
                    value={opt.id}
                    className="accent-blue-600"
                    checked={answers[q.id]?.optionIds?.[0] === opt.id}
                    onChange={() => setOption(q.id, opt.id)}
                  />
                  {opt.text}
                </label>
              ))}
            </div>
          )}

          {/* MULTIPLE_CHOICE : checkboxes */}
          {q.type === 'MULTIPLE_CHOICE' && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-400 mb-2">Plusieurs réponses possibles</p>
              {q.options.map((opt) => {
                const checked = answers[q.id]?.optionIds?.includes(opt.id) ?? false
                return (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                      checked
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-blue-600"
                      checked={checked}
                      onChange={() => toggleMulti(q.id, opt.id)}
                    />
                    {opt.text}
                  </label>
                )
              })}
            </div>
          )}

          {/* SHORT_ANSWER */}
          {q.type === 'SHORT_ANSWER' && (
            <input
              type="text"
              value={answers[q.id]?.answerText ?? ''}
              onChange={(e) => setText(q.id, e.target.value)}
              placeholder="Votre réponse..."
              className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {isPending ? 'Correction en cours...' : 'Soumettre le quiz'}
      </button>

      <p className="text-center text-xs text-gray-400">
        Tentative {attemptsUsed + 1}/{quiz.maxAttempts}
      </p>
    </form>
  )
}
