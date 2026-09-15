import path from 'path'
import fs from 'fs'
import { createHmac } from 'crypto'

// Maps the file extension to a Content-Type for locally stored media.
const CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.pdf': 'application/pdf',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return new Response('Token manquant.', { status: 400 })
  }

  const dotIdx = token.lastIndexOf('.')
  if (dotIdx === -1) return new Response('Token invalide.', { status: 401 })

  const payload = token.slice(0, dotIdx)
  const signature = token.slice(dotIdx + 1)

  const secret = process.env.NEXTAUTH_SECRET ?? 'dev-secret'
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')

  if (signature !== expected) {
    return new Response('Signature invalide.', { status: 401 })
  }

  let tokenData: { key: string; expires: number }
  try {
    tokenData = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
  } catch {
    return new Response('Token malformé.', { status: 401 })
  }

  if (Date.now() > tokenData.expires) {
    return new Response('Token expiré.', { status: 401 })
  }

  const key = tokenData.key
  // Prevent path traversal
  if (!key || key.includes('..') || path.isAbsolute(key)) {
    return new Response('Chemin invalide.', { status: 400 })
  }

  const filePath = path.join(process.cwd(), 'uploads', key)

  let buffer: Buffer
  try {
    buffer = await fs.promises.readFile(filePath)
  } catch {
    return new Response('Fichier introuvable.', { status: 404 })
  }

  const ext = path.extname(key).toLowerCase()
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, no-cache, no-store',
      'Content-Disposition': 'inline',
    },
  })
}
