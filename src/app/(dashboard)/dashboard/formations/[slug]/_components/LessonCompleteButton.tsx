'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { markLessonComplete } from '@/features/progress/actions'

interface Props {
  lessonId: string
  isCompleted: boolean
}

export default function LessonCompleteButton({ lessonId, isCompleted }: Props) {
  const [done, setDone] = useState(isCompleted)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleClick = () => {
    if (done || isPending) return
    startTransition(async () => {
      const result = await markLessonComplete(lessonId)
      if (result.success) {
        setDone(true)
        router.refresh() // rafraîchit la barre de progression dans la sidebar
      }
    })
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
        <CheckCircle className="h-4 w-4" /> Leçon terminée
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
    >
      <CheckCircle className="h-4 w-4" />
      {isPending ? 'Enregistrement...' : 'Marquer comme terminé'}
    </button>
  )
}
