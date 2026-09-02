import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createHash, randomBytes } from 'crypto'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

async function hash(pwd) {
  return bcrypt.hash(pwd, 12)
}

function certNumber() {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = randomBytes(4).toString('hex').toUpperCase()
  return `CERT-${ts}-${rand}`
}

console.log('🌱 Seeding database...')

// Admin
const admin = await db.user.upsert({
  where: { email: 'admin@amic-academia.com' },
  update: {},
  create: {
    firstName: 'Admin', lastName: 'Amic',
    email: 'admin@amic-academia.com',
    passwordHash: await hash('admin1234'),
    role: 'ADMIN',
    profile: { create: { country: 'BF' } },
  },
})
console.log('✅ Admin:', admin.email)

// Instructor
const instructor = await db.user.upsert({
  where: { email: 'formateur@amic-academia.com' },
  update: {},
  create: {
    firstName: 'Moussa', lastName: 'Kaboré',
    email: 'formateur@amic-academia.com',
    passwordHash: await hash('formateur123'),
    role: 'INSTRUCTOR',
    profile: { create: { country: 'BF', bio: 'Expert en développement web et mobile.' } },
  },
})
console.log('✅ Instructor:', instructor.email)

// Student
const student = await db.user.upsert({
  where: { email: 'etudiant@example.com' },
  update: {},
  create: {
    firstName: 'Aminata', lastName: 'Traoré',
    email: 'etudiant@example.com',
    passwordHash: await hash('etudiant123'),
    role: 'STUDENT',
    profile: { create: { country: 'BF' } },
  },
})
console.log('✅ Student:', student.email)

// Categories
const catWeb = await db.courseCategory.upsert({
  where: { slug: 'developpement-web' },
  update: {},
  create: { name: 'Développement Web', slug: 'developpement-web', description: 'HTML, CSS, JavaScript, React, Node.js' },
})
await db.courseCategory.upsert({
  where: { slug: 'bureautique' },
  update: {},
  create: { name: 'Bureautique', slug: 'bureautique', description: 'Word, Excel, PowerPoint' },
})
console.log('✅ Catégories créées')

// Paid course
const course = await db.course.upsert({
  where: { slug: 'html-css-debutant' },
  update: {},
  create: {
    title: 'HTML & CSS pour débutants',
    slug: 'html-css-debutant',
    description: `Apprenez à créer des sites web modernes depuis zéro avec HTML5 et CSS3.\n\nCe cours complet vous guide étape par étape depuis les bases jusqu'à la création de pages web responsive.\n\nCe que vous apprendrez :\n- La structure de base d'une page HTML\n- Les principales balises HTML5\n- La mise en forme avec CSS3\n- Le design responsive avec Flexbox et Grid`,
    shortDesc: 'Créez vos premiers sites web avec HTML5 et CSS3. Formation complète pour débutants.',
    status: 'PUBLISHED',
    price: 500000,
    currency: 'XOF',
    level: 'Débutant',
    language: 'fr',
    instructorId: instructor.id,
    categoryId: catWeb.id,
  },
})

const mod1 = await db.courseModule.upsert({
  where: { courseId_position: { courseId: course.id, position: 1 } },
  update: {},
  create: { courseId: course.id, title: 'Introduction au HTML', position: 1 },
})

const l1 = await db.lesson.upsert({
  where: { moduleId_position: { moduleId: mod1.id, position: 1 } },
  update: {},
  create: { moduleId: mod1.id, title: "Qu'est-ce que le HTML ?", type: 'VIDEO', position: 1, isFree: true },
})
await db.video.upsert({
  where: { lessonId: l1.id },
  update: {},
  create: { lessonId: l1.id, providerVideoId: 'mock-001', providerName: 'mock', duration: 540 },
})

const l2 = await db.lesson.upsert({
  where: { moduleId_position: { moduleId: mod1.id, position: 2 } },
  update: {},
  create: { moduleId: mod1.id, title: "Structure d'un document HTML", type: 'VIDEO', position: 2, isFree: false },
})
await db.video.upsert({
  where: { lessonId: l2.id },
  update: {},
  create: { lessonId: l2.id, providerVideoId: 'mock-002', providerName: 'mock', duration: 720 },
})

