'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from '@/features/courses/category-actions'

type Category = { id: string; name: string; slug: string; description: string | null; _count: { courses: number } }

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const input = 'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none w-full'
const btn = (color: string) =>
  `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${color}`

export default function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Add form state
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addSlug, setAddSlug] = useState('')
  const [addDesc, setAddDesc] = useState('')

  // Edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editDesc, setEditDesc] = useState('')

  function run(action: () => Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }>, msg: string) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await action()
      if (result.success) {
        setSuccess(msg)
        setShowAdd(false)
        setEditId(null)
        setAddName(''); setAddSlug(''); setAddDesc('')
        router.refresh()
      } else {
        const fe = result.fieldErrors ? Object.values(result.fieldErrors).flat()[0] : undefined
        setError(fe ?? result.error ?? 'Erreur inconnue')
      }
    })
  }

  function startEdit(cat: Category) {
    setEditId(cat.id)
    setEditName(cat.name)
    setEditSlug(cat.slug)
    setEditDesc(cat.description ?? '')
  }

  function handleDelete(cat: Category) {
    if (!confirm(`Supprimer la catégorie "${cat.name}" ? Elle doit ne pas être utilisée par des formations.`)) return
    run(() => deleteCategoryAction(cat.id), `Catégorie "${cat.name}" supprimée.`)
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">{success}</div>}

      {/* Liste */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Nom</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Slug</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 hidden sm:table-cell">Description</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Formations</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map((cat) =>
              editId === cat.id ? (
                <tr key={cat.id} className="bg-blue-50/40">
                  <td className="px-4 py-2">
                    <input className={input} value={editName} onChange={(e) => { setEditName(e.target.value); setEditSlug(slugify(e.target.value)) }} placeholder="Nom" />
                  </td>
                  <td className="px-4 py-2">
                    <input className={input} value={editSlug} onChange={(e) => setEditSlug(e.target.value)} placeholder="slug" />
                  </td>
                  <td className="px-4 py-2 hidden sm:table-cell">
                    <input className={input} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description (opt.)" />
                  </td>
                  <td className="px-4 py-2 text-center">—</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button
                        disabled={isPending}
                        onClick={() => {
                          const fd = new FormData()
                          fd.set('name', editName); fd.set('slug', editSlug); fd.set('description', editDesc)
                          run(() => updateCategoryAction(cat.id, fd), `"${editName}" mis à jour.`)
                        }}
                        className={btn('bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50')}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditId(null)} className={btn('bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{cat.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cat.slug}</td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell line-clamp-1">{cat.description ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{cat._count.courses}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => startEdit(cat)} className={btn('text-gray-500 hover:bg-gray-100')}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button disabled={isPending} onClick={() => handleDelete(cat)} className={btn('text-red-500 hover:bg-red-50')}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Aucune catégorie pour l'instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Formulaire d'ajout */}
      {showAdd ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Nouvelle catégorie</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nom *</label>
              <input className={input} value={addName} onChange={(e) => { setAddName(e.target.value); setAddSlug(slugify(e.target.value)) }} placeholder="Ex. Développement web" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Slug *</label>
              <input className={input} value={addSlug} onChange={(e) => setAddSlug(e.target.value)} placeholder="ex. developpement-web" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Description</label>
              <input className={input} value={addDesc} onChange={(e) => setAddDesc(e.target.value)} placeholder="Description courte (optionnel)" />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              disabled={isPending || !addName || !addSlug}
              onClick={() => {
                const fd = new FormData()
                fd.set('name', addName); fd.set('slug', addSlug); fd.set('description', addDesc)
                run(() => createCategoryAction(fd), `Catégorie "${addName}" créée.`)
              }}
              className={btn('bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50')}
            >
              Créer
            </button>
            <button onClick={() => setShowAdd(false)} className={btn('bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className={btn('border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 w-full justify-center py-2.5')}>
          <Plus className="h-4 w-4" /> Ajouter une catégorie
        </button>
      )}
    </div>
  )
}
