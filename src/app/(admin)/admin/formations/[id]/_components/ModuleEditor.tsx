'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  PlayCircle,
  FileText,
  AlignLeft,
  HelpCircle,
} from 'lucide-react'
import {
  createModuleAction,
  updateModuleAction,
  deleteModuleAction,
  moveModuleAction,
} from '@/features/courses/module-actions'
import {
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
  moveLessonAction,
} from '@/features/courses/lesson-actions'
import LessonFileUpload from './LessonFileUpload'

type LessonType = 'VIDEO' | 'DOCUMENT' | 'TEXT' | 'QUIZ'

interface LessonData {
  id: string
  title: string
  type: LessonType
  position: number
  description: string | null
  isFree: boolean
  video: { providerVideoId: string } | null
  documents: { storageKey: string }[]
}

interface ModuleData {
  id: string
  title: string
  position: number
  lessons: LessonData[]
}

interface Props {
  courseId: string
  modules: ModuleData[]
}

const LESSON_TYPES: { value: LessonType; label: string; icon: React.ReactNode }[] = [
  { value: 'VIDEO', label: 'Vidéo', icon: <PlayCircle className="h-3.5 w-3.5" /> },
  { value: 'DOCUMENT', label: 'Document', icon: <FileText className="h-3.5 w-3.5" /> },
  { value: 'TEXT', label: 'Texte', icon: <AlignLeft className="h-3.5 w-3.5" /> },
  { value: 'QUIZ', label: 'Quiz', icon: <HelpCircle className="h-3.5 w-3.5" /> },
]

const input = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none'
const iconBtn = (color: string) =>
  `inline-flex items-center justify-center rounded-lg p-1.5 text-xs transition-colors disabled:opacity-40 ${color}`

function LessonTypeBadge({ type }: { type: LessonType }) {
  const t = LESSON_TYPES.find((l) => l.value === type)
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
      {t?.icon} {t?.label}
    </span>
  )
}

