import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { logoutAction } from '@/features/auth/actions'
import {
  BookOpen,
  Users,
  LayoutDashboard,
  CreditCard,
  Award,
  Settings,
  LogOut,
} from 'lucide-react'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'ADMIN' && session.user.role !== 'INSTRUCTOR') {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-4">
          <LayoutDashboard className="h-5 w-5 text-blue-600" />
          <span className="font-bold text-gray-800 text-sm">Admin</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <AdminLink href="/admin" icon={<LayoutDashboard className="h-4 w-4" />}>
            Tableau de bord
          </AdminLink>
          <AdminLink href="/admin/formations" icon={<BookOpen className="h-4 w-4" />}>
            Formations
          </AdminLink>
          <AdminLink href="/admin/utilisateurs" icon={<Users className="h-4 w-4" />}>
            Utilisateurs
          </AdminLink>
          <AdminLink href="/admin/paiements" icon={<CreditCard className="h-4 w-4" />}>
            Paiements
          </AdminLink>
          <AdminLink href="/admin/certificats" icon={<Award className="h-4 w-4" />}>
            Certificats
          </AdminLink>
          <AdminLink href="/admin/parametres" icon={<Settings className="h-4 w-4" />}>
            Paramètres
          </AdminLink>
        </nav>
        <div className="border-t border-gray-200 p-3">
          <div className="mb-2 px-2 text-xs text-gray-500">{session.user.name}</div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <LogOut className="h-4 w-4" /> Déconnexion
            </button>
          </form>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-gray-200 bg-white px-6">
          <Link href="/" className="text-xs text-gray-400 hover:text-blue-600">
            ← Retour au site
          </Link>
        </header>
        <main className="flex-1 bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  )
}

function AdminLink({
  href,
  icon,
  children,
}: {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
    >
      {icon}
      {children}
    </Link>
  )
}
