'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateWorkout } from '@/app/actions/workout'
import Link from 'next/link'

const MUSCLE_GROUPS = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Pernas', 'Glúteos', 'Abdômen', 'Cardio']

const EXERCISE_DATABASE = [
  { name: 'Supino Reto', muscleGroup: 'Peito' },
  { name: 'Supino Inclinado', muscleGroup: 'Peito' },
  { name: 'Crucifixo', muscleGroup: 'Peito' },
  { name: 'Peck Deck', muscleGroup: 'Peito' },
  { name: 'Paralelas', muscleGroup: 'Peito' },
  { name: 'Puxada Frontal', muscleGroup: 'Costas' },
  { name: 'Remada Curvada', muscleGroup: 'Costas' },
  { name: 'Remada Unilateral', muscleGroup: 'Costas' },
  { name: 'Pulldown', muscleGroup: 'Costas' },
  { name: 'Levantamento Terra', muscleGroup: 'Costas' },
  { name: 'Desenvolvimento', muscleGroup: 'Ombros' },
  { name: 'Elevação Lateral', muscleGroup: 'Ombros' },
  { name: 'Elevação Frontal', muscleGroup: 'Ombros' },
  { name: 'Rosca Direta', muscleGroup: 'Bíceps' },
  { name: 'Rosca Alternada', muscleGroup: 'Bíceps' },
  { name: 'Rosca Martelo', muscleGroup: 'Bíceps' },
  { name: 'Tríceps Corda', muscleGroup: 'Tríceps' },
  { name: 'Tríceps Testa', muscleGroup: 'Tríceps' },
  { name: 'Tríceps Francês', muscleGroup: 'Tríceps' },
  { name: 'Agachamento', muscleGroup: 'Pernas' },
  { name: 'Leg Press', muscleGroup: 'Pernas' },
  { name: 'Extensora', muscleGroup: 'Pernas' },
  { name: 'Flexora', muscleGroup: 'Pernas' },
  { name: 'Stiff', muscleGroup: 'Pernas' },
  { name: 'Cadeira Abdutora', muscleGroup: 'Glúteos' },
  { name: 'Hip Thrust', muscleGroup: 'Glúteos' },
  { name: 'Glúteo no Cross', muscleGroup: 'Glúteos' },
  { name: 'Abdominal Crunch', muscleGroup: 'Abdômen' },
  { name: 'Prancha', muscleGroup: 'Abdômen' },
  { name: 'Abdominal Infra', muscleGroup: 'Abdômen' },
  { name: 'Corrida', muscleGroup: 'Cardio' },
  { name: 'Bicicleta', muscleGroup: 'Cardio' },
  { name: 'Elíptico', muscleGroup: 'Cardio' },
]

interface SelectedExercise {
  name: string
  muscleGroup: string
  targetSets: number
  targetReps: number
}

