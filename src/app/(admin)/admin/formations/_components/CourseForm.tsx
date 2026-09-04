'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCourseAction, updateCourseAction } from '@/features/courses/actions'

type Category = { id: string; name: string; slug: string }

type CourseData = {
  id: string
  title: string
  slug: string
  description: string
  shortDesc: string | null
  price: number
  currency: string
  categoryId: string | null
  level: string | null
  language: string
  thumbnailUrl: string | null
  status: string
}

interface CourseFormProps {
  mode: 'create' | 'edit'
  categories: Category[]
  course?: CourseData
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function CourseForm({ mode, categories, course }: CourseFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [title, setTitle] = useState(course?.title ?? '')
  const [slug, setSlug] = useState(course?.slug ?? '')

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setTitle(v)
    if (mode === 'create') setSlug(slugify(v))
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    const data = new FormData(e.currentTarget)

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createCourseAction(data)
          : await updateCourseAction(course!.id, data)

      if (result.success) {
        router.push('/admin/formations')
        router.refresh()
      } else {
        setError(result.error ?? null)
        setFieldErrors(result.fieldErrors ?? {})
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Titre" error={fieldErrors.title?.[0]}>
          <input
            name="title"
            value={title}
            onChange={handleTitleChange}
            required
            className={input}
            placeholder="Ex: HTML & CSS pour débutants"
          />
        </Field>

        <Field label="Slug (URL)" error={fieldErrors.slug?.[0]}>
          <input
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            className={input}
            placeholder="html-css-debutants"
          />
        </Field>
      </div>

      <Field label="Description courte" error={fieldErrors.shortDesc?.[0]}>
        <input
          name="shortDesc"
          defaultValue={course?.shortDesc ?? ''}
          className={input}
          placeholder="Résumé en une phrase"
        />
      </Field>

      <Field label="Description complète" error={fieldErrors.description?.[0]}>
        <textarea
          name="description"
          defaultValue={course?.description ?? ''}
          required
          rows={5}
          className={`${input} resize-none`}
          placeholder="Description détaillée de la formation..."
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Prix (XOF)" error={fieldErrors.price?.[0]}>
          <input
            name="price"
            type="number"
            min="0"
            step="500"
            defaultValue={course ? course.price / 100 : 0}
            className={input}
            placeholder="0"
          />
        </Field>

        <Field label="Niveau" error={fieldErrors.level?.[0]}>
          <select name="level" defaultValue={course?.level ?? ''} className={input}>
            <option value="">— Non précisé —</option>
            <option value="debutant">Débutant</option>
            <option value="intermediaire">Intermédiaire</option>
            <option value="avance">Avancé</option>
          </select>
        </Field>

        <Field label="Langue" error={fieldErrors.language?.[0]}>
          <select name="language" defaultValue={course?.language ?? 'fr'} className={input}>
            <option value="fr">Français</option>
            <option value="en">Anglais</option>
            <option value="dioula">Dioula</option>
            <option value="moore">Mooré</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Catégorie" error={fieldErrors.categoryId?.[0]}>
          <select name="categoryId" defaultValue={course?.categoryId ?? ''} className={input}>
            <option value="">— Sans catégorie —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Statut" error={fieldErrors.status?.[0]}>
          <select name="status" defaultValue={course?.status ?? 'DRAFT'} className={input}>
            <option value="DRAFT">Brouillon</option>
            <option value="PUBLISHED">Publié</option>
            <option value="UNPUBLISHED">Non publié</option>
            <option value="ARCHIVED">Archivé</option>
          </select>
        </Field>
      </div>

      <Field label="URL de la miniature" error={fieldErrors.thumbnailUrl?.[0]}>
        <input
          name="thumbnailUrl"
          type="url"
          defaultValue={course?.thumbnailUrl ?? ''}
          className={input}
          placeholder="https://..."
        />
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {isPending ? 'Enregistrement...' : mode === 'create' ? 'Créer la formation' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/formations')}
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}

const input =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none'

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
