'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { initiatePaymentAction } from '@/features/payments/actions'

interface EnrollButtonProps {
  courseId: string
  price: number
  userId: string | undefined
}

export default function EnrollButton({ courseId, price, userId }: EnrollButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleClick = () => {
    if (!userId) {
      router.push('/login')
      return
    }
    startTransition(async () => {
      const result = await initiatePaymentAction(courseId)
      if (result.success && result.data?.redirectUrl) {
        router.push(result.data.redirectUrl)
      } else if (result.success) {
        router.push('/dashboard')
      } else {
        alert(result.error ?? 'Une erreur est survenue.')
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="mt-4 flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
    >
      {isPending ? 'Chargement...' : price === 0 ? 'S\'inscrire gratuitement' : 'S\'inscrire'}
    </button>
  )
}
