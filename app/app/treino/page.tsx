'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { setWorkoutArchived } from '@/app/actions/workout'

type Tab = 'today' | 'history' | 'saved'

interface WorkoutExercise {
  id: string
  name: string
  muscleGroup: string
  targetSets: number
  targetReps: number
  order: number
}

interface Workout {
  id: string
  name: string
  muscleGroups: string[]
  archived: boolean
  scheduledWeekdays: number[]
  createdAt: string
  sessionCount: number
  exercises: WorkoutExercise[]
  sessions: Array<{ id: string; date: string; duration: number | null }>
}

interface SessionSet {
  id: string
  exerciseId: string
  exerciseName: string
  setNumber: number
  weightKg: number | null
  reps: number | null
  isPersonalRecord: boolean
}

interface WorkoutSession {
  id: string
  workoutId: string
  workoutName: string
  workoutArchived: boolean
  date: string
  duration: number | null
  notes: string | null
  sets: SessionSet[]
}

interface WorkoutData {
  workouts: Workout[]
  archivedWorkouts: Workout[]
  recentSessions: WorkoutSession[]
}

const EMPTY_DATA: WorkoutData = { workouts: [], archivedWorkouts: [], recentSessions: [] }
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function localDateKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value))
}

function shortDate(value: string | Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'short',
  }).format(new Date(value)).replace('.', '')
}

function weekdayDate(value: string | Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(value)).replaceAll('.', '')
}

function workoutLetter(name: string, index = 0) {
  const match = name.match(/(?:treino\s+)?([A-Z])(?:\s|\s*[—-])/i)
  return match?.[1]?.toUpperCase() ?? String.fromCharCode(65 + (index % 26))
}

function sessionVolume(session: WorkoutSession) {
  return session.sets.reduce((sum, set) => sum + (set.weightKg ?? 0) * (set.reps ?? 0), 0)
}

function formatVolume(value: number) {
  if (value >= 1000) return `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t`
  return `${Math.round(value).toLocaleString('pt-BR')} kg`
}

function targetLabel(exercise: WorkoutExercise) {
  return `${exercise.targetSets}×${exercise.targetReps}`
}

function PlusIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
}

function WorkoutIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
}

function Chevron({ open = false }: { open?: boolean }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="m6 9 6 6 6-6" /></svg>
}

function EmptyWorkouts() {
  return (
    <div className="rounded-xl border-2 border-dashed px-6 py-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
        <WorkoutIcon size={26} />
      </div>
      <h2 className="mb-2 text-base font-medium">Seu treino começa aqui</h2>
      <p className="mx-auto mb-6 max-w-sm text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Crie uma rotina do zero ou deixe a IA montar uma divisão alinhada às suas metas.
      </p>
      <Link href="/app/treino/novo" className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
        <PlusIcon /> Criar primeiro treino
      </Link>
    </div>
  )
}

