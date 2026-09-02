import { CheckCircle, XCircle, Award } from 'lucide-react'
import { prisma } from '@/lib/prisma'

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ certificateNumber: string }>
}) {
  const { certificateNumber } = await params
  const certificate = await prisma.certificate.findUnique({
    where: { certificateNumber },
    include: {
      user: { select: { firstName: true, lastName: true } },
      course: { select: { title: true, instructor: { select: { firstName: true, lastName: true } } } },
    },
  })

  const learnerName = certificate
    ? `${certificate.user.firstName} ${certificate.user.lastName}`.trim()
    : ''
  const instructorName = certificate
    ? `${certificate.course.instructor.firstName} ${certificate.course.instructor.lastName}`.trim()
    : ''

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      {certificate ? (
        <>
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Certificat valide</h1>
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-6 text-left space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-gray-800">Certificat #{certificate.certificateNumber}</span>
            </div>
            <Row label="Apprenant" value={learnerName || 'N/A'} />
            <Row label="Formation" value={certificate.course.title} />
            <Row label="Formateur" value={instructorName || 'N/A'} />
            <Row
              label="Délivré le"
              value={new Date(certificate.issuedAt).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            />
          </div>
          <p className="mt-4 text-xs text-gray-400">Vérifié sur Amic-Academia</p>
        </>
      ) : (
        <>
          <XCircle className="mx-auto h-16 w-16 text-red-400" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Certificat introuvable</h1>
          <p className="mt-2 text-gray-500">
            Le numéro <code className="bg-gray-100 px-1 rounded">{certificateNumber}</code> ne
            correspond à aucun certificat valide dans notre système.
          </p>
        </>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  )
}
