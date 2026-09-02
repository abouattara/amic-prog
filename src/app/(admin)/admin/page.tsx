import { prisma } from '@/lib/prisma'
import { BookOpen, Users, CreditCard, Award } from 'lucide-react'

export const metadata = { title: 'Administration' }

async function getStats() {
  const [users, courses, orders, certificates] = await Promise.all([
    prisma.user.count(),
    prisma.course.count({ where: { status: 'PUBLISHED' } }),
    prisma.order.count({ where: { status: 'SUCCESS' } }),
    prisma.certificate.count(),
  ])
  const revenue = await prisma.order.aggregate({
    where: { status: 'SUCCESS' },
    _sum: { totalAmount: true },
  })
  return { users, courses, orders, certificates, revenue: revenue._sum.totalAmount ?? 0 }
}

export default async function AdminDashboardPage() {
  const stats = await getStats()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5 text-blue-600" />}
          label="Utilisateurs"
          value={stats.users}
          bg="bg-blue-50"
        />
        <StatCard
          icon={<BookOpen className="h-5 w-5 text-green-600" />}
          label="Formations publiées"
          value={stats.courses}
          bg="bg-green-50"
        />
        <StatCard
          icon={<CreditCard className="h-5 w-5 text-purple-600" />}
          label="Commandes réussies"
          value={stats.orders}
          bg="bg-purple-50"
        />
        <StatCard
          icon={<Award className="h-5 w-5 text-yellow-600" />}
          label="Certificats délivrés"
          value={stats.certificates}
          bg="bg-yellow-50"
        />
      </div>
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-800">Revenu total</h2>
        <p className="mt-1 text-3xl font-bold text-gray-900">
          {new Intl.NumberFormat('fr-BF', {
            style: 'currency',
            currency: 'XOF',
            maximumFractionDigits: 0,
          }).format(stats.revenue / 100)}
        </p>
        <p className="mt-0.5 text-sm text-gray-500">via {stats.orders} commande{stats.orders > 1 ? 's' : ''} confirmée{stats.orders > 1 ? 's' : ''}</p>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode
  label: string
  value: number
  bg: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className={`inline-flex rounded-lg p-2 ${bg}`}>{icon}</div>
      <div className="mt-3 text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  )
}
