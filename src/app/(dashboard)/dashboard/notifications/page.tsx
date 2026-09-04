import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Bell, CheckCheck } from 'lucide-react'
import {
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from '@/features/notifications/actions'

export const metadata = { title: 'Notifications' }

const EVENT_LABELS: Record<string, string> = {
  ACCOUNT_CREATED: '🎉 Compte',
  PAYMENT_SUCCESS: '💳 Paiement',
  COURSE_ACCESS_GRANTED: '📚 Accès formation',
  NEW_COURSE: '✨ Nouvelle formation',
  QUIZ_PASSED: '✅ Quiz réussi',
  CERTIFICATE_AVAILABLE: '🏆 Certificat',
}

export default async function NotificationsPage() {
  const session = await auth()
  const notifications = await prisma.notification.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsAsReadAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Tout marquer comme lu
            </button>
          </form>
        )}
      </div>

      <div className="space-y-2">
        {notifications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
            <Bell className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-gray-500">Aucune notification pour le moment.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border p-4 bg-white transition-colors ${
                n.read ? 'border-gray-200' : 'border-blue-200 bg-blue-50/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <Bell
                  className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                    n.read ? 'text-gray-400' : 'text-blue-600'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400">
                      {EVENT_LABELS[n.event] ?? n.event}
                    </span>
                    {!n.read && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <p className="font-medium text-gray-900 text-sm mt-0.5">{n.title}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{n.body}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-gray-400">
                      {new Date(n.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {!n.read && (
                      <form action={markNotificationAsReadAction.bind(null, n.id)}>
                        <button
                          type="submit"
                          className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          Marquer comme lu
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
