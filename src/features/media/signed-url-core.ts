import { prisma } from '@/lib/prisma'
import { storageProvider } from '@/services/storage-provider'

export interface SignedMedia {
  url: string
  expiresAt: Date
}

/**
 * Generates a short-lived signed URL to access a lesson's media (VIDEO or DOCUMENT).
 * For paid lessons, requires a valid enrollment. Free lessons skip the enrollment check.
 * Returns null if no media is uploaded or access is not granted.
 */
export async function getSignedLessonUrl(
  lessonId: string,
  userId: string,
  expiresInSeconds = 3600,
): Promise<SignedMedia | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      video: { select: { providerVideoId: true } },
      documents: { orderBy: { createdAt: 'desc' }, take: 1, select: { storageKey: true } },
      module: { select: { courseId: true } },
    },
  })
  if (!lesson) return null

  if (!lesson.isFree) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: lesson.module.courseId } },
      select: { id: true },
    })
    if (!enrollment) return null
  }

  let storageKey: string | null = null
  if (lesson.type === 'VIDEO' && lesson.video) {
    storageKey = lesson.video.providerVideoId
  } else if (lesson.type === 'DOCUMENT' && lesson.documents[0]) {
    storageKey = lesson.documents[0].storageKey
  }

  if (!storageKey) return null

  const url = await storageProvider.getSignedUrl(storageKey, expiresInSeconds)
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000)
  return { url, expiresAt }
}
