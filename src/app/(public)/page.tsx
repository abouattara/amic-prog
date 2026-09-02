import Link from 'next/link'
import { ArrowRight, BookOpen, Award, Users, CheckCircle } from 'lucide-react'
import { prisma } from '@/lib/prisma'

async function getFeaturedCourses() {
  return prisma.course.findMany({
    where: { status: 'PUBLISHED' },
    include: { category: true, instructor: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 3,
  })
}

export default async function HomePage() {
  const featuredCourses = await getFeaturedCourses()

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
              Formez-vous en ligne, où que vous soyez en Afrique
            </h1>
            <p className="mt-4 text-lg text-blue-100">
              Accédez à des formations certifiantes en vidéo, avancez à votre rythme et obtenez
              votre certificat vérifiable partout dans le monde.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/formations"
                className="flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
              >
                Voir les formations <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-2 rounded-lg border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Créer un compte gratuit
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 text-center">
            {[
              { label: 'Formations', value: '20+', icon: BookOpen },
              { label: 'Apprenants', value: '500+', icon: Users },
              { label: 'Certificats délivrés', value: '300+', icon: Award },
              { label: 'Taux de satisfaction', value: '98%', icon: CheckCircle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label}>
                <Icon className="mx-auto h-6 w-6 text-blue-600" />
                <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-sm text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured courses */}
      <section className="py-16 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Formations récentes</h2>
            <Link href="/formations" className="text-sm font-medium text-blue-600 hover:text-blue-800">
              Voir tout →
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredCourses.length === 0 ? (
              <p className="col-span-3 text-center text-gray-500 py-12">
                Aucune formation disponible pour le moment.
              </p>
            ) : (
              featuredCourses.map((course) => (
                <Link
                  key={course.id}
                  href={`/formations/${course.slug}`}
                  className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  {course.thumbnailUrl && (
                    <div className="mb-4 h-40 w-full overflow-hidden rounded-lg bg-gray-100">
                      <img
                        src={course.thumbnailUrl}
                        alt={course.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  {course.category && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {course.category.name}
                    </span>
                  )}
                  <h3 className="mt-2 font-semibold text-gray-900 line-clamp-2">{course.title}</h3>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">{course.shortDesc}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      par {`${course.instructor.firstName} ${course.instructor.lastName}`.trim() || 'Formateur'}
                    </span>
                    <span className="font-bold text-blue-700">
                      {course.price === 0
                        ? 'Gratuit'
                        : new Intl.NumberFormat('fr-BF', {
                            style: 'currency',
                            currency: course.currency,
                            maximumFractionDigits: 0,
                          }).format(course.price / 100)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-14 text-white text-center" id="contact">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-3xl font-bold">Prêt à commencer ?</h2>
          <p className="mt-3 text-blue-100">
            Rejoignez des milliers d&apos;apprenants et boostez votre carrière dès aujourd&apos;hui.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-block rounded-lg bg-white px-8 py-3 font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
          >
            S&apos;inscrire gratuitement
          </Link>
        </div>
      </section>
    </>
  )
}
