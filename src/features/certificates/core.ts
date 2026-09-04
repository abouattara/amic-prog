import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'

function generateCertificateNumber(): string {
  // 24 caractères hexadécimaux, crypto-random → non devinable
  return randomBytes(12).toString('hex').toUpperCase()
}

interface CertData {
  learnerName: string
  courseTitle: string
  instructorName: string
  issuedAt: Date
  certificateNumber: string
}

export async function generateCertificatePdf(data: CertData): Promise<Buffer> {
  const { learnerName, courseTitle, instructorName, issuedAt, certificateNumber } = data

  const doc = await PDFDocument.create()
  // A4 paysage : 841.89 × 595.28 pt
  const page = doc.addPage([841.89, 595.28])
  const { width, height } = page.getSize()

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontReg = await doc.embedFont(StandardFonts.Helvetica)

  const blue = rgb(0.12, 0.28, 0.69)
  const gold = rgb(0.8, 0.65, 0.1)
  const grayC = rgb(0.45, 0.45, 0.45)
  const dark = rgb(0.08, 0.08, 0.08)

  // Bordure double
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderColor: blue, borderWidth: 4 })
  page.drawRectangle({ x: 26, y: 26, width: width - 52, height: height - 52, borderColor: gold, borderWidth: 1.5 })

  // En-tête
  page.drawText('AMIC ACADEMIA', { x: 50, y: height - 80, font: fontBold, size: 28, color: blue })
  page.drawLine({ start: { x: 50, y: height - 93 }, end: { x: 440, y: height - 93 }, thickness: 2, color: gold })
  page.drawText('Certificat de Reussite', { x: 50, y: height - 116, font: fontReg, size: 16, color: grayC })

  // Corps
  page.drawText('Ce certificat atteste que', { x: 50, y: height - 175, font: fontReg, size: 13, color: grayC })
  page.drawText(learnerName, { x: 50, y: height - 215, font: fontBold, size: 28, color: dark })
  page.drawText('a complete avec succes la formation', { x: 50, y: height - 258, font: fontReg, size: 13, color: grayC })

  // Titre formation (taille adaptative)
  const titleSize = courseTitle.length > 55 ? 17 : 22
  page.drawText(courseTitle, { x: 50, y: height - 300, font: fontBold, size: titleSize, color: blue })
  page.drawText(`Formateur : ${instructorName}`, { x: 50, y: height - 340, font: fontReg, size: 12, color: grayC })

  // Pied de page
  page.drawLine({ start: { x: 50, y: 130 }, end: { x: width - 200, y: 130 }, thickness: 1, color: gold })
  const dateStr = issuedAt.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
  page.drawText(`Date de delivrance : ${dateStr}`, { x: 50, y: 108, font: fontReg, size: 11, color: grayC })
  page.drawText(`Certificat N ${certificateNumber}`, { x: 50, y: 88, font: fontReg, size: 10, color: grayC })
  page.drawText('Verifiable sur /verify/' + certificateNumber, { x: 50, y: 68, font: fontReg, size: 9, color: grayC })

  // QR code
  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://amic-academia.com'
  const qrDataUrl = await QRCode.toDataURL(`${baseUrl}/verify/${certificateNumber}`, { width: 130, margin: 1 })
  const qrPng = await doc.embedPng(Buffer.from(qrDataUrl.split(',')[1], 'base64'))
  page.drawImage(qrPng, { x: width - 180, y: 55, width: 120, height: 120 })

  const bytes = await doc.save()
  return Buffer.from(bytes)
}

// Vérifie que tous les quiz du cours ont été réussis par l'utilisateur.
// Helper privé — pas d'import de quiz/core.ts pour éviter la dépendance circulaire.
async function allQuizzesPassedForCourse(userId: string, courseId: string): Promise<boolean> {
  const quizzes = await prisma.quiz.findMany({ where: { courseId }, select: { id: true } })
  if (quizzes.length === 0) return true // aucun quiz → pas de blocage

  for (const quiz of quizzes) {
    const passed = await prisma.quizAttempt.findFirst({
      where: { userId, quizId: quiz.id, passed: true },
      select: { id: true },
    })
    if (!passed) return false
  }
  return true
}

/**
 * Vérifie les deux conditions (cours 100 % + tous quiz réussis) et émet le certificat.
 * Idempotente : sans effet si le certificat existe déjà.
 * Appelée depuis onCourseCompleted (progress/core) et onQuizPassed (quiz/core).
 */
export async function checkAndIssueCertificate(userId: string, courseId: string): Promise<void> {
  // Idempotence stricte — jamais deux certificats pour le même couple (userId, courseId)
  const existing = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  })
  if (existing) return

  // Condition 1 : toutes les leçons terminées (completedAt renseigné)
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: { courseProgress: { select: { completedAt: true } } },
  })
  if (!enrollment?.courseProgress?.completedAt) return

  // Condition 2 : tous les quiz du cours réussis (ou aucun quiz)
  if (!(await allQuizzesPassedForCourse(userId, courseId))) return

  // Charger données pour le PDF
  const [course, user] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      include: { instructor: { select: { firstName: true, lastName: true } } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } }),
  ])
  if (!course || !user) return

  const certificateNumber = generateCertificateNumber()

  const pdfBuffer = await generateCertificatePdf({
    learnerName: `${user.firstName} ${user.lastName}`.trim(),
    courseTitle: course.title,
    instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`.trim(),
    issuedAt: new Date(),
    certificateNumber,
  })

  // Upload si storage configuré — skippé silencieusement en dev/CI (STORAGE_ENDPOINT absent)
  let storageKey: string | null = null
  if (process.env.STORAGE_ENDPOINT && process.env.STORAGE_BUCKET) {
    try {
      const { uploadFile } = await import('@/services/storage-provider')
      storageKey = `certificates/${certificateNumber}.pdf`
      await uploadFile(storageKey, pdfBuffer, 'application/pdf')
    } catch (err) {
      console.error('[Certificate] upload failed, cert enregistré sans PDF distant:', err)
    }
  }

  await prisma.certificate.create({
    data: { userId, courseId, certificateNumber, storageKey },
  })

  console.log(`[Certificate] emis ${certificateNumber} — userId=${userId} courseId=${courseId}`)

  // Notification CERTIFICATE_AVAILABLE — try/catch isolé
  try {
    const { sendNotificationSafe } = await import('@/features/notifications/core')
    await sendNotificationSafe({
      userId,
      event: 'CERTIFICATE_AVAILABLE',
      title: 'Votre certificat est prêt !',
      body: `Félicitations ! Votre certificat pour la formation « ${course.title} » est maintenant disponible.`,
      sourceId: courseId,
    })
  } catch (err) {
    console.error('[Notification:CERTIFICATE_AVAILABLE]', err)
  }
}
