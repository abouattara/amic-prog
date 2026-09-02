import Link from 'next/link'
import ForgotPasswordForm from './ForgotPasswordForm'

export const metadata = { title: 'Mot de passe oublié' }

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-bold text-gray-900">Mot de passe oublié</h1>
      <p className="mt-2 text-sm text-gray-500">
        Entrez votre email pour recevoir un lien de réinitialisation.
      </p>
      <ForgotPasswordForm />
      <p className="mt-5 text-center text-sm text-gray-500">
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
          Retour à la connexion
        </Link>
      </p>
    </div>
  )
}
