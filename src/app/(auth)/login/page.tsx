import Link from 'next/link'
import LoginForm from './LoginForm'

export const metadata = { title: 'Connexion' }

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-900">Connexion</h1>
      <p className="mt-1 text-sm text-gray-500">Accédez à votre espace apprenant</p>
      <LoginForm />
      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className="text-gray-500 hover:text-blue-600">
          Mot de passe oublié ?
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-gray-500">
        Pas encore de compte ?{' '}
        <Link href="/register" className="font-medium text-blue-600 hover:text-blue-800">
          S&apos;inscrire
        </Link>
      </p>
    </div>
  )
}
