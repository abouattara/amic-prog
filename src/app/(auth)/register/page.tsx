import Link from 'next/link'
import RegisterForm from './RegisterForm'

export const metadata = { title: 'Créer un compte' }

export default function RegisterPage() {
  return (
    <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-900">Créer un compte</h1>
      <p className="mt-1 text-sm text-gray-500">Rejoignez Amic-Academia gratuitement</p>
      <RegisterForm />
      <p className="mt-5 text-center text-sm text-gray-500">
        Déjà inscrit ?{' '}
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-800">
          Se connecter
        </Link>
      </p>
    </div>
  )
}
