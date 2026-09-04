import { prisma } from '@/lib/prisma'
import { storageProvider } from '@/services/storage-provider'
import type { ActionResult } from '@/types'

function isAdmin(role: string): boolean {
  return role === 'ADMIN' || role === 'INSTRUCTOR'
}

export const VIDEO_MAX_BYTES = 500 * 1024 * 1024 // 500 Mo
export const DOC_MAX_BYTES = 20 * 1024 * 1024    // 20 Mo

export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'] as const
export const ALLOWED_DOC_TYPES = ['application/pdf'] as const

export type UploadType = 'video' | 'document'

export async function uploadLessonFileCore(
  userRole: string,
  lessonId: string,
  fileType: UploadType,
  buffer: Buffer,
  mimeType: string,
  filename: string,
  sizeBytes: number,
): Promise<ActionResult<{ key: string }>> {
  if (!isAdmin(userRole)) return { success: false, error: 'Non autorisé.' }

  const maxBytes = fileType === 'video' ? VIDEO_MAX_BYTES : DOC_MAX_BYTES
  const allowed: readonly string[] = fileType === 'video' ? ALLOWED_VIDEO_TYPES : ALLOWED_DOC_TYPES

  if (sizeBytes > maxBytes) {
    const label = fileType === 'video' ? '500 Mo' : '20 Mo'
    return { success: false, error: `Fichier trop volumineux (max ${label}).` }
  }

  if (!allowed.includes(mimeType)) {
    return { success: false, error: `Type de fichier non autorisé : ${mimeType}.` }
  }

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true } })
  if (!lesson) return { success: false, error: 'Leçon introuvable.' }

  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  const key = `${fileType}s/${lessonId}/${Date.now()}_${safe}`

  await storageProvider.upload(key, buffer, mimeType)

  if (fileType === 'video') {
    await prisma.video.upsert({
      where: { lessonId },
      create: { lessonId, providerVideoId: key, providerName: process.env.STORAGE_PROVIDER ?? 'local' },
      update: { providerVideoId: key, providerName: process.env.STORAGE_PROVIDER ?? 'local' },
    })
  } else {
    // Replace any existing document for this lesson
    await prisma.document.deleteMany({ where: { lessonId } })
    await prisma.document.create({
      data: {
        lessonId,
        title: filename.slice(0, 255),
        storageKey: key,
        mimeType,
        sizeBytes,
      },
    })
  }

  return { success: true, data: { key } }
}
