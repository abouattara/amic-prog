import Link from 'next/link'
import { auth } from '@/lib/auth'
import { logoutAction } from '@/features/auth/actions'
import { BookOpen, Menu } from 'lucide-react'

export default async function PublicHeader() {
  const session = await auth()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-blue-600">
          <BookOpen className="h-6 w-6" />
          <span className="text-lg">Amic-Academia</span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          <Link href="/formations" className="hover:text-blue-600 transition-colors">
            Formations
          </Link>
          <Link href="/#apropos" className="hover:text-blue-600 transition-colors">
            À propos
          </Link>
          <Link href="/#contact" className="hover:text-blue-600 transition-colors">
            Contact
          </Link>
        </nav>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Mon espace
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Déconnexion
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Connexion
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                S&apos;inscrire
              </Link>
            </>
          )}
        </div>

        {/* Mobile burger placeholder */}
        <button className="md:hidden p-2 text-gray-500 hover:text-gray-700" aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
