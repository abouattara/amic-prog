'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteCourseAction } from '@/features/courses/actions'

export default function DeleteCourseButton({ courseId }: { courseId: string }) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!confirm('Supprimer cette formation ? Cette action est irréversible.')) return
    startTransition(() => deleteCourseAction(courseId))
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {isPending ? 'Suppression...' : 'Supprimer'}
    </button>
  )
}
