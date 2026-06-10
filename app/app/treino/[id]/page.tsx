'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordSession } from '@/app/actions/workout'
import { detectPersonalRecord } from '@/lib/calculations'
import Link from 'next/link'

interface SetData {
  setNumber: number
  weightKg: string
  reps: string
  isPR: boolean
  completed: boolean
}

interface ExerciseData {
  id: string
  name: string
  targetSets: number
  targetReps: number
  sets: SetData[]
  lastSets: { weightKg: number | null; reps: number | null }[]
}

// ─── Rest Timer Banner ────────────────────────────────────────────────────────

function RestTimerBanner({
  restRemaining,
  onSkip,
  onAdd30,
}: {
  restRemaining: number
  onSkip: () => void
  onAdd30: () => void
}) {
  const minutes = Math.floor(restRemaining / 60)
  const seconds = restRemaining % 60
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div
      className="fixed bottom-16 md:bottom-4 left-1/2 z-40 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg"
      style={{
        transform: 'translateX(-50%)',
        backgroundColor: 'var(--color-background)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="text-center">
        <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Descanso</p>
        <p className="text-2xl font-medium tabular-nums" style={{ color: 'var(--color-primary)' }}>{display}</p>
      </div>
      <div className="flex flex-col gap-1">
        <button
          onClick={onAdd30}
          className="text-xs px-3 py-1 rounded-lg border font-medium"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          +30s
        </button>
        <button
          onClick={onSkip}
          className="text-xs px-3 py-1 rounded-lg border font-medium"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-alert)' }}
        >
          Pular
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TreinoSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [workout, setWorkout] = useState<{ id: string; name: string } | null>(null)
  const [exercises, setExercises] = useState<ExerciseData[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startTime] = useState(Date.now())

  // Feature 2 — Rest timer
  const [restSeconds, setRestSeconds] = useState(90)
  const [restRemaining, setRestRemaining] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (restRemaining === null) return
    if (restRemaining <= 0) {
      // Beep
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        osc.connect(ctx.destination)
        osc.frequency.value = 440
        osc.start()
        osc.stop(ctx.currentTime + 0.2)
      } catch {}
      setToast('Descanso concluído! 💪')
      setTimeout(() => setToast(null), 3000)
      setRestRemaining(null)
      return
    }
    const timerId = setInterval(() => setRestRemaining(r => r !== null ? r - 1 : null), 1000)
    return () => clearInterval(timerId)
  }, [restRemaining])

  function startRest() {
    setRestRemaining(restSeconds)
  }

  useEffect(() => {
    async function loadWorkout() {
      try {
        const res = await fetch(`/api/workouts/${id}`)
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          console.error(`[treino/${id}] API ${res.status}:`, body)
          throw new Error(body?.error ?? `Erro ${res.status} ao carregar treino`)
        }
        const data = await res.json()
        setWorkout(data.workout)
        setExercises(
          data.exercises.map((ex: {
            id: string; name: string; targetSets: number; targetReps: number;
            lastSets: { weightKg: number | null; reps: number | null }[]
          }) => ({
            id: ex.id,
            name: ex.name,
            targetSets: ex.targetSets,
            targetReps: ex.targetReps,
            lastSets: ex.lastSets,
            sets: Array.from({ length: ex.targetSets }, (_, i) => ({
              setNumber: i + 1,
              weightKg: ex.lastSets[i]?.weightKg?.toString() ?? '',
              reps: ex.lastSets[i]?.reps?.toString() ?? ex.targetReps.toString(),
              isPR: false,
              completed: false,
            })),
          }))
        )
      } catch (e) {
        console.error(`[treino/${id}] load failed:`, e)
        setError(e instanceof Error ? e.message : 'Erro ao carregar treino.')
      } finally {
        setLoading(false)
      }
    }
    loadWorkout()
  }, [id])

  function updateSet(exIndex: number, setIndex: number, field: 'weightKg' | 'reps', value: string) {
    setExercises(prev => prev.map((ex, ei) => {
      if (ei !== exIndex) return ex
      const newSets = ex.sets.map((s, si) => {
        if (si !== setIndex) return s
        const updated = { ...s, [field]: value }
        // Check PR
        const weight = parseFloat(field === 'weightKg' ? value : s.weightKg)
        const reps = parseInt(field === 'reps' ? value : s.reps)
        if (weight && reps) {
          const prevSets = ex.lastSets.map(ls => ({ weightKg: ls.weightKg, reps: ls.reps }))
          updated.isPR = detectPersonalRecord(weight, reps, prevSets)
        }
        return updated
      })
      return { ...ex, sets: newSets }
    }))
  }

  // Feature 3 — Set checkmark
  function toggleSetCompleted(exIndex: number, setIndex: number) {
    setExercises(prev => prev.map((ex, ei) => {
      if (ei !== exIndex) return ex
      const newSets = ex.sets.map((s, si) => {
        if (si !== setIndex) return s
        return { ...s, completed: !s.completed }
      })
      return { ...ex, sets: newSets }
    }))
    // Start rest when completing a set
    const set = exercises[exIndex]?.sets[setIndex]
    if (set && !set.completed) {
      startRest()
    }
  }

  function addSet(exIndex: number) {
    setExercises(prev => prev.map((ex, ei) => {
      if (ei !== exIndex) return ex
      const newSet: SetData = {
        setNumber: ex.sets.length + 1,
        weightKg: ex.sets[ex.sets.length - 1]?.weightKg ?? '',
        reps: ex.sets[ex.sets.length - 1]?.reps ?? ex.targetReps.toString(),
        isPR: false,
        completed: false,
      }
      return { ...ex, sets: [...ex.sets, newSet] }
    }))
  }

  async function handleFinish() {
    setSaving(true)
    setError(null)
    const duration = Math.round((Date.now() - startTime) / 60000)
    try {
      const result = await recordSession({
        workoutId: id,
        notes,
        duration,
        exercises: exercises.map(ex => ({
          exerciseId: ex.id,
          sets: ex.sets
            .filter(s => s.weightKg || s.reps)
            .map(s => ({
              setNumber: s.setNumber,
              weightKg: s.weightKg ? parseFloat(s.weightKg) : null,
              reps: s.reps ? parseInt(s.reps) : null,
              isPersonalRecord: s.isPR,
            })),
        })).filter(ex => ex.sets.length > 0),
      })
      if (result.error) { setError(result.error); return }
      router.push('/app/treino')
    } catch {
      setError('Erro ao salvar treino. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const anySetCompleted = exercises.some(ex => ex.sets.some(s => s.completed))

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}></div>
      </div>
    )
  }

  if (error && !workout) {
    return <div className="p-6 text-center" style={{ color: 'var(--color-alert)' }}>{error}</div>
  }

  const REST_OPTIONS = [
    { label: '60s', value: 60 },
    { label: '90s', value: 90 },
    { label: '120s', value: 120 },
    { label: '180s', value: 180 },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-32">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 z-50 px-4 py-2 rounded-full text-sm font-medium text-white shadow-lg"
          style={{ transform: 'translateX(-50%)', backgroundColor: 'var(--color-primary)' }}
        >
          {toast}
        </div>
      )}

      {/* Rest timer banner */}
      {restRemaining !== null && (
        <RestTimerBanner
          restRemaining={restRemaining}
          onSkip={() => setRestRemaining(null)}
          onAdd30={() => setRestRemaining(r => r !== null ? r + 30 : 30)}
        />
      )}

      <div className="flex items-center gap-3 mb-4">
        <Link href="/app/treino" className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{ borderColor: 'var(--color-border)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-medium">{workout?.name ?? 'Treino'}</h1>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Registrar sessão</p>
        </div>
      </div>

      {/* Rest duration selector */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Descanso:</span>
        <div className="flex gap-1">
          {REST_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                setRestSeconds(opt.value)
                if (restRemaining !== null) setRestRemaining(opt.value)
              }}
              className="text-xs px-2.5 py-1 rounded-lg border transition-all"
              style={{
                borderColor: restSeconds === opt.value ? 'var(--color-primary)' : 'var(--color-border)',
                backgroundColor: restSeconds === opt.value ? 'var(--color-primary-light)' : 'transparent',
                color: restSeconds === opt.value ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {exercises.map((ex, ei) => (
          <div key={ex.id} className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium">{ex.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                  Meta: {ex.targetSets}×{ex.targetReps}
                </span>
              </div>
            </div>

            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-xs mb-2 px-2" style={{ color: 'var(--color-text-muted)' }}>
              <span className="col-span-1">#</span>
              <span className="col-span-4">Peso (kg)</span>
              <span className="col-span-4">Reps</span>
              <span className="col-span-3 text-center">OK</span>
            </div>

            {ex.sets.map((s, si) => (
              <div
                key={si}
                className="grid grid-cols-12 gap-2 items-center py-1.5 rounded-lg transition-all"
                style={{
                  opacity: s.completed ? 0.7 : 1,
                  backgroundColor: s.completed ? 'var(--color-surface)' : 'transparent',
                }}
              >
                <span className="col-span-1 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{s.setNumber}</span>
                <div className="col-span-4">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={s.weightKg}
                    onChange={e => updateSet(ei, si, 'weightKg', e.target.value)}
                    placeholder={ex.lastSets[si]?.weightKg?.toString() ?? '—'}
                    className="w-full text-center text-sm py-1.5 rounded-lg border outline-none"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  />
                </div>
                <div className="col-span-4">
                  <input
                    type="number"
                    min="0"
                    value={s.reps}
                    onChange={e => updateSet(ei, si, 'reps', e.target.value)}
                    placeholder={ex.targetReps.toString()}
                    className="w-full text-center text-sm py-1.5 rounded-lg border outline-none"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  />
                </div>
                <div className="col-span-3 flex justify-center">
                  {/* Checkmark button with optional PR badge */}
                  <div className="relative">
                    {s.isPR && !s.completed && (
                      <span
                        className="absolute -top-2 -right-2 text-xs px-1 py-0.5 rounded font-bold z-10"
                        style={{ backgroundColor: '#fff8e1', color: 'var(--color-fat)', fontSize: '9px', lineHeight: '1' }}
                      >
                        PR!
                      </span>
                    )}
                    <button
                      onClick={() => toggleSetCompleted(ei, si)}
                      className="flex items-center justify-center rounded-full border-2 transition-all"
                      style={{
                        width: '32px',
                        height: '32px',
                        borderColor: s.completed ? 'var(--color-primary)' : 'var(--color-border)',
                        backgroundColor: s.completed ? 'var(--color-primary)' : 'transparent',
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={s.completed ? 'white' : 'currentColor'}
                        strokeWidth="2.5"
                        style={{ opacity: s.completed ? 1 : 0.3, color: 'var(--color-text-muted)' }}
                      >
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addSet(ei)}
              className="mt-2 text-xs flex items-center gap-1 transition-colors"
              style={{ color: 'var(--color-primary)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Adicionar série
            </button>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
        <label className="block text-sm font-medium mb-2">Notas (opcional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Como foi o treino? Alguma observação?"
          rows={3}
          className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none resize-none"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        />
      </div>

      {error && (
        <p className="text-sm p-3 rounded-lg mb-4" style={{ backgroundColor: '#fef2f2', color: 'var(--color-alert)' }}>
          {error}
        </p>
      )}

      <button
        onClick={handleFinish}
        disabled={saving || !anySetCompleted}
        className="w-full text-sm py-3 px-4 rounded-lg text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {saving ? 'Salvando...' : 'Finalizar treino'}
      </button>
    </div>
  )
}
