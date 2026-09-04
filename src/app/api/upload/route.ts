import { auth } from '@/lib/auth'
import { uploadLessonFileCore, type UploadType } from '@/features/media/upload-core'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'Non authentifié.' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Requête invalide (multipart attendu).' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const lessonId = formData.get('lessonId') as string | null
  const fileType = formData.get('type') as UploadType | null

  if (!file || !lessonId || !fileType || !['video', 'document'].includes(fileType)) {
    return Response.json({ error: 'Paramètres manquants ou invalides.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  const result = await uploadLessonFileCore(
    session.user.role ?? '',
    lessonId,
    fileType,
    buffer,
    file.type,
    file.name,
    file.size,
  )

  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 })
  }

  return Response.json({ success: true, key: result.data?.key })
}