export default function TreinoPage() {
  const [data, setData] = useState<WorkoutData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('today')
  const [historyFilter, setHistoryFilter] = useState('all')
  const [historyLimit, setHistoryLimit] = useState(20)
  const [openSession, setOpenSession] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [pendingWorkout, setPendingWorkout] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/workouts')
      if (!response.ok) throw new Error('Não foi possível carregar seus treinos.')
      const payload = await response.json()
      setData({
        workouts: payload.workouts ?? [],
        archivedWorkouts: payload.archivedWorkouts ?? [],
        recentSessions: payload.recentSessions ?? [],
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar seus treinos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const todayKey = localDateKey(new Date())
  const sessionsToday = useMemo(
    () => data.recentSessions.filter(session => localDateKey(session.date) === todayKey),
    [data.recentSessions, todayKey]
  )

  const suggestedWorkout = useMemo(() => {
    const completed = new Set(sessionsToday.map(session => session.workoutId))
    return [...data.workouts]
      .filter(workout => workout.exercises.length > 0 && !completed.has(workout.id))
      .sort((a, b) => {
        const aTime = a.sessions[0] ? new Date(a.sessions[0].date).getTime() : 0
        const bTime = b.sessions[0] ? new Date(b.sessions[0].date).getTime() : 0
        return aTime - bTime
      })[0] ?? null
  }, [data.workouts, sessionsToday])

  const heroWorkout = suggestedWorkout
    ?? data.workouts.find(workout => workout.id === sessionsToday[0]?.workoutId)
    ?? data.workouts[0]
    ?? null
  const heroSession = data.recentSessions.find(session => session.workoutId === heroWorkout?.id)
  const heroDoneToday = Boolean(heroWorkout && sessionsToday.some(session => session.workoutId === heroWorkout.id))

  const weekDays = useMemo(() => {
    const now = new Date()
    const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay()
    const monday = new Date(now)
    monday.setHours(12, 0, 0, 0)
    monday.setDate(now.getDate() + mondayOffset)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      const key = localDateKey(date)
      const session = data.recentSessions.find(item => localDateKey(item.date) === key)
      const workoutIndex = session ? data.workouts.findIndex(item => item.id === session.workoutId) : -1
      const isToday = key === todayKey
      const planned = isToday && suggestedWorkout
      return {
        date,
        isToday,
        isFuture: date.getTime() > now.getTime() && !isToday,
        letter: session ? workoutLetter(session.workoutName, workoutIndex) : planned ? workoutLetter(planned.name, data.workouts.indexOf(planned)) : '—',
        complete: Boolean(session),
        planned: Boolean(planned),
      }
    })
  }, [data.recentSessions, data.workouts, suggestedWorkout, todayKey])

  const weekSessions = useMemo(() => {
    const keys = new Set(weekDays.map(day => localDateKey(day.date)))
    return data.recentSessions.filter(session => keys.has(localDateKey(session.date)))
  }, [data.recentSessions, weekDays])
  const weekVolume = weekSessions.reduce((sum, session) => sum + sessionVolume(session), 0)
  const weekMinutes = weekSessions.reduce((sum, session) => sum + (session.duration ?? 0), 0)

  const lastSetsByExercise = useMemo(() => {
    const result = new Map<string, SessionSet>()
    for (const session of data.recentSessions) {
      for (const set of session.sets) {
        if (!result.has(set.exerciseId)) result.set(set.exerciseId, set)
      }
    }
    return result
  }, [data.recentSessions])

  const recentRecords = useMemo(() => data.recentSessions.flatMap(session =>
    session.sets.filter(set => set.isPersonalRecord).map(set => ({ ...set, date: session.date }))
  ).slice(0, 4), [data.recentSessions])

  const historyFilters = useMemo(() => [
    { id: 'all', label: 'Todos' },
    ...data.workouts.map((workout, index) => ({
      id: workout.id,
      label: `Treino ${workoutLetter(workout.name, index)}`,
    })),
  ], [data.workouts])
  const filteredSessions = useMemo(() => {
    if (historyFilter === 'all') return data.recentSessions
    return data.recentSessions.filter((session) => session.workoutId === historyFilter)
  }, [data.recentSessions, historyFilter])
  const visibleSessions = filteredSessions.slice(0, historyLimit)

  const heatmap = useMemo(() => {
    const active = new Set(data.recentSessions.map(session => localDateKey(session.date)))
    const end = new Date()
    end.setHours(12, 0, 0, 0)
    return Array.from({ length: 84 }, (_, index) => {
      const date = new Date(end)
      date.setDate(end.getDate() - (83 - index))
      return {
        active: active.has(localDateKey(date)),
        label: weekdayDate(date),
      }
    })
  }, [data.recentSessions])

  async function toggleArchived(workoutId: string, archived: boolean) {
    setPendingWorkout(workoutId)
    setError(null)
    const result = await setWorkoutArchived(workoutId, archived)
    setPendingWorkout(null)
    setOpenMenu(null)
    if (result.error) {
      setError(result.error)
      return
    }
    await loadData()
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-72 max-w-5xl items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const totalPrs = data.recentSessions.reduce((sum, session) => sum + session.sets.filter(set => set.isPersonalRecord).length, 0)
  const averageDuration = data.recentSessions.length
    ? Math.round(data.recentSessions.reduce((sum, session) => sum + (session.duration ?? 0), 0) / data.recentSessions.length)
    : 0

  return (
    <div className="mx-auto min-h-full max-w-5xl px-4 py-5 sm:px-6 sm:py-7">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Treino</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {tab === 'today' && (data.workouts.length ? `${data.workouts.length} treinos ativos · sua rotina da semana` : 'Sua rotina de exercícios')}
            {tab === 'history' && `${data.recentSessions.length} ${data.recentSessions.length === 1 ? 'sessão' : 'sessões'} no histórico completo`}
            {tab === 'saved' && `${data.workouts.length} ${data.workouts.length === 1 ? 'treino ativo' : 'treinos ativos'}`}
          </p>
        </div>
        <Link href="/app/treino/novo" aria-label="Criar treino" className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm transition-opacity hover:opacity-90" style={{ backgroundColor: 'var(--color-primary)' }}>
          <PlusIcon />
        </Link>
      </header>

      <div className="mb-5 grid grid-cols-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {([
          ['today', 'Hoje'], ['history', 'Histórico'], ['saved', 'Meus treinos'],
        ] as Array<[Tab, string]>).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className="border-b-2 px-1 py-3 text-sm transition-colors"
            style={{ borderColor: tab === value ? 'var(--color-primary)' : 'transparent', color: tab === value ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: tab === value ? 500 : 400 }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-alert)', color: 'var(--color-alert)' }}>{error}</div>}

      {tab === 'today' && (
        data.workouts.length === 0 ? <EmptyWorkouts /> : (
          <div className="lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,.75fr)] lg:gap-5">
            <div>
              <section className="mb-3 rounded-xl border p-3 sm:p-4" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
                <div className="mb-3 flex items-baseline justify-between px-1">
                  <span className="text-sm font-medium">Esta semana</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{weekSessions.length} de {Math.max(data.workouts.length, 1)} treinos</span>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {weekDays.map((day) => (
                    <div key={day.date.toISOString()} className="flex min-w-0 flex-col items-center gap-1.5">
                      <span className="text-[11px]" style={{ color: day.isToday ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: day.isToday ? 600 : 400 }}>{WEEKDAYS[day.date.getDay()]}</span>
                      <div
                        className="flex aspect-square w-full max-w-10 items-center justify-center rounded-[10px] text-xs font-medium"
                        style={{
                          backgroundColor: day.complete ? 'var(--color-primary)' : day.planned ? 'var(--color-primary-light)' : 'var(--color-surface)',
                          color: day.complete ? '#fff' : day.planned ? 'var(--color-primary)' : 'var(--color-border-strong)',
                          border: day.planned ? '2px solid var(--color-primary)' : day.isFuture ? '1px dashed var(--color-border-strong)' : '1px solid transparent',
                        }}
                      >{day.letter}</div>
                      <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{day.date.getDate()}</span>
                    </div>
                  ))}
                </div>
              </section>

              {heroWorkout && (
                <section className="overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
                  <div className="border-b p-4" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="mb-2 inline-block rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: heroDoneToday ? 'var(--color-primary)' : 'var(--color-primary-light)', color: heroDoneToday ? '#fff' : 'var(--color-primary)' }}>
                      {heroDoneToday ? `Concluído hoje${heroSession?.duration ? ` · ${heroSession.duration} min` : ''}` : 'Treino sugerido para hoje'}
                    </span>
                    <h2 className="text-base font-medium sm:text-lg">{heroWorkout.name}</h2>
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {heroWorkout.exercises.length} exercícios · {heroWorkout.exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0)} séries
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {heroWorkout.muscleGroups.slice(0, 4).map(group => <span key={group} className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>{group}</span>)}
                    </div>
                  </div>
                  {heroWorkout.exercises.map((exercise, index) => {
                    const lastSet = lastSetsByExercise.get(exercise.id)
                    return (
                      <div key={exercise.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium" style={{ borderColor: heroDoneToday ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: heroDoneToday ? 'var(--color-primary)' : 'transparent', color: heroDoneToday ? '#fff' : 'var(--color-text-muted)' }}>
                          {heroDoneToday ? '✓' : index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{exercise.name}</p>
                          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {targetLabel(exercise)}{lastSet ? <><span> · </span><span style={{ color: 'var(--color-primary)' }}>última carga</span></> : ' · primeiro registro'}
                          </p>
                        </div>
                        <span className="shrink-0 text-right text-xs font-medium tabular-nums">
                          {lastSet ? `${lastSet.weightKg ?? '—'} kg × ${lastSet.reps ?? '—'}` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </section>
              )}
            </div>

            <aside className="mt-3 space-y-3 lg:mt-0">
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
                {[
                  ['Treinos', `${weekSessions.length}/${Math.max(data.workouts.length, 1)}`],
                  ['Volume', formatVolume(weekVolume)],
                  ['Tempo', weekMinutes >= 60 ? `${Math.floor(weekMinutes / 60)}h${String(weekMinutes % 60).padStart(2, '0')}` : `${weekMinutes} min`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border p-3 lg:flex lg:items-center lg:justify-between" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
                    <p className="text-[11px] lg:text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                    <p className="mt-1 text-base font-medium lg:mt-0">{value}</p>
                  </div>
                ))}
              </div>

              <section className="rounded-xl border p-4" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
                <h3 className="mb-3 text-sm font-medium">Recordes recentes</h3>
                {recentRecords.length ? <div className="space-y-3">{recentRecords.map((record, index) => (
                  <div key={`${record.exerciseId}-${record.date}-${index}`} className="flex items-center gap-2.5">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: '#fff8e1', color: 'var(--color-fat)' }}>PR</span>
                    <div className="min-w-0 flex-1"><p className="truncate text-xs">{record.exerciseName}</p><p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{shortDate(record.date)}</p></div>
                    <span className="text-xs font-medium tabular-nums">{record.weightKg ?? '—'} kg × {record.reps ?? '—'}</span>
                  </div>
                ))}</div> : <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Seus próximos recordes aparecerão aqui.</p>}
              </section>
            </aside>

            {heroWorkout && (
              <div className="sticky bottom-0 z-10 -mx-4 mt-3 bg-gradient-to-t from-[var(--color-surface)] via-[var(--color-surface)] to-transparent px-4 pb-2 pt-5 sm:-mx-6 sm:px-6 lg:static lg:col-span-2 lg:mx-0 lg:bg-none lg:px-0 lg:pt-0">
                {heroDoneToday ? (
                  <button onClick={() => setTab('history')} className="block w-full rounded-[10px] border px-4 py-3.5 text-center text-sm font-medium" style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-background)', color: 'var(--color-primary)' }}>Ver no histórico</button>
                ) : (
                  <Link href={`/app/treino/${heroWorkout.id}`} className="block w-full rounded-[10px] px-4 py-3.5 text-center text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>Iniciar treino</Link>
                )}
              </div>
            )}
          </div>
        )
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          <section className="rounded-xl border p-4" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
            <div className="mb-3 flex items-baseline justify-between"><h2 className="text-sm font-medium">Frequência</h2><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>12 semanas</span></div>
            <div className="overflow-x-auto pb-1">
              <div className="grid w-max grid-flow-col grid-rows-7 gap-1" aria-label="Dias com treino nas últimas 12 semanas">
                {heatmap.map((day, index) => (
                  <span
                    key={`${day.label}-${index}`}
                    title={`${day.label}: ${day.active ? 'treino realizado' : 'sem treino'}`}
                    className="h-3 w-3 rounded-[3px]"
                    style={{ backgroundColor: day.active ? 'var(--color-primary)' : 'var(--color-surface)' }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ['Total', data.recentSessions.length], ['Média', `${averageDuration} min`], ['Recordes', totalPrs],
              ].map(([label, value], index) => <div key={String(label)} className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--color-surface)' }}><p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{label}</p><p className="mt-0.5 text-base font-medium" style={{ color: index === 2 ? 'var(--color-fat)' : undefined }}>{value}</p></div>)}
            </div>
          </section>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {historyFilters.map(filter => {
              const active = historyFilter === filter.id
              return <button key={filter.id} onClick={() => { setHistoryFilter(filter.id); setHistoryLimit(20) }} className="shrink-0 rounded-full border px-3.5 py-2 text-xs" style={{ borderColor: active ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: active ? 'var(--color-primary-light)' : 'var(--color-background)', color: active ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>{filter.label}</button>
            })}
          </div>

          {filteredSessions.length === 0 ? (
            <div className="rounded-xl border p-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>Nenhuma sessão encontrada neste período.</div>
          ) : (
            <section className="overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
              {visibleSessions.map((session, index) => {
                const open = openSession === session.id
                const volume = sessionVolume(session)
                const prs = session.sets.filter(set => set.isPersonalRecord).length
                const exercises = [...new Set(session.sets.map(set => set.exerciseId))]
                return (
                  <div key={session.id} className="border-t first:border-t-0" style={{ borderColor: 'var(--color-border)' }}>
                    <button onClick={() => setOpenSession(open ? null : session.id)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>{workoutLetter(session.workoutName, index)}</div>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{session.workoutName.replace(/^Treino\s+[A-Z]\s*[—-]\s*/i, '')}</p><p className="mt-0.5 truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>{weekdayDate(session.date)} · {session.duration ?? '—'} min · {formatVolume(volume)}</p></div>
                      {prs > 0 && <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: '#fff8e1', color: 'var(--color-fat)' }}>{prs} PR{prs > 1 ? 's' : ''}</span>}
                      <span style={{ color: 'var(--color-text-muted)' }}><Chevron open={open} /></span>
                    </button>
                    {open && (
                      <div className="space-y-3 px-4 pb-4">
                        {exercises.map(exerciseId => {
                          const sets = session.sets.filter(set => set.exerciseId === exerciseId)
                          return <div key={exerciseId}><p className="mb-1.5 text-xs font-medium">{sets[0]?.exerciseName}</p><div className="flex flex-wrap gap-1">{sets.map(set => <span key={set.id} className="rounded-md px-2 py-1 text-xs tabular-nums" style={{ backgroundColor: set.isPersonalRecord ? '#fff8e1' : 'var(--color-surface)', color: set.isPersonalRecord ? 'var(--color-warning)' : 'var(--color-text)' }}>{set.weightKg ?? '—'}×{set.reps ?? '—'}{set.isPersonalRecord ? ' PR' : ''}</span>)}</div></div>
                        })}
                        {session.notes && <p className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>“{session.notes}”</p>}
                        {!session.workoutArchived && <Link href={`/app/treino/${session.workoutId}`} className="block rounded-lg py-2.5 text-center text-xs font-medium" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>Repetir treino</Link>}
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          )}
          {visibleSessions.length < filteredSessions.length && <button onClick={() => setHistoryLimit(limit => limit + 20)} className="w-full rounded-xl border py-3 text-sm font-medium" style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-background)', color: 'var(--color-primary)' }}>Mostrar mais {Math.min(20, filteredSessions.length - visibleSessions.length)} sessões</button>}
        </div>
      )}

      {tab === 'saved' && (
        <div className="space-y-5">
          {data.workouts.length === 0 ? <EmptyWorkouts /> : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.workouts.map(workout => (
                <section key={workout.id} className="relative flex min-h-44 flex-col overflow-visible rounded-xl border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
              <div className="p-4">
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}><WorkoutIcon /></div>
                  <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-medium">{workout.name}</h2><p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{workout.exercises.length} exercícios{workout.scheduledWeekdays.length ? ` · ${workout.scheduledWeekdays.map(day => WEEKDAYS[day]).join(' · ')}` : ''}</p></div>
                  <button onClick={() => setOpenMenu(openMenu === workout.id ? null : workout.id)} aria-label="Opções do treino" aria-expanded={openMenu === workout.id} className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: 'var(--color-text-muted)' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                  </button>
                  {openMenu === workout.id && <div className="absolute right-3 top-12 z-20 w-40 overflow-hidden rounded-xl border shadow-lg" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}><Link href={`/app/treino/${workout.id}/editar`} className="block px-4 py-2.5 text-sm hover:bg-black/5">Editar</Link><button disabled={pendingWorkout === workout.id} onClick={() => toggleArchived(workout.id, true)} className="w-full px-4 py-2.5 text-left text-sm hover:bg-black/5" style={{ color: 'var(--color-text-muted)' }}>{pendingWorkout === workout.id ? 'Arquivando…' : 'Arquivar'}</button></div>}
                </div>
                <div className="mb-3 flex flex-wrap gap-1">{workout.muscleGroups.slice(0, 3).map(group => <span key={group} className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>{group}</span>)}{workout.muscleGroups.length > 3 && <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>+{workout.muscleGroups.length - 3}</span>}</div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{workout.sessionCount} {workout.sessionCount === 1 ? 'sessão' : 'sessões'}{workout.sessions[0] ? ` · Último: ${shortDate(workout.sessions[0].date)}` : ' · Ainda não realizado'}</p>
              </div>
                  <div className="mt-auto flex border-t" style={{ borderColor: 'var(--color-border)' }}><Link href={`/app/treino/${workout.id}/editar`} className="flex-1 border-r py-3 text-center text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>Ver detalhes</Link><Link href={`/app/treino/${workout.id}`} className="flex-1 py-3 text-center text-xs font-medium" style={{ color: 'var(--color-primary)' }}>Iniciar</Link></div>
                </section>
              ))}

              <Link href="/app/treino/novo" className="flex min-h-44 items-center justify-center gap-3 rounded-xl border-2 border-dashed p-4" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}><span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}><PlusIcon /></span><span><span className="block text-sm font-medium" style={{ color: 'var(--color-text)' }}>Novo treino</span><span className="mt-0.5 block text-xs">Monte do zero ou gere com a IA</span></span></Link>
            </div>
          )}

          {data.archivedWorkouts.length > 0 && <section className="pt-2"><h2 className="mb-2 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Arquivados</h2><div className="overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>{data.archivedWorkouts.map(workout => <div key={workout.id} className="flex items-center gap-3 border-t px-4 py-3 first:border-t-0" style={{ borderColor: 'var(--color-border)' }}><div className="min-w-0 flex-1"><p className="truncate text-sm" style={{ color: 'var(--color-text-muted)' }}>{workout.name}</p><p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{workout.exercises.length} exercícios · {workout.sessionCount} sessões</p></div><button disabled={pendingWorkout === workout.id} onClick={() => toggleArchived(workout.id, false)} className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>{pendingWorkout === workout.id ? 'Restaurando…' : 'Restaurar'}</button></div>)}</div></section>}
        </div>
      )}
    </div>
  )
}
