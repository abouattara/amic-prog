import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Award, ExternalLink } from 'lucide-react'

export const metadata = { title: 'Mes certificats' }

export default async function MyCertificatesPage() {
  const session = await auth()
  const certificates = await prisma.certificate.findMany({
    where: { userId: session!.user.id },
    orderBy: { issuedAt: 'desc' },
    include: {
      course: { select: { title: true, slug: true, thumbnailUrl: true } },
    },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Mes certificats</h1>
      <p className="mt-1 text-gray-500">
        {certificates.length} certificat{certificates.length > 1 ? 's' : ''} obtenu{certificates.length > 1 ? 's' : ''}
      </p>

      {certificates.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Award className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-gray-500">Vous n&apos;avez pas encore de certificat.</p>
          <p className="mt-1 text-sm text-gray-400">Terminez une formation pour obtenir votre certificat.</p>
          <Link
            href="/formations"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Explorer les formations
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="rounded-xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50 p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Award className="h-6 w-6 text-yellow-600 flex-shrink-0" />
                <span className="text-xs font-mono text-gray-500">{cert.certificateNumber}</span>
              </div>
              <h2 className="font-semibold text-gray-900 line-clamp-2">{cert.course.title}</h2>
              <p className="mt-1 text-xs text-gray-500">
                Délivré le{' '}
                {new Date(cert.issuedAt).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/verify/${cert.certificateNumber}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yellow-600 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" /> Voir & Vérifier
                </Link>
                <Link
                  href={`/dashboard/formations/${cert.course.slug}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white transition-colors"
                >
                  Revoir la formation
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
