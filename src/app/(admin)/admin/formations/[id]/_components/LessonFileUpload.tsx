'use client'

import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

type FileType = 'video' | 'document'

const MAX_SIZES: Record<FileType, number> = {
  video: 500 * 1024 * 1024,
  document: 20 * 1024 * 1024,
}
const MAX_LABELS: Record<FileType, string> = { video: '500 Mo', document: '20 Mo' }
const ACCEPT: Record<FileType, string> = {
  video: 'video/mp4,video/webm,video/ogg',
  document: 'application/pdf',
}
const EXT_LABELS: Record<FileType, string> = { video: 'MP4, WebM, OGG', document: 'PDF' }

interface Props {
  lessonId: string
  fileType: FileType
  currentKey: string | null
}

export default function LessonFileUpload({ lessonId, fileType, currentKey }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [filename, setFilename] = useState<string | null>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setSuccess(false)

    if (file.size > MAX_SIZES[fileType]) {
      setError(`Fichier trop volumineux (max ${MAX_LABELS[fileType]})`)
      e.target.value = ''
      return
    }

    setFilename(file.name)
    startUpload(file)
  }

  function startUpload(file: File) {
    setProgress(0)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('lessonId', lessonId)
    formData.append('type', fileType)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    })

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        setProgress(100)
        setSuccess(true)
        setTimeout(() => router.refresh(), 500)
      } else {
        try {
          const data = JSON.parse(xhr.responseText) as { error?: string }
          setError(data.error ?? "Erreur lors de l'upload")
        } catch {
          setError("Erreur lors de l'upload")
        }
        setProgress(null)
      }
    })

    xhr.addEventListener('error', () => {
      setError('Erreur réseau')
      setProgress(null)
    })

    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  }

  const typeLabel = fileType === 'video' ? 'Vidéo' : 'PDF'

  return (
    <div className="mt-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-600">
          {typeLabel} ({EXT_LABELS[fileType]}, max {MAX_LABELS[fileType]})
        </p>
        {currentKey && !success && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" />
            Fichier existant
          </span>
        )}
      </div>

      {currentKey && !success && (
        <p className="text-xs text-gray-400 font-mono truncate">
          {currentKey.split('/').slice(-1)[0]}
        </p>
      )}

      {progress !== null ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="truncate max-w-[200px]">{filename}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-200">
            <div
              className="h-1.5 rounded-full bg-blue-600 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : success ? (
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle className="h-3.5 w-3.5" />
          Fichier uploadé avec succès
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          {currentKey ? 'Remplacer le fichier' : 'Choisir un fichier'}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[fileType]}
        className="hidden"
        onChange={handleFileSelect}
      />

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}
    </div>
  )
}
