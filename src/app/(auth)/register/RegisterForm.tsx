'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { registerAction } from '@/features/auth/actions'

export default function RegisterForm() {
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await registerAction(data)
      if (!result.success) {
        setError(result.error ?? null)
        setFieldErrors(result.fieldErrors ?? {})
      } else {
        router.push('/login?registered=1')
      }
    })
  }

  const fe = (key: string) => fieldErrors[key]?.[0]

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">Prénom</label>
          <input
            id="firstName" name="firstName" type="text" autoComplete="given-name" required minLength={2}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          {fe('firstName') && <p className="mt-1 text-xs text-red-600">{fe('firstName')}</p>}
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Nom</label>
          <input
            id="lastName" name="lastName" type="text" autoComplete="family-name" required minLength={2}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          {fe('lastName') && <p className="mt-1 text-xs text-red-600">{fe('lastName')}</p>}
        </div>
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
        <input
          id="email" name="email" type="email" autoComplete="email" required
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {fe('email') && <p className="mt-1 text-xs text-red-600">{fe('email')}</p>}
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Mot de passe</label>
        <input
          id="password" name="password" type="password" autoComplete="new-password" required minLength={8}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-400">Minimum 8 caractères</p>
        {fe('password') && <p className="mt-1 text-xs text-red-600">{fe('password')}</p>}
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirmer le mot de passe</label>
        <input
          id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {fe('confirmPassword') && <p className="mt-1 text-xs text-red-600">{fe('confirmPassword')}</p>}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {isPending ? 'Création...' : 'Créer mon compte'}
      </button>
    </form>
  )
}
