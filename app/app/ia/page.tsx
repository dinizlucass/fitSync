'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { WORKOUT_METHODS } from '@/lib/workout-methods'
import {
  generateAndSaveWorkoutPlan,
  generateAutoWorkoutPlan,
  generateDietPlanAction,
  sendChatMessage,
  refineMealVariantAction,
  refineExerciseAction,
} from '@/app/actions/ai'
import { saveDietTemplateAction, applyTemplateToTodayAction } from '@/app/actions/diet'
import { saveGeneratedWorkout } from '@/app/actions/workout'
import type { ChatMessage } from '@/lib/openai'
import type { SmartDietPlan } from '@/lib/diet-types'
import type { SmartWorkoutPlan } from '@/lib/workout-types'
import { Suspense } from 'react'

type Tab = 'treino' | 'dieta' | 'chat'

// ─── Helpers ────────────────────────────────────────────────────────────────

const GOALS = [
  { id: 'Ganho de massa muscular', label: 'Ganhar massa', icon: '💪' },
  { id: 'Perda de gordura', label: 'Perder gordura', icon: '🔥' },
  { id: 'Recomposição corporal', label: 'Recomposição', icon: '⚖️' },
  { id: 'Manutenção', label: 'Manter', icon: '🎯' },
]

const LEVELS = [
  { id: 'Iniciante', label: 'Iniciante', desc: 'Menos de 1 ano' },
  { id: 'Intermediário', label: 'Intermediário', desc: '1 a 3 anos' },
  { id: 'Avançado', label: 'Avançado', desc: 'Mais de 3 anos' },
]

const PREFERENCES = [
  'Vegetariano', 'Vegano', 'Sem glúten', 'Sem lactose',
  'Low carb', 'Sem frutos do mar', 'Sem ovos',
]

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
    </svg>
  )
}

// ─── Workout Tab ─────────────────────────────────────────────────────────────

