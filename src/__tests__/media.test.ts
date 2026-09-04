/**
 * Tests d'intégration : upload de fichiers et URLs signées.
 * Nécessite la DB : npm run db:start
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  uploadLessonFileCore,
  VIDEO_MAX_BYTES,
  DOC_MAX_BYTES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_DOC_TYPES,
} from '@/features/media/upload-core'
import { getSignedLessonUrl } from '@/features/media/signed-url-core'
import { storageProvider } from '@/services/storage-provider'
import fs from 'fs'
import path from 'path'

const P = `media_${Date.now()}`

let adminId: string
let studentId: string
let courseId: string
let categoryId: string
let moduleId: string
let videoLessonId: string
let docLessonId: string
let enrollmentId: string

// Keys written by tests – cleaned up in afterAll
const uploadedKeys: string[] = []

beforeAll(async () => {
  const [admin, student] = await Promise.all([
    prisma.user.create({
      data: { firstName: 'Admin', lastName: 'Media', email: `${P}_admin@t.com`, passwordHash: 'noop', role: 'ADMIN', profile: { create: {} } },
    }),
    prisma.user.create({
      data: { firstName: 'Etudiant', lastName: 'Media', email: `${P}_student@t.com`, passwordHash: 'noop', role: 'STUDENT', profile: { create: {} } },
    }),
  ])
  adminId = admin.id
  studentId = student.id

  const cat = await prisma.courseCategory.create({ data: { name: `${P}_cat`, slug: `${P}-cat` } })
  categoryId = cat.id

  const course = await prisma.course.create({
    data: { title: `${P} Cours`, slug: `${P}-cours`, description: 'Media test', instructorId: adminId, categoryId },
  })
  courseId = course.id

  const mod = await prisma.courseModule.create({ data: { courseId, title: 'Module media', position: 1 } })
  moduleId = mod.id

  const [vl, dl] = await Promise.all([
    prisma.lesson.create({ data: { moduleId, title: 'Vidéo intro', type: 'VIDEO', position: 1, isFree: false } }),
    prisma.lesson.create({ data: { moduleId, title: 'Document PDF', type: 'DOCUMENT', position: 2, isFree: false } }),
  ])
  videoLessonId = vl.id
  docLessonId = dl.id

  const enrollment = await prisma.enrollment.create({ data: { userId: studentId, courseId } })
  enrollmentId = enrollment.id
})

afterAll(async () => {
  // Delete physical files written by LocalStorageProvider
  for (const key of uploadedKeys) {
    await storageProvider.delete(key)
  }

  await prisma.enrollment.delete({ where: { id: enrollmentId } })
  await prisma.courseModule.delete({ where: { id: moduleId } }) // cascades to lessons + video + document
  await prisma.course.delete({ where: { id: courseId } })
  await prisma.courseCategory.delete({ where: { id: categoryId } })
  await prisma.profile.deleteMany({ where: { userId: { in: [adminId, studentId] } } })
  await prisma.user.deleteMany({ where: { id: { in: [adminId, studentId] } } })
  await prisma.$disconnect()
})

// ── uploadLessonFileCore ──────────────────────────────────────────────────────

describe('uploadLessonFileCore', () => {
  it('non-admin refusé (STUDENT)', async () => {
    const r = await uploadLessonFileCore('STUDENT', videoLessonId, 'video', Buffer.from('x'), 'video/mp4', 'test.mp4', 1)
    expect(r.success).toBe(false)
    expect(r.error).toBe('Non autorisé.')
  })

  it('type MIME invalide pour vidéo → rejeté', async () => {
    const r = await uploadLessonFileCore('ADMIN', videoLessonId, 'video', Buffer.from('data'), 'image/jpeg', 'photo.jpg', 4)
    expect(r.success).toBe(false)
    expect(r.error).toContain('Type de fichier non autorisé')
  })

  it('type MIME invalide pour document → rejeté', async () => {
    const r = await uploadLessonFileCore('ADMIN', docLessonId, 'document', Buffer.from('data'), 'application/msword', 'doc.doc', 4)
    expect(r.success).toBe(false)
    expect(r.error).toContain('Type de fichier non autorisé')
  })

  it('taille vidéo dépassée → rejetée', async () => {
    const r = await uploadLessonFileCore('ADMIN', videoLessonId, 'video', Buffer.alloc(1), 'video/mp4', 'big.mp4', VIDEO_MAX_BYTES + 1)
    expect(r.success).toBe(false)
    expect(r.error).toContain('500 Mo')
  })

  it('taille PDF dépassée → rejetée', async () => {
    const r = await uploadLessonFileCore('ADMIN', docLessonId, 'document', Buffer.alloc(1), 'application/pdf', 'big.pdf', DOC_MAX_BYTES + 1)
    expect(r.success).toBe(false)
    expect(r.error).toContain('20 Mo')
  })

  it('upload vidéo MP4 réussi → fichier écrit + Video créé en DB', async () => {
    const fakeVideo = Buffer.from('fake-mp4-content')
    const r = await uploadLessonFileCore('ADMIN', videoLessonId, 'video', fakeVideo, 'video/mp4', 'intro.mp4', fakeVideo.length)
    expect(r.success).toBe(true)
    expect(r.data?.key).toMatch(/^videos\//)
    uploadedKeys.push(r.data!.key)

    const video = await prisma.video.findUnique({ where: { lessonId: videoLessonId } })
    expect(video?.providerVideoId).toBe(r.data!.key)
    expect(video?.providerName).toBe('local')

    // Verify file exists on disk
    const filePath = path.join(process.cwd(), 'uploads', r.data!.key)
    const exists = await fs.promises.access(filePath).then(() => true).catch(() => false)
    expect(exists).toBe(true)
  })

  it('second upload vidéo → upsert Video, pas de doublon en DB', async () => {
    const fakeVideo = Buffer.from('fake-mp4-v2')
    const r = await uploadLessonFileCore('ADMIN', videoLessonId, 'video', fakeVideo, 'video/mp4', 'intro_v2.mp4', fakeVideo.length)
    expect(r.success).toBe(true)
    uploadedKeys.push(r.data!.key)

    const videos = await prisma.video.findMany({ where: { lessonId: videoLessonId } })
    expect(videos).toHaveLength(1)
    expect(videos[0].providerVideoId).toBe(r.data!.key)
  })

  it('upload PDF réussi → fichier écrit + Document créé en DB', async () => {
    const fakePdf = Buffer.from('%PDF-fake')
    const r = await uploadLessonFileCore('ADMIN', docLessonId, 'document', fakePdf, 'application/pdf', 'cours.pdf', fakePdf.length)
    expect(r.success).toBe(true)
    expect(r.data?.key).toMatch(/^documents\//)
    uploadedKeys.push(r.data!.key)

    const doc = await prisma.document.findFirst({ where: { lessonId: docLessonId } })
    expect(doc?.storageKey).toBe(r.data!.key)
    expect(doc?.mimeType).toBe('application/pdf')
  })

  it('second upload PDF → remplace le document précédent, pas de doublon', async () => {
    const fakePdf2 = Buffer.from('%PDF-fake-v2')
    const r = await uploadLessonFileCore('ADMIN', docLessonId, 'document', fakePdf2, 'application/pdf', 'cours_v2.pdf', fakePdf2.length)
    expect(r.success).toBe(true)
    uploadedKeys.push(r.data!.key)

    const docs = await prisma.document.findMany({ where: { lessonId: docLessonId } })
    expect(docs).toHaveLength(1)
    expect(docs[0].storageKey).toBe(r.data!.key)
  })
})

// ── getSignedLessonUrl ────────────────────────────────────────────────────────

describe('getSignedLessonUrl', () => {
  it('retourne null pour une leçon sans fichier uploadé (TEXT lesson)', async () => {
    const textLesson = await prisma.lesson.create({
      data: { moduleId, title: 'Texte seul', type: 'TEXT', position: 99 },
    })
    const result = await getSignedLessonUrl(textLesson.id, studentId)
    expect(result).toBeNull()
    await prisma.lesson.delete({ where: { id: textLesson.id } })
  })

  it('retourne null si l\'apprenant n\'a pas d\'enrollment (leçon non gratuite)', async () => {
    // videoLessonId is isFree: false; use a user without enrollment
    const outsider = await prisma.user.create({
      data: { firstName: 'Out', lastName: 'Sider', email: `${P}_out@t.com`, passwordHash: 'x', role: 'STUDENT', profile: { create: {} } },
    })
    const result = await getSignedLessonUrl(videoLessonId, outsider.id)
    expect(result).toBeNull()
    await prisma.profile.deleteMany({ where: { userId: outsider.id } })
    await prisma.user.delete({ where: { id: outsider.id } })
  })

  it('retourne une URL signée si enrollment valide (vidéo)', async () => {
    const result = await getSignedLessonUrl(videoLessonId, studentId)
    expect(result).not.toBeNull()
    expect(result?.url).toMatch(/^\/api\/files\?token=/)
    expect(result?.expiresAt).toBeInstanceOf(Date)
    expect(result!.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('retourne une URL signée si enrollment valide (document)', async () => {
    const result = await getSignedLessonUrl(docLessonId, studentId)
    expect(result).not.toBeNull()
    expect(result?.url).toMatch(/^\/api\/files\?token=/)
  })

  it('leçon gratuite → URL générée sans enrollment', async () => {
    const freeLesson = await prisma.lesson.create({
      data: { moduleId, title: 'Intro gratuite', type: 'VIDEO', position: 50, isFree: true },
    })
    // Upload a fake video first
    const buf = Buffer.from('free-preview')
    const up = await uploadLessonFileCore('ADMIN', freeLesson.id, 'video', buf, 'video/mp4', 'free.mp4', buf.length)
    uploadedKeys.push(up.data!.key)

    // outsider2 has no enrollment at all
    const outsider2 = await prisma.user.create({
      data: { firstName: 'Free', lastName: 'User', email: `${P}_free@t.com`, passwordHash: 'x', role: 'STUDENT', profile: { create: {} } },
    })
    const result = await getSignedLessonUrl(freeLesson.id, outsider2.id)
    expect(result).not.toBeNull()
    expect(result?.url).toMatch(/^\/api\/files\?token=/)

    await prisma.profile.deleteMany({ where: { userId: outsider2.id } })
    await prisma.user.delete({ where: { id: outsider2.id } })
    await prisma.video.delete({ where: { lessonId: freeLesson.id } })
    await prisma.lesson.delete({ where: { id: freeLesson.id } })
  })

  it('le token encode bien la durée d\'expiration (expiresInSeconds transmis)', async () => {
    const DURATION = 1800 // 30 min
    const before = Date.now()
    const result = await getSignedLessonUrl(videoLessonId, studentId, DURATION)
    expect(result).not.toBeNull()

    // Extract token from URL and decode payload
    const url = new URL(result!.url, 'http://localhost')
    const token = decodeURIComponent(url.searchParams.get('token')!)
    const dotIdx = token.lastIndexOf('.')
    const payload = JSON.parse(Buffer.from(token.slice(0, dotIdx), 'base64url').toString())

    expect(payload.expires).toBeGreaterThanOrEqual(before + DURATION * 1000 - 1000)
    expect(payload.expires).toBeLessThanOrEqual(Date.now() + DURATION * 1000 + 1000)
    expect(result!.expiresAt.getTime()).toBeCloseTo(payload.expires, -3)
  })
})
