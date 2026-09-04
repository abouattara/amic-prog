import fs from 'fs'
import path from 'path'
import { createHmac } from 'crypto'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl as s3GetSignedUrl } from '@aws-sdk/s3-request-presigner'

export interface IStorageProvider {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>
  delete(key: string): Promise<void>
}

// Dev provider: stores files in <project_root>/uploads/ (hors public/)
// Access is gated via /api/files?token=... with HMAC-signed short-lived tokens.
class LocalStorageProvider implements IStorageProvider {
  private readonly dir: string

  constructor() {
    this.dir = path.join(process.cwd(), 'uploads')
  }

  async upload(key: string, buffer: Buffer, _contentType: string): Promise<string> {
    const dest = path.join(this.dir, key)
    await fs.promises.mkdir(path.dirname(dest), { recursive: true })
    await fs.promises.writeFile(dest, buffer)
    return key
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const secret = process.env.NEXTAUTH_SECRET ?? 'dev-secret'
    const expires = Date.now() + expiresInSeconds * 1000
    const payload = Buffer.from(JSON.stringify({ key, expires })).toString('base64url')
    const sig = createHmac('sha256', secret).update(payload).digest('base64url')
    return `/api/files?token=${encodeURIComponent(`${payload}.${sig}`)}`
  }

  async delete(key: string): Promise<void> {
    await fs.promises.unlink(path.join(this.dir, key)).catch(() => {})
  }
}

// S3-compatible provider (AWS S3, Cloudflare R2, MinIO).
// Activated with STORAGE_PROVIDER=s3.
// Lazy-initialised: S3Client is created on first use so missing env vars in dev don't crash.
class S3StorageProvider implements IStorageProvider {
  private client: S3Client | null = null
  private bucket = ''

  private init(): S3Client {
    if (this.client) return this.client
    this.client = new S3Client({
      region: 'auto',
      endpoint: process.env.STORAGE_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY!,
        secretAccessKey: process.env.STORAGE_SECRET_KEY!,
      },
      forcePathStyle: true,
    })
    this.bucket = process.env.STORAGE_BUCKET!
    return this.client
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const s3 = this.init()
    await s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType }))
    return key
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const s3 = this.init()
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return s3GetSignedUrl(s3, cmd, { expiresIn: expiresInSeconds })
  }

  async delete(key: string): Promise<void> {
    const s3 = this.init()
    await s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
}

function createProvider(): IStorageProvider {
  const p = process.env.STORAGE_PROVIDER ?? 'local'
  if (p === 's3') return new S3StorageProvider()
  return new LocalStorageProvider()
}

export const storageProvider: IStorageProvider = createProvider()

// Legacy named exports (used by certificates/core.ts via dynamic import)
export async function uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
  return storageProvider.upload(key, body, contentType)
}

export async function getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  return storageProvider.getSignedUrl(key, expiresInSeconds)
}

export async function deleteFile(key: string): Promise<void> {
  return storageProvider.delete(key)
}

export function buildStorageKey(folder: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${folder}/${Date.now()}_${safe}`
}