function WorkoutTab() {
  const [step, setStep] = useState<'method' | 'config' | 'generating' | 'result'>('method')
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null)
  const [goal, setGoal] = useState('Ganho de massa muscular')
  const [level, setLevel] = useState('Intermediário')
  const [sessionDuration, setSessionDuration] = useState(45)
  const [volumePreference, setVolumePreference] = useState<'low' | 'moderate' | 'high'>('moderate')
  const [volumeAutoSetDuration, setVolumeAutoSetDuration] = useState(true)
  const [includeCardio, setIncludeCardio] = useState(false)
  const [autoMode, setAutoMode] = useState(false)
  const [plan, setPlan] = useState<SmartWorkoutPlan | null>(null)
  const [selectedExercises, setSelectedExercises] = useState<Record<number, number | null>>({})
  const [refineExTarget, setRefineExTarget] = useState<number | null>(null)
  const [refineExInput, setRefineExInput] = useState('')
  const [refineExLoading, setRefineExLoading] = useState<number | null>(null)
  const [refineExFeedback, setRefineExFeedback] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const method = WORKOUT_METHODS.find(m => m.id === selectedMethod)
  const availableDays = method?.days ?? []

  function handleSelectMethod(id: string) {
    setSelectedMethod(id)
    setDaysPerWeek(null)
    setStep('config')
  }

  function handleGenerate() {
    if (!selectedMethod || !daysPerWeek) return
    setError(null)
    setAutoMode(false)
    setStep('generating')
    startTransition(async () => {
      const res = await generateAndSaveWorkoutPlan({
        methodId: selectedMethod,
        daysPerWeek,
        goal,
        level,
        sessionDuration,
        includeCardio,
        volumePreference,
      })
      if (res.error) {
        setError(res.error)
        setStep('config')
      } else if (res.plan) {
        setPlan(res.plan)
        setSelectedExercises({})
        setStep('result')
      }
    })
  }

  function handleAutoGenerate() {
    setError(null)
    setAutoMode(true)
    setStep('generating')
    startTransition(async () => {
      const res = await generateAutoWorkoutPlan()
      if (res.error) {
        setError(res.error)
        setAutoMode(false)
        setStep('method')
      } else if (res.plan) {
        setPlan(res.plan)
        setSelectedExercises({})
        setStep('result')
      }
    })
  }

  async function handleRefineExercise(idx: number) {
    if (!plan || !refineExInput.trim()) return
    const slot = plan.exercises[idx]
    const currentEx = selectedExercises[idx] !== null && selectedExercises[idx] !== undefined
      ? slot.alternatives[selectedExercises[idx] as number]
      : slot.primary
    if (!currentEx) return

    setRefineExLoading(idx)
    setRefineExTarget(null)
    const res = await refineExerciseAction({
      exerciseName: currentEx.name,
      sets: currentEx.sets,
      reps: currentEx.reps,
      muscleGroup: slot.muscleGroup,
      userMessage: refineExInput,
    })
    setRefineExLoading(null)
    setRefineExInput('')

    if (res.newExercise && plan) {
      const newPlan = structuredClone(plan)
      newPlan.exercises[idx].primary = res.newExercise
      setPlan(newPlan)
      setSelectedExercises(prev => ({ ...prev, [idx]: null }))
      setRefineExFeedback(prev => ({ ...prev, [idx]: res.newExercise!.explanation }))
      setTimeout(() => setRefineExFeedback(prev => { const n = { ...prev }; delete n[idx]; return n }), 4000)
    }
  }

  async function handleSaveWorkout() {
    if (!plan || saving) return
    setSaving(true)
    const exercisesToSave = plan.exercises.map((slot, i) => {
      const selectedAltIdx = selectedExercises[i]
      const ex = selectedAltIdx !== null && selectedAltIdx !== undefined
        ? slot.alternatives[selectedAltIdx]
        : slot.primary
      return {
        name: ex.name,
        muscleGroup: slot.muscleGroup,
        sets: ex.sets,
        reps: ex.reps,
      }
    })
    const res = await saveGeneratedWorkout({
      name: plan.name,
      muscleGroups: [...new Set(plan.exercises.map(e => e.muscleGroup))],
      exercises: exercisesToSave,
    })
    setSaving(false)
    if (res.success) router.push('/app/treino')
    else setError(res.error ?? 'Erro ao salvar treino')
  }

  if (step === 'method') {
    return (
      <div>
        {error && (
          <p className="text-sm p-3 rounded-xl mb-4" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>{error}</p>
        )}

        {/* Auto-generate card */}
        <div
          className="flex items-center gap-3 p-4 mb-4 border"
          style={{
            borderColor: 'var(--color-primary)',
            backgroundColor: 'var(--color-primary-light, #E1F5EE)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <span className="text-xl flex-shrink-0">⚡</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>Gerar automaticamente</p>
            <p className="text-xs mt-0.5" style={{ color: '#0F6E56' }}>
              A IA escolhe método, volume e cardio com base no seu perfil
            </p>
          </div>
          <button
            onClick={handleAutoGenerate}
            disabled={isPending}
            className="text-xs px-3 py-2 rounded-lg font-medium text-white flex-shrink-0 disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Gerar agora
          </button>
        </div>

        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Ou escolha o método de divisão dos seus treinos:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {WORKOUT_METHODS.map(m => (
            <button
              key={m.id}
              onClick={() => handleSelectMethod(m.id)}
              className="text-left p-4 rounded-xl border transition-all hover:border-green-500"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            >
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xl">{m.icon}</span>
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {m.days.join(' ou ')} dias/semana
                  </p>
                </div>
              </div>
              <p className="text-xs ml-8" style={{ color: 'var(--color-text-muted)' }}>{m.description}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (step === 'config') {
    return (
      <div className="space-y-6 max-w-lg">
        <button
          onClick={() => setStep('method')}
          className="flex items-center gap-2 text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← Voltar
        </button>

        <div>
          <p className="text-sm font-medium mb-1">Método escolhido</p>
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: 'var(--color-surface)' }}>
            <span className="text-lg">{method?.icon}</span>
            <div>
              <p className="text-sm font-medium">{method?.name}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{method?.description}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Dias de treino por semana</p>
          <div className="flex gap-2 flex-wrap">
            {availableDays.map(d => (
              <button
                key={d}
                onClick={() => setDaysPerWeek(d)}
                className="w-12 h-12 rounded-xl text-sm font-medium border transition-all"
                style={{
                  borderColor: daysPerWeek === d ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor: daysPerWeek === d ? '#E1F5EE' : 'var(--color-surface)',
                  color: daysPerWeek === d ? 'var(--color-primary)' : 'inherit',
                }}
              >
                {d}x
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Objetivo</p>
          <div className="grid grid-cols-2 gap-2">
            {GOALS.map(g => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className="flex items-center gap-2 p-3 rounded-xl border text-sm transition-all"
                style={{
                  borderColor: goal === g.id ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor: goal === g.id ? '#E1F5EE' : 'var(--color-surface)',
                  color: goal === g.id ? 'var(--color-primary)' : 'inherit',
                }}
              >
                <span>{g.icon}</span>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Duração da sessão</p>
          <div className="flex gap-2 flex-wrap">
            {[30, 45, 60, 90].map(d => (
              <button
                key={d}
                onClick={() => { setSessionDuration(d); setVolumeAutoSetDuration(false) }}
                className="px-4 py-3 rounded-xl text-sm font-medium border transition-all"
                style={{
                  borderColor: sessionDuration === d ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor: sessionDuration === d ? '#E1F5EE' : 'var(--color-surface)',
                  color: sessionDuration === d ? 'var(--color-primary)' : 'inherit',
                }}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Volume de treino</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'low', icon: '🎯', label: 'Baixo', sets: '2-3 séries', desc: 'Intensidade máx', dur: 45 },
              { id: 'moderate', icon: '⚖️', label: 'Moderado', sets: '3-4 séries', desc: 'Equilíbrio', dur: 60 },
              { id: 'high', icon: '💪', label: 'Alto', sets: '4-5 séries', desc: 'Volume máximo', dur: 90 },
            ] as const).map(v => (
              <button
                key={v.id}
                onClick={() => {
                  setVolumePreference(v.id)
                  if (volumeAutoSetDuration) setSessionDuration(v.dur)
                }}
                className="p-3 rounded-xl border text-center transition-all"
                style={{
                  borderColor: volumePreference === v.id ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor: volumePreference === v.id ? '#E1F5EE' : 'var(--color-surface)',
                  color: volumePreference === v.id ? 'var(--color-primary)' : 'inherit',
                }}
              >
                <div className="text-base">{v.icon}</div>
                <div className="text-sm font-medium mt-1">{v.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{v.sets}</div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{v.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Cardio</p>
          <div className="flex gap-2">
            {[
              { value: false, label: 'Não incluir' },
              { value: true, label: 'Incluir cardio' },
            ].map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => setIncludeCardio(opt.value)}
                className="flex-1 py-3 rounded-xl text-sm font-medium border transition-all"
                style={{
                  borderColor: includeCardio === opt.value ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor: includeCardio === opt.value ? 'var(--color-primary-light)' : 'var(--color-surface)',
                  color: includeCardio === opt.value ? 'var(--color-primary)' : 'var(--color-text-muted)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {includeCardio && (
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              A IA vai recomendar tipo, frequência e estimativa de calorias gastas com base no seu objetivo.
            </p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Nível de experiência</p>
          <div className="flex gap-2 flex-wrap">
            {LEVELS.map(l => (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                className="flex-1 p-3 rounded-xl border text-sm transition-all"
                style={{
                  borderColor: level === l.id ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor: level === l.id ? '#E1F5EE' : 'var(--color-surface)',
                  color: level === l.id ? 'var(--color-primary)' : 'inherit',
                  minWidth: '100px',
                }}
              >
                <p className="font-medium">{l.label}</p>
                <p className="text-xs opacity-70">{l.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm p-3 rounded-xl" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>{error}</p>
        )}

        <button
          onClick={handleGenerate}
          disabled={!daysPerWeek || isPending}
          className="w-full py-3 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          Gerar plano de treino com IA
        </button>
      </div>
    )
  }

  if (step === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E1F5EE' }}>
          <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#1D9E75" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm font-medium">Gerando seu plano de treino...</p>
        <p className="text-xs text-center max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
          A IA está montando um treino personalizado para você. Isso pode levar alguns segundos.
        </p>
      </div>
    )
  }

  if (step === 'result' && plan) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{plan.name}</p>
              {autoMode && (
                <span
                  className="text-xs font-medium px-2 py-0.5"
                  style={{
                    backgroundColor: 'var(--color-primary-light, #E1F5EE)',
                    color: 'var(--color-primary)',
                    borderRadius: '999px',
                    fontSize: '11px',
                  }}
                >
                  ⚡ Automático
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {plan.duration} · {plan.exercises.length} exercícios
            </p>
          </div>
          <button
            onClick={() => { setStep('method'); setPlan(null); setSelectedMethod(null); setAutoMode(false) }}
            className="text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Gerar novo
          </button>
        </div>

        <div className="space-y-3">
          {plan.exercises.map((slot, idx) => {
            const selectedAltIdx = selectedExercises[idx]
            const displayEx = selectedAltIdx !== null && selectedAltIdx !== undefined
              ? slot.alternatives[selectedAltIdx]
              : slot.primary

            return (
              <div key={idx} className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                {/* Muscle group badge */}
                <span className="text-xs px-2 py-0.5 rounded-full mb-2 inline-block" style={{ backgroundColor: '#E1F5EE', color: '#085041' }}>
                  {slot.muscleGroup}
                </span>

                {/* Current exercise */}
                <div className="mt-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{displayEx.name}</p>
                      {displayEx.notes && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{displayEx.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#E1F5EE', color: '#085041' }}>
                        {displayEx.sets}×{displayEx.reps}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{displayEx.rest}</span>
                    </div>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{displayEx.equipment}</p>
                </div>

                {/* Exercise option selector (primary + alternatives) */}
                {slot.alternatives.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {[slot.primary, ...slot.alternatives].map((opt, optIdx) => {
                      const currentIdx = selectedExercises[idx]
                      const isSelected = optIdx === 0
                        ? (currentIdx === null || currentIdx === undefined)
                        : currentIdx === optIdx - 1
                      return (
                        <button
                          key={optIdx}
                          onClick={() => setSelectedExercises(prev => ({
                            ...prev,
                            [idx]: optIdx === 0 ? null : optIdx - 1,
                          }))}
                          className="text-xs px-3 py-1.5 rounded-full border transition-all"
                          style={{
                            borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                            backgroundColor: isSelected ? '#E1F5EE' : 'transparent',
                            color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            fontWeight: isSelected ? 500 : 400,
                          }}
                        >
                          {optIdx === 0 ? `✓ ${opt.name}` : opt.name}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Refine feedback */}
                {refineExFeedback[idx] && (
                  <p className="text-xs mt-2 p-2 rounded-lg" style={{ backgroundColor: '#E1F5EE', color: '#085041' }}>
                    {refineExFeedback[idx]}
                  </p>
                )}

                {/* Refine loading */}
                {refineExLoading === idx && (
                  <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <Spinner /> Ajustando exercício...
                  </div>
                )}

                {/* Refine button */}
                <div className="mt-3">
                  <button
                    onClick={() => setRefineExTarget(refineExTarget === idx ? null : idx)}
                    className="text-xs"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    ↺ Ajustar
                  </button>
                  {refineExTarget === idx && (
                    <div className="flex gap-2 mt-2">
                      <input
                        value={refineExInput}
                        onChange={e => setRefineExInput(e.target.value)}
                        placeholder="Ex: sem equipamento, mais fácil..."
                        className="flex-1 px-3 py-1.5 rounded-lg border text-xs outline-none"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
                        onKeyDown={e => e.key === 'Enter' && handleRefineExercise(idx)}
                      />
                      <button
                        onClick={() => handleRefineExercise(idx)}
                        disabled={!refineExInput.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        Enviar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Methodology — how to execute */}
        {(plan.methodology ?? []).length > 0 && (
          <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: '12px' }}>
            <p className="text-sm font-semibold mb-2">📋 Como executar</p>
            {(plan.methodology ?? []).map((tip, i) => (
              <p key={i} className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
                • {tip}
              </p>
            ))}
          </div>
        )}

        {/* Cardio recommendations */}
        {(plan.cardio ?? []).length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">🏃 Cardio recomendado</p>
            <div className="space-y-3">
              {(plan.cardio ?? []).map((c, i) => (
                <div
                  key={i}
                  className="border"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    borderRadius: 'var(--radius-card)',
                    padding: '12px 16px',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm">
                      <span className="font-medium">{c.type}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}> · {c.durationMin} min</span>
                    </p>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text-muted)' }}
                    >
                      {c.frequency}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{c.description}</p>
                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="text-xs">🔥 ~{c.caloriesBurn} kcal/sessão</span>
                    <span className="text-xs italic text-right" style={{ color: 'var(--color-text-muted)' }}>{c.bestFor}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {plan.tips.length > 0 && (
          <div className="rounded-xl p-4" style={{ backgroundColor: '#E1F5EE' }}>
            <p className="text-sm font-medium mb-2" style={{ color: '#085041' }}>Dicas do coach</p>
            <ul className="space-y-1">
              {plan.tips.map((tip, i) => (
                <li key={i} className="text-xs flex gap-2" style={{ color: '#085041' }}>
                  <span>•</span>{tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p className="text-sm p-3 rounded-xl" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>{error}</p>
        )}

        <button
          onClick={handleSaveWorkout}
          disabled={saving}
          className="w-full py-3 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {saving ? <><Spinner /> Salvando...</> : 'Salvar treino'}
        </button>
      </div>
    )
  }

  return null
}

// ─── Diet Tab ─────────────────────────────────────────────────────────────────

function DietTab() {
  const [step, setStep] = useState<'config' | 'generating' | 'result'>('config')
  const [preferences, setPreferences] = useState<string[]>([])
  const [mealsPerDay, setMealsPerDay] = useState(5)
  const [plan, setPlan] = useState<SmartDietPlan | null>(null)
  const [selected, setSelected] = useState<Record<number, number>>({})
  const [refineTarget, setRefineTarget] = useState<number | null>(null)
  const [refineInput, setRefineInput] = useState('')
  const [refineLoading, setRefineLoading] = useState<number | null>(null)
  const [refineFeedback, setRefineFeedback] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedModal, setSavedModal] = useState(false)
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function togglePref(p: string) {
    setPreferences(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function handleGenerate() {
    setError(null)
    setStep('generating')
    startTransition(async () => {
      const res = await generateDietPlanAction({ preferences, mealsPerDay })
      if (res.error) {
        setError(res.error)
        setStep('config')
      } else if (res.plan) {
        setPlan(res.plan)
        setSelected({})
        setStep('result')
      }
    })
  }

  async function handleRefine(mealIndex: number) {
    if (!plan || !refineInput.trim()) return
    const meal = plan.meals[mealIndex]
    const currentVariant = meal.variants[selected[mealIndex] ?? 0]
    if (!currentVariant) return

    setRefineLoading(mealIndex)
    setRefineTarget(null)
    const res = await refineMealVariantAction({
      mealName: meal.name,
      currentVariant,
      userMessage: refineInput,
    })
    setRefineLoading(null)
    setRefineInput('')

    if (res.newVariant && plan) {
      const newPlan = structuredClone(plan)
      newPlan.meals[mealIndex].variants[selected[mealIndex] ?? 0] = res.newVariant
      setPlan(newPlan)
      setRefineFeedback(prev => ({ ...prev, [mealIndex]: res.newVariant!.explanation }))
      setTimeout(() => setRefineFeedback(prev => { const n = { ...prev }; delete n[mealIndex]; return n }), 4000)
    }
  }

  async function handleSavePlan() {
    if (!plan || saving) return
    setSaving(true)
    const mealsToSave = plan.meals.map((meal, i) => {
      const variant = meal.variants[selected[i] ?? 0]
      return { name: meal.name, time: meal.time, items: variant.items }
    })
    const res = await saveDietTemplateAction(mealsToSave)
    setSaving(false)
    if (res.success) {
      setSavedModal(true)
    } else {
      setError(res.error ?? 'Erro ao salvar')
    }
  }

  async function handleApplyToToday() {
    setApplyingTemplate(true)
    const res = await applyTemplateToTodayAction()
    setApplyingTemplate(false)
    if (res.success) {
      sessionStorage.setItem('fitsync_last_diet_plan_date', new Date().toISOString().split('T')[0])
      router.push('/app/dieta')
    } else {
      setError(res.error ?? 'Erro ao aplicar')
      setSavedModal(false)
    }
  }

  if (step === 'config') {
    return (
      <div className="space-y-6 max-w-lg">
        <div>
          <p className="text-sm font-medium mb-2">Refeições por dia</p>
          <div className="flex gap-2">
            {[3, 4, 5, 6].map(n => (
              <button
                key={n}
                onClick={() => setMealsPerDay(n)}
                className="w-12 h-12 rounded-xl text-sm font-medium border transition-all"
                style={{
                  borderColor: mealsPerDay === n ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor: mealsPerDay === n ? '#E1F5EE' : 'var(--color-surface)',
                  color: mealsPerDay === n ? 'var(--color-primary)' : 'inherit',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Restrições alimentares</p>
          <div className="flex flex-wrap gap-2">
            {PREFERENCES.map(p => (
              <button
                key={p}
                onClick={() => togglePref(p)}
                className="px-3 py-1.5 rounded-full text-xs border transition-all"
                style={{
                  borderColor: preferences.includes(p) ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor: preferences.includes(p) ? '#E1F5EE' : 'transparent',
                  color: preferences.includes(p) ? 'var(--color-primary)' : 'inherit',
                }}
              >
                {p}
              </button>
            ))}
          </div>
          {preferences.length === 0 && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Nenhuma restrição selecionada</p>
          )}
        </div>

        <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Gere seu cardápio padrão uma vez e aplique a qualquer dia. Ele é montado com base nas suas metas de calorias e macros configuradas em <strong>Configurações → Metas</strong>.
          </p>
        </div>

        {error && (
          <p className="text-sm p-3 rounded-xl" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>{error}</p>
        )}

        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="w-full py-3 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          Gerar cardápio padrão com IA
        </button>
      </div>
    )
  }

  if (step === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E1F5EE' }}>
          <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#1D9E75" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm font-medium">Montando seu cardápio padrão...</p>
        <p className="text-xs text-center max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
          A IA está criando refeições com variantes personalizadas. Aguarde alguns segundos.
        </p>
      </div>
    )
  }

  if (step === 'result' && plan) {
    const totals = plan.meals.reduce<{ calories: number; protein: number; carbs: number; fat: number }>(
      (acc, meal, i) => {
        const v = meal.variants[selected[i] ?? 0]
        if (!v) return acc
        return {
          calories: acc.calories + v.totalCalories,
          protein: acc.protein + v.totalProteinG,
          carbs: acc.carbs + v.totalCarbsG,
          fat: acc.fat + v.totalFatG,
        }
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )

    return (
      <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-medium">Cardápio padrão</p>
          <button
            onClick={() => { setStep('config'); setPlan(null) }}
            className="text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Gerar novo
          </button>
        </div>

        {/* Day totals */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Kcal', value: Math.round(totals.calories), color: '#1D9E75' },
            { label: 'Prot', value: `${Math.round(totals.protein)}g`, color: '#1D9E75' },
            { label: 'Carb', value: `${Math.round(totals.carbs)}g`, color: '#378ADD' },
            { label: 'Gord', value: `${Math.round(totals.fat)}g`, color: '#EF9F27' },
          ].map(m => (
            <div key={m.label} className="text-center p-2 rounded-xl" style={{ backgroundColor: 'var(--color-surface)' }}>
              <p className="text-sm font-medium" style={{ color: m.color }}>{m.value}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{m.label}</p>
            </div>
          ))}
        </div>

        {/* Meals */}
        <div className="space-y-3">
          {plan.meals.map((meal, mealIndex) => {
            const activeVariant = meal.variants[selected[mealIndex] ?? 0]
            return (
              <div key={mealIndex} className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">{meal.name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{meal.time}</p>
                  </div>
                </div>

                {/* Variant tab pills */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  {meal.variants.map((v, vi) => (
                    <button
                      key={vi}
                      onClick={() => setSelected(prev => ({ ...prev, [mealIndex]: vi }))}
                      className="text-left px-3 py-1.5 rounded-lg border text-xs transition-all"
                      style={{
                        borderColor: (selected[mealIndex] ?? 0) === vi ? 'var(--color-primary)' : 'var(--color-border)',
                        backgroundColor: (selected[mealIndex] ?? 0) === vi ? '#E1F5EE' : 'transparent',
                        color: (selected[mealIndex] ?? 0) === vi ? 'var(--color-primary)' : 'inherit',
                      }}
                    >
                      <span className="font-medium">{v.label}</span>
                      <span className="block opacity-70">{v.tagline}</span>
                    </button>
                  ))}
                </div>

                {/* Selected variant items */}
                {activeVariant && (
                  <div className="space-y-1.5">
                    {activeVariant.items.map((item, ii) => (
                      <div key={ii} className="flex items-center justify-between text-xs">
                        <div>
                          <span>{item.food}</span>
                          <span className="ml-1" style={{ color: 'var(--color-text-muted)' }}>({item.quantity})</span>
                        </div>
                        <span style={{ color: 'var(--color-text-muted)' }}>{item.calories} kcal</span>
                      </div>
                    ))}
                    {/* Totals row */}
                    <div className="mt-2 pt-2 border-t flex gap-3 text-xs" style={{ borderColor: 'var(--color-border)' }}>
                      <span style={{ color: '#1D9E75' }}>P: {Math.round(activeVariant.totalProteinG)}g</span>
                      <span style={{ color: '#378ADD' }}>C: {Math.round(activeVariant.totalCarbsG)}g</span>
                      <span style={{ color: '#EF9F27' }}>G: {Math.round(activeVariant.totalFatG)}g</span>
                      <span className="ml-auto font-medium">{Math.round(activeVariant.totalCalories)} kcal</span>
                    </div>
                  </div>
                )}

                {/* Refine loading */}
                {refineLoading === mealIndex && (
                  <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <Spinner /> Ajustando refeição...
                  </div>
                )}

                {/* Refine feedback */}
                {refineFeedback[mealIndex] && (
                  <p className="text-xs mt-2 p-2 rounded-lg" style={{ backgroundColor: '#E1F5EE', color: '#085041' }}>
                    {refineFeedback[mealIndex]}
                  </p>
                )}

                {/* Refine toggle */}
                <div className="mt-3">
                  <button
                    onClick={() => setRefineTarget(refineTarget === mealIndex ? null : mealIndex)}
                    className="text-xs"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    ↺ Pedir substituição
                  </button>
                  {refineTarget === mealIndex && (
                    <div className="flex gap-2 mt-2">
                      <input
                        value={refineInput}
                        onChange={e => setRefineInput(e.target.value)}
                        placeholder="Ex: sem ovo, mais proteína..."
                        className="flex-1 px-3 py-1.5 rounded-lg border text-xs outline-none"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
                        onKeyDown={e => e.key === 'Enter' && handleRefine(mealIndex)}
                      />
                      <button
                        onClick={() => handleRefine(mealIndex)}
                        disabled={!refineInput.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        Enviar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {plan.tips.length > 0 && (
          <div className="rounded-xl p-4" style={{ backgroundColor: '#E1F5EE' }}>
            <p className="text-sm font-medium mb-2" style={{ color: '#085041' }}>Dicas nutricionais</p>
            <ul className="space-y-1">
              {plan.tips.map((tip, i) => (
                <li key={i} className="text-xs flex gap-2" style={{ color: '#085041' }}>
                  <span>•</span>{tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p className="text-sm p-3 rounded-xl" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>{error}</p>
        )}

        <button
          onClick={handleSavePlan}
          disabled={saving}
          className="w-full py-3 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {saving ? <><Spinner /> Salvando...</> : 'Salvar como cardápio padrão'}
        </button>
      </div>

      {/* Post-save modal */}
      {savedModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-xl" style={{ backgroundColor: 'var(--color-surface)' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#E1F5EE' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h3 className="text-base font-medium text-center mb-1">Cardápio padrão salvo</h3>
            <p className="text-sm text-center mb-5" style={{ color: 'var(--color-text-muted)' }}>
              O cardápio foi salvo como seu padrão. Você pode aplicá-lo a qualquer dia diretamente na tela de dieta.
            </p>
            <div className="space-y-2">
              <button
                onClick={handleApplyToToday}
                disabled={applyingTemplate}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {applyingTemplate ? <><Spinner /> Aplicando...</> : 'Aplicar para hoje'}
              </button>
              <button
                onClick={() => setSavedModal(false)}
                className="w-full py-2.5 rounded-xl text-sm border"
                style={{ borderColor: 'var(--color-border)' }}
              >
                Salvar como padrão e fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

  return null
}

// ─── Chat Tab ──────────────────────────────────────────────────────────────────

const CHAT_SESSION_KEY = 'fitsync_chat_messages'

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'Olá! Sou o FitSync Coach, seu assistente de treino e nutrição. Pode me perguntar qualquer coisa sobre exercícios, dieta, suplementação ou como melhorar seu progresso! 💪',
}

function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Feature 10 — Lazy init from sessionStorage
    try {
      const stored = typeof window !== 'undefined' ? sessionStorage.getItem(CHAT_SESSION_KEY) : null
      if (stored) {
        const parsed = JSON.parse(stored) as ChatMessage[]
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return [INITIAL_MESSAGE]
  })
  const [input, setInput] = useState('')
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Feature 10 — Save to sessionStorage on messages change
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(messages))
    } catch {}
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleClearChat() {
    setMessages([INITIAL_MESSAGE])
    try {
      sessionStorage.removeItem(CHAT_SESSION_KEY)
    } catch {}
  }

  function handleSend() {
    const msg = input.trim()
    if (!msg || isPending) return
    setInput('')

    const history = messages.filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0)
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)

    startTransition(async () => {
      const res = await sendChatMessage({ message: msg, history })
      if (res.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Erro: ${res.error}` }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: res.reply ?? '' }])
      }
    })
  }

  const suggestions = [
    'Quanto de proteína devo comer por dia?',
    'Como montar um treino de peito completo?',
    'O que comer antes do treino?',
    'Como aumentar a carga progressivamente?',
  ]

  return (
    <div className="flex flex-col h-full" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      {/* Chat header with clear button */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Coach IA</span>
        <button
          onClick={handleClearChat}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
          style={{ color: 'var(--color-alert)' }}
          title="Limpar conversa"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          Limpar conversa
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 text-xs font-bold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}>
                FS
              </div>
            )}
            <div
              className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm"
              style={{
                backgroundColor: m.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: m.role === 'user' ? 'white' : 'inherit',
                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              }}
            >
              {m.content.split('\n').map((line, li) => (
                <p key={li} className={li > 0 ? 'mt-1' : ''}>{line}</p>
              ))}
            </div>
          </div>
        ))}

        {isPending && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mr-2 text-xs font-bold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}>
              FS
            </div>
            <div className="px-4 py-3 rounded-2xl" style={{ backgroundColor: 'var(--color-surface)', borderRadius: '18px 18px 18px 4px' }}>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: '#1D9E75', animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: '#1D9E75', animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: '#1D9E75', animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions (only at start) */}
      {messages.length === 1 && (
        <div className="flex flex-wrap gap-2 py-3">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => { setInput(s); }}
              className="text-xs px-3 py-1.5 rounded-full border transition-all"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Pergunte ao coach..."
          className="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isPending}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}
          aria-label="Enviar mensagem"
        >
          {isPending ? <Spinner /> : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IAPage() {
  return (
    <Suspense fallback={<div className="p-6" />}>
      <IAPageInner />
    </Suspense>
  )
}

function IAPageInner() {
  const [tab, setTab] = useState<Tab>('treino')
  const searchParams = useSearchParams()

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'diet') setTab('dieta')
    else if (t === 'chat') setTab('chat')
    else if (t === 'workout') setTab('treino')
  }, [searchParams])

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'treino', label: 'Gerador de Treino', icon: '🏋️' },
    { id: 'dieta', label: 'Gerador de Dieta', icon: '🥗' },
    { id: 'chat', label: 'Coach IA', icon: '💬' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-medium">IA Consultora</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Gere treinos e dietas personalizados, ou converse com o coach
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ backgroundColor: 'var(--color-surface)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: tab === t.id ? 'white' : 'transparent',
              color: tab === t.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {tab === 'treino' && <WorkoutTab />}
        {tab === 'dieta' && <DietTab />}
        {tab === 'chat' && <ChatTab />}
      </div>
    </div>
  )
}