export default function EditarTreinoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [name, setName] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [exercises, setExercises] = useState<SelectedExercise[]>([])
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadWorkout() {
      try {
        const res = await fetch(`/api/workouts/${id}`)
        if (!res.ok) throw new Error('Treino não encontrado')
        const data = await res.json()
        setName(data.workout.name)
        setSelectedGroups(data.workout.muscleGroups ?? [])
        setExercises(
          data.exercises.map((ex: { name: string; muscleGroup: string; targetSets: number; targetReps: number }) => ({
            name: ex.name,
            muscleGroup: ex.muscleGroup ?? '',
            targetSets: ex.targetSets,
            targetReps: ex.targetReps,
          }))
        )
      } catch {
        setError('Erro ao carregar treino.')
      } finally {
        setLoading(false)
      }
    }
    loadWorkout()
  }, [id])

  const filteredExercises = EXERCISE_DATABASE.filter(ex =>
    ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()) &&
    !exercises.find(e => e.name === ex.name)
  )

  function toggleGroup(group: string) {
    setSelectedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    )
  }

  function addExercise(ex: typeof EXERCISE_DATABASE[0]) {
    setExercises(prev => [...prev, { ...ex, targetSets: 3, targetReps: 10 }])
    setExerciseSearch('')
    if (!selectedGroups.includes(ex.muscleGroup)) {
      setSelectedGroups(prev => [...prev, ex.muscleGroup])
    }
  }

  function removeExercise(index: number) {
    setExercises(prev => prev.filter((_, i) => i !== index))
  }

  function updateExercise(index: number, field: 'targetSets' | 'targetReps', value: number) {
    setExercises(prev => prev.map((ex, i) => i === index ? { ...ex, [field]: value } : ex))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Digite um nome para o treino'); return }
    if (exercises.length === 0) { setError('Adicione pelo menos um exercício'); return }

    setSaving(true)
    setError(null)
    try {
      const result = await updateWorkout({
        id,
        name: name.trim(),
        muscleGroups: selectedGroups,
        exercises: exercises.map((ex, i) => ({
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
          order: i,
        })),
      })
      if (result.error) { setError(result.error); return }
      router.push('/app/treino')
    } catch {
      setError('Erro ao salvar treino. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}></div>
      </div>
    )
  }

  if (error && exercises.length === 0 && !name) {
    return <div className="p-6 text-center" style={{ color: 'var(--color-alert)' }}>{error}</div>
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/app/treino" className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors hover:bg-gray-50 dark:hover:bg-gray-900" style={{ borderColor: 'var(--color-border)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <h1 className="text-xl font-medium">Editar Treino</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
          <label className="block text-sm font-medium mb-3">Nome do treino</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Treino A — Peito e Tríceps"
            className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          />
        </div>

        {/* Muscle groups */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
          <label className="block text-sm font-medium mb-3">Grupos musculares</label>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map(group => (
              <button
                key={group}
                type="button"
                onClick={() => toggleGroup(group)}
                className="text-xs px-3 py-1.5 rounded-full border transition-all"
                style={{
                  borderColor: selectedGroups.includes(group) ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor: selectedGroups.includes(group) ? 'var(--color-primary-light)' : 'transparent',
                  color: selectedGroups.includes(group) ? 'var(--color-primary)' : 'var(--color-text-muted)',
                }}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        {/* Exercises */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
          <label className="block text-sm font-medium mb-3">Exercícios</label>

          {/* Search */}
          <div className="relative mb-4">
            <input
              type="text"
              value={exerciseSearch}
              onChange={e => setExerciseSearch(e.target.value)}
              placeholder="Buscar exercício..."
              className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            />
            {exerciseSearch && filteredExercises.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-lg z-10 max-h-48 overflow-y-auto" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
                {filteredExercises.map(ex => (
                  <button
                    key={ex.name}
                    type="button"
                    onClick={() => addExercise(ex)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    <span>{ex.name}</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{ex.muscleGroup}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected exercises */}
          {exercises.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
              Busque e adicione exercícios acima
            </p>
          ) : (
            <div className="space-y-3">
              {exercises.map((ex, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ex.name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{ex.muscleGroup}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-center">
                      <span className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Séries</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={ex.targetSets}
                        onChange={e => updateExercise(i, 'targetSets', parseInt(e.target.value) || 1)}
                        className="w-12 text-center text-sm py-1 rounded border outline-none"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
                      />
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>×</span>
                    <div className="flex flex-col items-center">
                      <span className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Reps</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={ex.targetReps}
                        onChange={e => updateExercise(i, 'targetReps', parseInt(e.target.value) || 1)}
                        className="w-12 text-center text-sm py-1 rounded border outline-none"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExercise(i)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                      style={{ color: 'var(--color-alert)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg" style={{ backgroundColor: '#fef2f2', color: 'var(--color-alert)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full text-sm py-3 px-4 rounded-lg text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  )
}
