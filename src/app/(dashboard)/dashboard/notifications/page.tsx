import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Bell } from 'lucide-react'

export const metadata = { title: 'Notifications' }

export default async function NotificationsPage() {
  const session = await auth()
  const notifications = await prisma.notification.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
      <div className="mt-6 space-y-3">
        {notifications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
            <Bell className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-gray-500">Aucune notification pour le moment.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border p-4 bg-white ${n.read ? 'border-gray-200' : 'border-blue-200 bg-blue-50/30'}`}
            >
              <div className="flex items-start gap-3">
                <Bell className={`mt-0.5 h-4 w-4 flex-shrink-0 ${n.read ? 'text-gray-400' : 'text-blue-600'}`} />
                <div>
                  <p className="font-medium text-gray-900 text-sm">{n.title}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{n.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