const mod2 = await db.courseModule.upsert({
  where: { courseId_position: { courseId: course.id, position: 2 } },
  update: {},
  create: { courseId: course.id, title: 'CSS et Mise en forme', position: 2 },
})
const l3 = await db.lesson.upsert({
  where: { moduleId_position: { moduleId: mod2.id, position: 1 } },
  update: {},
  create: { moduleId: mod2.id, title: 'Introduction au CSS', type: 'VIDEO', position: 1, isFree: false },
})
await db.video.upsert({
  where: { lessonId: l3.id },
  update: {},
  create: { lessonId: l3.id, providerVideoId: 'mock-003', providerName: 'mock', duration: 900 },
})

// Quiz
const quiz = await db.quiz.create({
  data: {
    courseId: course.id,
    title: 'Quiz HTML & CSS — Module 1',
    passingScore: 70,
    maxAttempts: 3,
    questions: {
      create: [{
        questionText: 'Que signifie HTML ?',
        type: 'MCQ',
        position: 1,
        points: 1,
        explanation: 'HTML = HyperText Markup Language',
        options: {
          createMany: {
            data: [
              { text: 'HyperText Markup Language', isCorrect: true, position: 1 },
              { text: 'HyperText Making Language', isCorrect: false, position: 2 },
              { text: 'HighText Markup Language', isCorrect: false, position: 3 },
            ],
          },
        },
      }],
    },
  },
})

console.log('✅ Formation HTML/CSS + modules + quiz créés')

// Free course
const freeCourse = await db.course.upsert({
  where: { slug: 'introduction-informatique' },
  update: {},
  create: {
    title: "Introduction à l'informatique",
    slug: 'introduction-informatique',
    description: "Découvrez les bases de l'informatique et du numérique dans ce cours gratuit.",
    shortDesc: "Les fondamentaux de l'informatique expliqués simplement. Cours 100% gratuit.",
    status: 'PUBLISHED',
    price: 0,
    currency: 'XOF',
    level: 'Débutant',
    language: 'fr',
    instructorId: admin.id,
    categoryId: catWeb.id,
  },
})

const freeMod = await db.courseModule.upsert({
  where: { courseId_position: { courseId: freeCourse.id, position: 1 } },
  update: {},
  create: { courseId: freeCourse.id, title: 'Les bases', position: 1 },
})
const freeLesson = await db.lesson.upsert({
  where: { moduleId_position: { moduleId: freeMod.id, position: 1 } },
  update: {},
  create: { moduleId: freeMod.id, title: "C'est quoi un ordinateur ?", type: 'VIDEO', position: 1, isFree: true },
})
await db.video.upsert({
  where: { lessonId: freeLesson.id },
  update: {},
  create: { lessonId: freeLesson.id, providerVideoId: 'mock-004', providerName: 'mock', duration: 300 },
})

// Enroll student in free course
const enr = await db.enrollment.upsert({
  where: { userId_courseId: { userId: student.id, courseId: freeCourse.id } },
  update: {},
  create: { userId: student.id, courseId: freeCourse.id },
})
await db.courseProgress.upsert({
  where: { enrollmentId: enr.id },
  update: {},
  create: { enrollmentId: enr.id, totalLessons: 1, completedCount: 0, percentage: 0 },
})

// Certificate for student on free course
await db.certificate.upsert({
  where: { userId_courseId: { userId: student.id, courseId: freeCourse.id } },
  update: {},
  create: { userId: student.id, courseId: freeCourse.id, certificateNumber: certNumber() },
})

console.log('✅ Cours gratuit + inscription étudiant + certificat créés')

console.log('\n📋 Comptes de test :')
console.log('  Admin     : admin@amic-academia.com     / admin1234')
console.log('  Formateur : formateur@amic-academia.com / formateur123')
console.log('  Étudiant  : etudiant@example.com        / etudiant123')

await db.$disconnect()
await pool.end()
console.log('\n✅ Seed terminé !')
