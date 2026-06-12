'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { deleteWorkout } from '@/app/actions/workout'

interface WorkoutSession {
  date: string
}

interface WorkoutExercise {
  exercise: { name: string }
}

interface Workout {
  id: string
  name: string
  muscleGroups: string[]
  exercises: WorkoutExercise[]
  sessions: WorkoutSession[]
  createdAt: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
}

export default function TreinoPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function loadWorkouts() {
    setLoading(true)
    try {
      const res = await fetch('/api/workouts')
      if (res.ok) {
        const data = await res.json()
        setWorkouts(data.workouts ?? [])
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    loadWorkouts()
  }, [])

  // Close menu on outside click
  useEffect(() => {
    function handleClick() { setOpenMenu(null) }
    if (openMenu) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [openMenu])

  async function handleDelete(workoutId: string) {
    setDeleting(true)
    await deleteWorkout(workoutId)
    setDeleting(false)
    setConfirmDelete(null)
    setOpenMenu(null)
    loadWorkouts()
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}></div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Meus Treinos</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{workouts.length} {workouts.length === 1 ? 'treino criado' : 'treinos criados'}</p>
        </div>
        <Link
          href="/app/treino/novo"
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Criar treino
        </Link>
      </div>

      {workouts.length === 0 ? (
        <div className="rounded-xl p-12 text-center border-2 border-dashed" style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius-card)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--color-primary-light)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
              <path d="M18 20V10M12 20V4M6 20v-6"/>
            </svg>
          </div>
          <h2 className="text-base font-medium mb-2">Nenhum treino criado</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            Crie seu primeiro treino e comece a registrar seu progresso
          </p>
          <Link
            href="/app/treino/novo"
            className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-lg text-white font-medium"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Criar primeiro treino
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {workouts.map((workout) => {
            const lastSession = workout.sessions[0]
            const muscleGroups = workout.muscleGroups.slice(0, 3)
            const isMenuOpen = openMenu === workout.id
            const isConfirming = confirmDelete === workout.id

            return (
              <div
                key={workout.id}
                className="rounded-xl p-5 border relative"
                style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-card)' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                      <path d="M18 20V10M12 20V4M6 20v-6"/>
                    </svg>
                  </div>
                  {/* Three-dot menu */}
                  <div className="relative">
                    <button
                      onClick={e => { e.stopPropagation(); setOpenMenu(isMenuOpen ? null : workout.id); setConfirmDelete(null) }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                      style={{ color: 'var(--color-text-muted)' }}
                      aria-label="Opções do treino"
                      aria-haspopup="menu"
                      aria-expanded={isMenuOpen}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5"/>
                        <circle cx="12" cy="12" r="1.5"/>
                        <circle cx="12" cy="19" r="1.5"/>
                      </svg>
                    </button>
                    {isMenuOpen && (
                      <div
                        className="absolute right-0 top-9 w-40 rounded-xl border shadow-lg z-20 overflow-hidden"
                        style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <Link
                          href={`/app/treino/${workout.id}/editar`}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-900"
                          onClick={() => setOpenMenu(null)}
                        >
                          <span>✏️</span> Editar
                        </Link>
                        <button
                          onClick={() => setConfirmDelete(workout.id)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm w-full text-left transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                          style={{ color: 'var(--color-alert)' }}
                        >
                          <span>🗑</span> Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Confirm delete inline */}
                {isConfirming ? (
                  <div className="mb-3 p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-alert)' }}>
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-alert)' }}>Tem certeza? Essa ação não pode ser desfeita.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="flex-1 text-xs py-1.5 rounded-lg border"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', backgroundColor: 'transparent' }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleDelete(workout.id)}
                        disabled={deleting}
                        className="flex-1 text-xs py-1.5 rounded-lg text-white font-medium disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-alert)' }}
                      >
                        {deleting ? '...' : 'Excluir'}
                      </button>
                    </div>
                  </div>
                ) : null}

                <Link href={`/app/treino/${workout.id}`} className="block group">
                  <h3 className="text-sm font-medium mb-1 group-hover:underline">{workout.name}</h3>
                  <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                    {workout.exercises.length} {workout.exercises.length === 1 ? 'exercício' : 'exercícios'}
                  </p>
                  {muscleGroups.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {muscleGroups.map((mg) => (
                        <span key={mg} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                          {mg}
                        </span>
                      ))}
                      {workout.muscleGroups.length > 3 && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
                          +{workout.muscleGroups.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  {lastSession && (
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Último treino: {formatDate(lastSession.date)}
                    </p>
                  )}
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
