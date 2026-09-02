import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Mon profil' }

export default async function ProfilPage() {
  const session = await auth()
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    include: { profile: true },
  })

  if (!user) return null
  const name = `${user.firstName} ${user.lastName}`

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>
      <div className="mt-6 max-w-md rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
            {user.firstName[0]}{user.lastName[0]}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
            <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              {user.role === 'ADMIN' ? 'Administrateur' : user.role === 'INSTRUCTOR' ? 'Formateur' : 'Apprenant'}
            </span>
          </div>
        </div>
        {user.profile?.bio && (
          <p className="mt-4 text-sm text-gray-600">{user.profile.bio}</p>
        )}
        <div className="mt-4 space-y-2 text-sm text-gray-500">
          {user.phone && <p>📞 {user.phone}</p>}
          {user.profile?.country && <p>🌍 {user.profile.country}</p>}
          <p>🗓️ Membre depuis {new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
        </div>
      </div>
    </div>
  )
}
