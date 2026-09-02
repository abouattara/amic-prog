import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// NOTE: requires @prisma/adapter-pg + pg to be installed
// Run: npm install @prisma/adapter-pg pg

async function main() {
  // PrismaClient usage at runtime requires adapter, see src/lib/prisma.ts
  const { PrismaPg } = await import('@prisma/adapter-pg' as string)
  const { Pool } = await import('pg' as string)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const db = new PrismaClient({ adapter } as Parameters<typeof PrismaClient>[0])

  console.log('🌱 Seeding database...')

  // Admin
  const adminHash = await bcrypt.hash('admin1234', 12)
  const admin = await db.user.upsert({
    where: { email: 'admin@amic-academia.com' },
    update: {},
    create: {
      firstName: 'Admin',
      lastName: 'Amic',
      email: 'admin@amic-academia.com',
      passwordHash: adminHash,
      role: 'ADMIN',
      profile: { create: { country: 'BF' } },
    },
  })
  console.log('✅ Admin:', admin.email)

  // Instructor
  const instrHash = await bcrypt.hash('formateur123', 12)
  const instructor = await db.user.upsert({
    where: { email: 'formateur@amic-academia.com' },
    update: {},
    create: {
      firstName: 'Moussa',
      lastName: 'Kaboré',
      email: 'formateur@amic-academia.com',
      passwordHash: instrHash,
      role: 'INSTRUCTOR',
      profile: { create: { country: 'BF', bio: 'Expert en développement web et mobile.' } },
    },
  })
  console.log('✅ Instructor:', instructor.email)

  // Student
  const studentHash = await bcrypt.hash('etudiant123', 12)
  const student = await db.user.upsert({
    where: { email: 'etudiant@example.com' },
    update: {},
    create: {
      firstName: 'Aminata',
      lastName: 'Traoré',
      email: 'etudiant@example.com',
      passwordHash: studentHash,
      role: 'STUDENT',
      profile: { create: { country: 'BF' } },
    },
  })
  console.log('✅ Student:', student.email)

  // Category
  const category = await db.courseCategory.upsert({
    where: { slug: 'developpement-web' },
    update: {},
    create: {
      name: 'Développement Web',
      slug: 'developpement-web',
      description: 'HTML, CSS, JavaScript, React, Node.js et plus',
    },
  })

  await db.courseCategory.upsert({
    where: { slug: 'bureautique' },
    update: {},
    create: {
      name: 'Bureautique',
      slug: 'bureautique',
      description: 'Word, Excel, PowerPoint et outils de productivité',
    },
  })
  console.log('✅ Categories créées')

  // Course
  const course = await db.course.upsert({
    where: { slug: 'html-css-debutant' },
    update: {},
    create: {
      title: 'HTML & CSS pour débutants',
      slug: 'html-css-debutant',
      description: `Apprenez à créer des sites web modernes depuis zéro avec HTML5 et CSS3.

Ce cours complet vous guide étape par étape depuis les bases jusqu'à la création de pages web responsive et attrayantes. Idéal pour les débutants souhaitant se lancer dans le développement web.

Ce que vous apprendrez :
- La structure de base d'une page HTML
- Les principales balises HTML5
- La mise en forme avec CSS3
- Le design responsive avec Flexbox et Grid
- Les bonnes pratiques du développement web`,
      shortDesc: 'Créez vos premiers sites web avec HTML5 et CSS3. Formation complète pour débutants.',
      status: 'PUBLISHED',
      price: 500000,
      currency: 'XOF',
      level: 'Débutant',
      language: 'fr',
      instructorId: instructor.id,
      categoryId: category.id,
    },
  })

  // Module 1
  const module1 = await db.courseModule.upsert({
    where: { courseId_position: { courseId: course.id, position: 1 } },
    update: {},
    create: {
      courseId: course.id,
      title: 'Introduction au HTML',
      position: 1,
    },
  })

  // Lessons
  const lesson1 = await db.lesson.upsert({
    where: { moduleId_position: { moduleId: module1.id, position: 1 } },
    update: {},
    create: {
      moduleId: module1.id,
      title: 'Qu\'est-ce que le HTML ?',
      type: 'VIDEO',
      position: 1,
      isFree: true,
    },
  })

  await db.video.upsert({
    where: { lessonId: lesson1.id },
    update: {},
    create: {
      lessonId: lesson1.id,
      providerVideoId: 'mock-video-001',
      providerName: 'mock',
      duration: 540,
    },
  })

  const lesson2 = await db.lesson.upsert({
    where: { moduleId_position: { moduleId: module1.id, position: 2 } },
    update: {},
    create: {
      moduleId: module1.id,
      title: 'Structure d\'un document HTML',
      type: 'VIDEO',
      position: 2,
      isFree: false,
    },
  })

  await db.video.upsert({
    where: { lessonId: lesson2.id },
    update: {},
    create: {
      lessonId: lesson2.id,
      providerVideoId: 'mock-video-002',
      providerName: 'mock',
      duration: 720,
    },
  })

  // Module 2
  const module2 = await db.courseModule.upsert({
    where: { courseId_position: { courseId: course.id, position: 2 } },
    update: {},
    create: {
      courseId: course.id,
      title: 'CSS et Mise en forme',
      position: 2,
    },
  })

  await db.lesson.upsert({
    where: { moduleId_position: { moduleId: module2.id, position: 1 } },
    update: {},
    create: {
      moduleId: module2.id,
      title: 'Introduction au CSS',
      type: 'VIDEO',
      position: 1,
      isFree: false,
    },
  })

  // Quiz
  const quiz = await db.quiz.create({
    data: {
      courseId: course.id,
      title: 'Quiz HTML & CSS - Module 1',
      passingScore: 70,
      maxAttempts: 3,
    },
  })

  await db.quizQuestion.create({
    data: {
      quizId: quiz.id,
      questionText: 'Que signifie HTML ?',
      type: 'MCQ',
      position: 1,
      points: 1,
      explanation: 'HTML signifie HyperText Markup Language.',
      options: {
        createMany: {
          data: [
            { text: 'HyperText Markup Language', isCorrect: true, position: 1 },
            { text: 'HyperText Making Language', isCorrect: false, position: 2 },
            { text: 'HighText Markup Language', isCorrect: false, position: 3 },
          ],
        },
      },
    },
  })

  console.log('✅ Course + modules + lessons + quiz créés')

  // Free course
  const freeCourse = await db.course.upsert({
    where: { slug: 'introduction-informatique' },
    update: {},
    create: {
      title: 'Introduction à l\'informatique',
      slug: 'introduction-informatique',
      description: 'Découvrez les bases de l\'informatique et du numérique dans ce cours gratuit.',
      shortDesc: 'Les fondamentaux de l\'informatique expliqués simplement. Cours 100% gratuit.',
      status: 'PUBLISHED',
      price: 0,
      currency: 'XOF',
      level: 'Débutant',
      language: 'fr',
      instructorId: admin.id,
      categoryId: category.id,
    },
  })

  const freeModule = await db.courseModule.upsert({
    where: { courseId_position: { courseId: freeCourse.id, position: 1 } },
    update: {},
    create: { courseId: freeCourse.id, title: 'Les bases', position: 1 },
  })

  const freeLesson = await db.lesson.upsert({
    where: { moduleId_position: { moduleId: freeModule.id, position: 1 } },
    update: {},
    create: { moduleId: freeModule.id, title: 'C\'est quoi un ordinateur ?', type: 'VIDEO', position: 1, isFree: true },
  })

  await db.video.upsert({
    where: { lessonId: freeLesson.id },
    update: {},
    create: { lessonId: freeLesson.id, providerVideoId: 'mock-video-003', providerName: 'mock', duration: 300 },
  })

  // Enrollment for student in free course
  const enrollment = await db.enrollment.upsert({
    where: { userId_courseId: { userId: student.id, courseId: freeCourse.id } },
    update: {},
    create: { userId: student.id, courseId: freeCourse.id },
  })

  await db.courseProgress.upsert({
    where: { enrollmentId: enrollment.id },
    update: {},
    create: { enrollmentId: enrollment.id, totalLessons: 1, completedCount: 0, percentage: 0 },
  })

  console.log('✅ Free course + enrollment student créés')
  console.log('\n📋 Comptes de test :')
  console.log('  Admin    : admin@amic-academia.com / admin1234')
  console.log('  Formateur: formateur@amic-academia.com / formateur123')
  console.log('  Étudiant : etudiant@example.com / etudiant123')

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
