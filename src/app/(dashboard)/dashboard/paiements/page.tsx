import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'

export const metadata = { title: 'Mes paiements' }

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente',
  SUCCESS: 'Confirmé',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
  REFUNDED: 'Remboursé',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  SUCCESS: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-600',
  CANCELLED: 'bg-gray-100 text-gray-600',
  REFUNDED: 'bg-purple-100 text-purple-700',
}

export default async function MyPaymentsPage() {
  const session = await auth()
  const orders = await prisma.order.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      items: { include: { course: { select: { title: true, slug: true } } } },
    },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Mes paiements</h1>
      <p className="mt-1 text-gray-500">{orders.length} commande{orders.length > 1 ? 's' : ''}</p>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-gray-500">Aucun paiement pour le moment.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {order.items.map((item) => (
                    <div key={item.id} className="font-medium text-gray-900">
                      {item.course.title}
                    </div>
                  ))}
                  <div className="mt-1 text-xs text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">
                    {formatPrice(order.totalAmount, order.currency)}
                  </div>
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[order.status]}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
