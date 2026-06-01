'use client'

import { useEffect, useState } from 'react'
import WeightChart from '@/components/charts/WeightChart'
import LoadChart from '@/components/charts/LoadChart'
import { logWeight } from '@/app/actions/weight'
import { Skeleton } from '@/components/ui/Skeleton'

type Period = '4w' | '8w' | '3m' | '1y'

interface ProgressData {
  currentWeight: number | null
  weightDelta: number | null
  totalSessions: number
  consistency: number
  weightHistory: { date: string; weight: number }[]
  exercises: { id: string; name: string }[]
  personalRecords: { exercise: string; weight: number; reps: number; date: string }[]
  insight: string | null
  trainingDays: string[]
}

// ─── Training Heatmap ────────────────────────────────────────────────────────

function TrainingHeatmap({ trainingDays, period }: { trainingDays: string[]; period: string }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  // Compute period start
  const periodStart = new Date(today)
  switch (period) {
    case '4w': periodStart.setDate(periodStart.getDate() - 28); break
    case '8w': periodStart.setDate(periodStart.getDate() - 56); break
    case '3m': periodStart.setMonth(periodStart.getMonth() - 3); break
    case '1y': periodStart.setFullYear(periodStart.getFullYear() - 1); break
    default: periodStart.setDate(periodStart.getDate() - 28)
  }

  // Build all days in range
  const allDays: string[] = []
  const cur = new Date(periodStart)
  while (cur <= today) {
    allDays.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }

  const trainingSet = new Set(trainingDays)

  // Pad to start on Monday
  const firstDay = new Date(allDays[0])
  // getDay() returns 0=Sun...6=Sat; we want 0=Mon...6=Sun
  const dayOfWeek = (firstDay.getDay() + 6) % 7 // 0=Mon
  const paddedDays: (string | null)[] = [
    ...Array(dayOfWeek).fill(null),
    ...allDays,
  ]

  // Group into weeks
  const weeks: (string | null)[][] = []
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7))
  }

  const DAY_LABELS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

  // Month labels per week
  function getMonthLabel(week: (string | null)[]): string | null {
    const firstReal = week.find(d => d !== null)
    if (!firstReal) return null
    const d = new Date(firstReal)
    // Show month label if first day of week is 1st–7th of month or first week
    if (d.getDate() <= 7) {
      return d.toLocaleString('pt-BR', { month: 'short' })
    }
    return null
  }

  return (
    <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
      <h2 className="text-sm font-medium mb-4">Frequência de treinos</h2>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {/* Day-of-week labels column */}
        <div className="flex flex-col gap-0.5 mr-1" style={{ paddingTop: '18px' }}>
          {DAY_LABELS.map((l, i) => (
            <div key={i} className="text-xs flex items-center justify-center" style={{ width: '12px', height: '12px', color: 'var(--color-text-muted)', fontSize: '9px' }}>
              {l}
            </div>
          ))}
        </div>
        {/* Weeks */}
        <div className="flex gap-0.5">
          {weeks.map((week, wi) => {
            const monthLabel = getMonthLabel(week)
            return (
              <div key={wi} className="flex flex-col gap-0.5">
                {/* Month label */}
                <div className="text-center" style={{ height: '16px', fontSize: '9px', color: 'var(--color-text-muted)' }}>
                  {monthLabel ?? ''}
                </div>
                {week.map((day, di) => {
                  if (day === null) {
                    return <div key={di} style={{ width: '12px', height: '12px' }} />
                  }
                  const hasSession = trainingSet.has(day)
                  const isToday = day === todayStr
                  return (
                    <div
                      key={di}
                      title={day}
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '2px',
                        backgroundColor: hasSession ? 'var(--color-primary)' : 'var(--color-surface)',
                        outline: isToday ? '2px solid var(--color-primary)' : 'none',
                        outlineOffset: isToday ? '1px' : '0',
                      }}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Menos</span>
        {[0, 1].map(v => (
          <div
            key={v}
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '2px',
              backgroundColor: v === 0 ? 'var(--color-surface)' : 'var(--color-primary)',
            }}
          />
        ))}
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Mais</span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProgressoPage() {
  const [period, setPeriod] = useState<Period>('4w')
  const [data, setData] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [loadHistory, setLoadHistory] = useState<{ date: string; weight: number; isPR: boolean }[]>([])
  const [loadingChart, setLoadingChart] = useState(false)
  const [insight, setInsight] = useState<string | null>(null)
  const [loadingInsight, setLoadingInsight] = useState(false)

  // Feature 1 — Weight modal
  const [showWeightModal, setShowWeightModal] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [weightNotes, setWeightNotes] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)
  const [weightError, setWeightError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch(`/api/progress?period=${period}`)
      if (res.ok) {
        const d = await res.json()
        setData(d)
        if (d.exercises.length > 0 && !selectedExercise) {
          setSelectedExercise(d.exercises[0].id)
        }
      }
    } catch {}
    setLoading(false)
  }

  async function loadExerciseHistory(exerciseId: string) {
    if (!exerciseId) return
    setLoadingChart(true)
    try {
      const res = await fetch(`/api/progress/exercise?exerciseId=${exerciseId}&period=${period}`)
      if (res.ok) {
        const d = await res.json()
        setLoadHistory(d.history)
      }
    } catch {}
    setLoadingChart(false)
  }

  async function loadInsight() {
    setLoadingInsight(true)
    try {
      const res = await fetch('/api/ai/insights')
      if (res.ok) {
        const d = await res.json()
        setInsight(d.insight)
      }
    } catch {}
    setLoadingInsight(false)
  }

  async function handleSaveWeight() {
    const kg = parseFloat(weightInput)
    if (!kg || kg <= 0) {
      setWeightError('Peso inválido')
      return
    }
    setSavingWeight(true)
    setWeightError(null)
    const result = await logWeight({ weightKg: kg, notes: weightNotes || undefined })
    setSavingWeight(false)
    if (result.error) {
      setWeightError(result.error)
      return
    }
    setShowWeightModal(false)
    setWeightInput('')
    setWeightNotes('')
    loadData()
  }

  useEffect(() => { loadData() }, [period])
  useEffect(() => { if (selectedExercise) loadExerciseHistory(selectedExercise) }, [selectedExercise, period])

  const PERIODS: { key: Period; label: string }[] = [
    { key: '4w', label: '4 sem' },
    { key: '8w', label: '8 sem' },
    { key: '3m', label: '3 meses' },
    { key: '1y', label: '1 ano' },
  ]

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="h-48 mb-4" />
        <Skeleton className="h-48 mb-4" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Progresso</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWeightModal(true)}
            className="text-xs px-3 py-1.5 rounded-lg text-white font-medium"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Registrar peso
          </button>
          <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-surface)' }}>
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className="text-xs px-3 py-1.5 rounded-md transition-all font-medium"
                style={{
                  backgroundColor: period === p.key ? 'var(--color-background)' : 'transparent',
                  color: period === p.key ? 'var(--color-text)' : 'var(--color-text-muted)',
                  boxShadow: period === p.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Peso atual</p>
          <p className="text-2xl font-medium">
            {data?.currentWeight?.toFixed(1) ?? '—'}
            {data?.currentWeight && <span className="text-sm font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>kg</span>}
          </p>
          {data?.weightDelta !== null && data?.weightDelta !== undefined && (
            <p className="text-xs mt-1" style={{ color: data.weightDelta < 0 ? 'var(--color-primary)' : data.weightDelta > 0 ? 'var(--color-fat)' : 'var(--color-text-muted)' }}>
              {data.weightDelta > 0 ? '+' : ''}{data.weightDelta.toFixed(1)} kg
            </p>
          )}
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Treinos</p>
          <p className="text-2xl font-medium">{data?.totalSessions ?? 0}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>no período</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Consistência</p>
          <p className="text-2xl font-medium">{data?.consistency ?? 0}%</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>dias ativos</p>
        </div>
      </div>

      {/* Training Heatmap (Feature 7) */}
      {data && (
        <TrainingHeatmap trainingDays={data.trainingDays ?? []} period={period} />
      )}

      {/* Weight chart */}
      <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
        <h2 className="text-sm font-medium mb-4">Evolução do peso</h2>
        {data && data.weightHistory.length > 0 ? (
          <WeightChart data={data.weightHistory} />
        ) : (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
            Nenhum registro de peso no período
          </p>
        )}
      </div>

      {/* Load chart */}
      <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium">Carga por exercício</h2>
          {data && data.exercises.length > 0 && (
            <select
              value={selectedExercise}
              onChange={e => setSelectedExercise(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-lg border outline-none"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            >
              {data.exercises.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          )}
        </div>
        {loadingChart ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}></div>
          </div>
        ) : loadHistory.length > 0 ? (
          <LoadChart data={loadHistory} />
        ) : (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
            Sem dados de carga no período
          </p>
        )}
      </div>

      {/* AI insight */}
      <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">Análise da semana</h2>
          <button
            onClick={loadInsight}
            disabled={loadingInsight}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
          >
            {loadingInsight ? 'Gerando...' : 'Gerar análise'}
          </button>
        </div>
        {insight ? (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{insight}</p>
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Clique em "Gerar análise" para receber um insight personalizado sobre sua semana.
          </p>
        )}
      </div>

      {/* Personal records */}
      {data && data.personalRecords.length > 0 && (
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
          <h2 className="text-sm font-medium mb-4">Recordes Pessoais</h2>
          <div className="space-y-2">
            {data.personalRecords.map((pr, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <p className="text-sm font-medium">{pr.exercise}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{pr.date}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium" style={{ color: 'var(--color-fat)' }}>
                    {pr.weight}kg × {pr.reps} reps
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weight modal (Feature 1) */}
      {showWeightModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-xl p-6 shadow-xl" style={{ backgroundColor: 'var(--color-background)' }}>
            <h2 className="text-base font-medium mb-4">Registrar peso</h2>
            <div className="mb-4">
              <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Peso (kg)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                placeholder="Ex: 75.5"
                autoFocus
                className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Notas (opcional)</label>
              <textarea
                value={weightNotes}
                onChange={e => setWeightNotes(e.target.value)}
                placeholder="Observações..."
                rows={2}
                className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none resize-none"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              />
            </div>
            {weightError && (
              <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#fef2f2', color: 'var(--color-alert)' }}>
                {weightError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowWeightModal(false); setWeightInput(''); setWeightNotes(''); setWeightError(null) }}
                className="flex-1 text-sm py-2.5 rounded-lg border transition-colors"
                style={{ borderColor: 'var(--color-border)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveWeight}
                disabled={savingWeight}
                className="flex-1 text-sm py-2.5 rounded-lg text-white font-medium transition-opacity disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {savingWeight ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
