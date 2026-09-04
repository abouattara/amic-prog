import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BookOpen, Home, Bell, LogOut, User, CreditCard, Award } from 'lucide-react'
import { logoutAction } from '@/features/auth/actions'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  })

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-56 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="flex h-16 items-center border-b border-gray-200 px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-blue-600 text-sm">
            <BookOpen className="h-5 w-5" />
            Amic-Academia
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          <SidebarLink href="/dashboard" icon={<Home className="h-4 w-4" />}>
            Tableau de bord
          </SidebarLink>
          <SidebarLink href="/dashboard/formations" icon={<BookOpen className="h-4 w-4" />}>
            Mes formations
          </SidebarLink>
          <SidebarLinkWithBadge
            href="/dashboard/notifications"
            icon={<Bell className="h-4 w-4" />}
            badge={unreadCount}
          >
            Notifications
          </SidebarLinkWithBadge>
          <SidebarLink href="/dashboard/paiements" icon={<CreditCard className="h-4 w-4" />}>
            Paiements
          </SidebarLink>
          <SidebarLink href="/dashboard/certificats" icon={<Award className="h-4 w-4" />}>
            Certificats
          </SidebarLink>
          <SidebarLink href="/dashboard/profil" icon={<User className="h-4 w-4" />}>
            Mon profil
          </SidebarLink>
        </nav>
        <div className="border-t border-gray-200 p-3">
          <div className="mb-2 px-2 text-xs text-gray-500">
            {session.user.name}
          </div>
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

      {/* Main */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex h-14 items-center border-b border-gray-200 bg-white px-4 md:hidden">
          <Link href="/" className="flex items-center gap-2 font-bold text-blue-600 text-sm">
            <BookOpen className="h-5 w-5" />
            Amic-Academia
          </Link>
        </header>
        <main className="flex-1 bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  )
}

function SidebarLink({
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

function SidebarLinkWithBadge({
  href,
  icon,
  badge,
  children,
}: {
  href: string
  icon: React.ReactNode
  badge: number
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
    >
      <span className="relative">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className="flex-1">{children}</span>
      {badge > 0 && (
        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-600">
          {badge}
        </span>
      )}
    </Link>
  )
}
