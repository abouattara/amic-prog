'use client'

import { useState, useTransition } from 'react'
import { forgotPasswordAction } from '@/features/auth/actions'

export default function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await forgotPasswordAction(data)
      if (result.success) setSent(true)
      else setError(result.error ?? 'Une erreur est survenue.')
    })
  }

  if (sent) {
    return (
      <div className="mt-6 rounded-lg bg-green-50 px-4 py-4 text-sm text-green-700">
        Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Adresse email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {isPending ? 'Envoi...' : 'Envoyer le lien'}
      </button>
    </form>
  )
}
