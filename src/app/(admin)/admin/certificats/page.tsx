import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ExternalLink } from 'lucide-react'

export const metadata = { title: 'Certificats - Admin' }

export default async function AdminCertificatesPage() {
  const certificates = await prisma.certificate.findMany({
    orderBy: { issuedAt: 'desc' },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      course: { select: { title: true } },
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Certificats</h1>
        <span className="text-sm text-gray-500">{certificates.length} certificat{certificates.length > 1 ? 's' : ''}</span>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Numéro</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Apprenant</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Formation</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Délivré le</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {certificates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Aucun certificat
                </td>
              </tr>
            ) : (
              certificates.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.certificateNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {c.user.firstName} {c.user.lastName}
                    </div>
                    <div className="text-xs text-gray-400">{c.user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.course.title}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(c.issuedAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/verify/${c.certificateNumber}`}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                      target="_blank"
                    >
                      Vérifier <ExternalLink className="h-3 w-3" />
                    </Link>
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
