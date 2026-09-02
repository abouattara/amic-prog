import Link from 'next/link'
import { BookOpen } from 'lucide-react'

export default function PublicFooter() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-bold text-blue-600">
              <BookOpen className="h-5 w-5" />
              <span>Amic-Academia</span>
            </Link>
            <p className="mt-2 text-xs text-gray-500">
              Votre partenaire de formation en ligne en Afrique francophone.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Plateforme</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li><Link href="/formations" className="hover:text-blue-600">Catalogue</Link></li>
              <li><Link href="/login" className="hover:text-blue-600">Connexion</Link></li>
              <li><Link href="/register" className="hover:text-blue-600">S&apos;inscrire</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Informations</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li><Link href="/#apropos" className="hover:text-blue-600">À propos</Link></li>
              <li><Link href="/#contact" className="hover:text-blue-600">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Légal</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li><span className="cursor-default">Conditions d&apos;utilisation</span></li>
              <li><span className="cursor-default">Politique de confidentialité</span></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Amic-Academia / Amic-Multi-Services. Tous droits réservés.
        </div>
      </div>
    </footer>
  )
}