export default function ModuleEditor({ courseId, modules }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  // Modules
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(modules.map((m) => m.id)))
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [showNewModule, setShowNewModule] = useState(false)
  const [editModuleId, setEditModuleId] = useState<string | null>(null)
  const [editModuleTitle, setEditModuleTitle] = useState('')

  // Lessons (per module)
  const [showNewLesson, setShowNewLesson] = useState<string | null>(null) // moduleId
  const [newLesson, setNewLesson] = useState({ title: '', type: 'VIDEO' as LessonType, description: '', isFree: false })
  const [editLessonId, setEditLessonId] = useState<string | null>(null)
  const [editLesson, setEditLesson] = useState({ title: '', type: 'VIDEO' as LessonType, description: '', isFree: false })

  function run(action: () => Promise<{ success: boolean; error?: string }>, msg: string) {
    setToast(null)
    startTransition(async () => {
      const result = await action()
      if (result.success) {
        setToast({ type: 'ok', msg })
        setShowNewModule(false)
        setEditModuleId(null)
        setShowNewLesson(null)
        setEditLessonId(null)
        setNewModuleTitle('')
        setNewLesson({ title: '', type: 'VIDEO', description: '', isFree: false })
        router.refresh()
      } else {
        setToast({ type: 'err', msg: result.error ?? 'Erreur inconnue' })
      }
    })
  }

  function toggleModule(id: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const isFirst = (items: { position: number }[], item: { position: number }) =>
    item.position === Math.min(...items.map((i) => i.position))
  const isLast = (items: { position: number }[], item: { position: number }) =>
    item.position === Math.max(...items.map((i) => i.position))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Modules & Leçons</h2>
      </div>

      {toast && (
        <div
          className={`rounded-lg px-4 py-2 text-sm border ${
            toast.type === 'ok'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Liste des modules */}
      <div className="space-y-3">
        {modules.map((mod) => (
          <div key={mod.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            {/* En-tête du module */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
              <button onClick={() => toggleModule(mod.id)} className="text-gray-400 hover:text-gray-600">
                {expandedModules.has(mod.id) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              {editModuleId === mod.id ? (
                <>
                  <input
                    className="flex-1 rounded-lg border border-blue-300 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none"
                    value={editModuleTitle}
                    onChange={(e) => setEditModuleTitle(e.target.value)}
                    autoFocus
                  />
                  <button
                    disabled={isPending}
                    onClick={() => run(() => updateModuleAction(mod.id, courseId, editModuleTitle), 'Module renommé.')}
                    className={iconBtn('bg-blue-600 text-white hover:bg-blue-700')}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setEditModuleId(null)} className={iconBtn('bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-gray-900">{mod.title}</span>
                  <span className="text-xs text-gray-400 mr-1">{mod.lessons.length} leçon{mod.lessons.length !== 1 ? 's' : ''}</span>

                  <button
                    disabled={isPending || isFirst(modules, mod)}
                    onClick={() => run(() => moveModuleAction(mod.id, 'up'), 'Module déplacé.')}
                    className={iconBtn('text-gray-400 hover:bg-gray-200')}
                    title="Monter"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled={isPending || isLast(modules, mod)}
                    onClick={() => run(() => moveModuleAction(mod.id, 'down'), 'Module déplacé.')}
                    className={iconBtn('text-gray-400 hover:bg-gray-200')}
                    title="Descendre"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { setEditModuleId(mod.id); setEditModuleTitle(mod.title) }}
                    className={iconBtn('text-gray-400 hover:bg-gray-100')}
                    title="Renommer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => {
                      if (!confirm(`Supprimer le module "${mod.title}" et toutes ses leçons ?`)) return
                      run(() => deleteModuleAction(mod.id), `Module "${mod.title}" supprimé.`)
                    }}
                    className={iconBtn('text-red-400 hover:bg-red-50')}
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Leçons du module */}
            {expandedModules.has(mod.id) && (
              <div className="divide-y divide-gray-50">
                {mod.lessons.map((lesson) => (
                  <div key={lesson.id} className="px-4 py-2.5">
                    {editLessonId === lesson.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            className={input}
                            value={editLesson.title}
                            onChange={(e) => setEditLesson((p) => ({ ...p, title: e.target.value }))}
                            placeholder="Titre"
                            autoFocus
                          />
                          <select
                            className={input}
                            value={editLesson.type}
                            onChange={(e) => setEditLesson((p) => ({ ...p, type: e.target.value as LessonType }))}
                          >
                            {LESSON_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <input
                          className={input}
                          value={editLesson.description}
                          onChange={(e) => setEditLesson((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Description (optionnel)"
                        />
                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editLesson.isFree}
                            onChange={(e) => setEditLesson((p) => ({ ...p, isFree: e.target.checked }))}
                            className="accent-blue-600"
                          />
                          Leçon gratuite (accessible sans inscription)
                        </label>
                        {(editLesson.type === 'VIDEO' || editLesson.type === 'DOCUMENT') && (
                          <LessonFileUpload
                            lessonId={lesson.id}
                            fileType={editLesson.type === 'VIDEO' ? 'video' : 'document'}
                            currentKey={lesson.video?.providerVideoId ?? lesson.documents[0]?.storageKey ?? null}
                          />
                        )}
                        <div className="flex gap-2">
                          <button
                            disabled={isPending}
                            onClick={() =>
                              run(
                                () => updateLessonAction(lesson.id, { ...editLesson }),
                                'Leçon mise à jour.',
                              )
                            }
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            Enregistrer
                          </button>
                          <button onClick={() => setEditLessonId(null)} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200">
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <LessonTypeBadge type={lesson.type} />
                        <span className="flex-1 text-sm text-gray-800">{lesson.title}</span>
                        {lesson.isFree && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Gratuit</span>
                        )}

                        <button
                          disabled={isPending || isFirst(mod.lessons, lesson)}
                          onClick={() => run(() => moveLessonAction(lesson.id, 'up'), 'Leçon déplacée.')}
                          className={iconBtn('text-gray-300 hover:text-gray-500 hover:bg-gray-100')}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled={isPending || isLast(mod.lessons, lesson)}
                          onClick={() => run(() => moveLessonAction(lesson.id, 'down'), 'Leçon déplacée.')}
                          className={iconBtn('text-gray-300 hover:text-gray-500 hover:bg-gray-100')}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditLessonId(lesson.id)
                            setEditLesson({ title: lesson.title, type: lesson.type, description: lesson.description ?? '', isFree: lesson.isFree })
                          }}
                          className={iconBtn('text-gray-400 hover:bg-gray-100')}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => {
                            if (!confirm(`Supprimer la leçon "${lesson.title}" ? Les progressions liées seront recalculées.`)) return
                            run(() => deleteLessonAction(lesson.id), `Leçon "${lesson.title}" supprimée.`)
                          }}
                          className={iconBtn('text-red-400 hover:bg-red-50')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Formulaire ajout leçon */}
                {showNewLesson === mod.id ? (
                  <div className="px-4 py-3 bg-blue-50/40 border-t border-blue-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className={input}
                        value={newLesson.title}
                        onChange={(e) => setNewLesson((p) => ({ ...p, title: e.target.value }))}
                        placeholder="Titre de la leçon"
                        autoFocus
                      />
                      <select
                        className={input}
                        value={newLesson.type}
                        onChange={(e) => setNewLesson((p) => ({ ...p, type: e.target.value as LessonType }))}
                      >
                        {LESSON_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <input
                      className={input}
                      value={newLesson.description}
                      onChange={(e) => setNewLesson((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Description (optionnel)"
                    />
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newLesson.isFree}
                        onChange={(e) => setNewLesson((p) => ({ ...p, isFree: e.target.checked }))}
                        className="accent-blue-600"
                      />
                      Leçon gratuite
                    </label>
                    <div className="flex gap-2">
                      <button
                        disabled={isPending || !newLesson.title}
                        onClick={() =>
                          run(
                            () => createLessonAction(mod.id, { ...newLesson }),
                            `Leçon "${newLesson.title}" ajoutée.`,
                          )
                        }
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Ajouter la leçon
                      </button>
                      <button onClick={() => setShowNewLesson(null)} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200">
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-2 border-t border-dashed border-gray-100">
                    <button
                      onClick={() => { setShowNewLesson(mod.id); setNewLesson({ title: '', type: 'VIDEO', description: '', isFree: false }) }}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> Ajouter une leçon
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Formulaire nouveau module */}
      {showNewModule ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 flex items-center gap-3">
          <input
            className={input}
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="Titre du module"
            autoFocus
          />
          <button
            disabled={isPending || !newModuleTitle.trim()}
            onClick={() => run(() => createModuleAction(courseId, newModuleTitle), `Module "${newModuleTitle}" créé.`)}
            className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Créer
          </button>
          <button onClick={() => { setShowNewModule(false); setNewModuleTitle('') }} className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200">
            Annuler
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowNewModule(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <Plus className="h-4 w-4" /> Ajouter un module
        </button>
      )}
    </div>
  )
}
