import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'

export const metadata = { title: 'Paiements - Admin' }

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente',
  SUCCESS: 'Réussi',
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

export default async function AdminPaymentsPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      items: { include: { course: { select: { title: true } } } },
    },
  })

  const totalRevenue = orders
    .filter((o) => o.status === 'SUCCESS')
    .reduce((acc, o) => acc + o.totalAmount, 0)

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{formatPrice(totalRevenue)}</div>
          <div className="text-xs text-gray-400">revenu total confirmé</div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Client</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Formation</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Montant</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Statut</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Aucun paiement
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {o.user.firstName} {o.user.lastName}
                    </div>
                    <div className="text-xs text-gray-400">{o.user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {o.items.map((i) => i.course.title).join(', ')}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {formatPrice(o.totalAmount, o.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[o.status]}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(o.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
