'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { WORKOUT_METHODS } from '@/lib/workout-methods'
import {
  generateAndSaveWorkoutPlan,
  generateDietPlanAction,
  sendChatMessage,
} from '@/app/actions/ai'
import type { GeneratedWorkoutPlan, GeneratedDietPlan, ChatMessage } from '@/lib/openai'

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
  const [result, setResult] = useState<GeneratedWorkoutPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
    setStep('generating')
    startTransition(async () => {
      const res = await generateAndSaveWorkoutPlan({
        methodId: selectedMethod,
        daysPerWeek,
        goal,
        level,
      })
      if (res.error) {
        setError(res.error)
        setStep('config')
      } else {
        setResult(res.plan ?? null)
        setStep('result')
      }
    })
  }

  if (step === 'method') {
    return (
      <div>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Escolha o método de divisão dos seus treinos:
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
          A IA está montando {daysPerWeek} treinos personalizados para você. Isso pode levar alguns segundos.
        </p>
      </div>
    )
  }

  if (step === 'result' && result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{result.method}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {result.days.length} treinos salvos no seu perfil ✓
            </p>
          </div>
          <button
            onClick={() => { setStep('method'); setResult(null); setSelectedMethod(null) }}
            className="text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Gerar novo
          </button>
        </div>

        <div className="grid gap-3">
          {result.days.map((day, i) => (
            <div key={i} className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">{day.name}</p>
                <div className="flex gap-1 flex-wrap justify-end">
                  {day.muscleGroups.map(mg => (
                    <span key={mg} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E1F5EE', color: '#085041' }}>
                      {mg}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {day.exercises.map((ex, j) => (
                  <div key={j} className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm">{ex.name}</p>
                      {ex.notes && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{ex.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#E1F5EE', color: '#085041' }}>
                        {ex.targetSets}×{ex.targetReps}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {ex.restSeconds}s
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {result.tips.length > 0 && (
          <div className="rounded-xl p-4" style={{ backgroundColor: '#E1F5EE' }}>
            <p className="text-sm font-medium mb-2" style={{ color: '#085041' }}>Dicas do coach</p>
            <ul className="space-y-1">
              {result.tips.map((tip, i) => (
                <li key={i} className="text-xs flex gap-2" style={{ color: '#085041' }}>
                  <span>•</span>{tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return null
}

// ─── Diet Tab ─────────────────────────────────────────────────────────────────

function DietTab() {
  const [step, setStep] = useState<'config' | 'generating' | 'result'>('config')
  const [preferences, setPreferences] = useState<string[]>([])
  const [mealsPerDay, setMealsPerDay] = useState(4)
  const [dayIndex, setDayIndex] = useState(0)
  const [result, setResult] = useState<GeneratedDietPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
      } else {
        setResult(res.plan ?? null)
        setDayIndex(0)
        setStep('result')
      }
    })
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
            O cardápio será gerado com base nas suas metas de calorias e macros configuradas em <strong>Configurações → Metas</strong>.
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
          Gerar cardápio semanal com IA
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
        <p className="text-sm font-medium">Montando seu cardápio semanal...</p>
        <p className="text-xs text-center max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
          A IA está criando 7 dias de refeições com base nas suas metas. Aguarde alguns segundos.
        </p>
      </div>
    )
  }

  if (step === 'result' && result) {
    const day = result.days[dayIndex]
    const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-medium">Cardápio semanal</p>
          <button
            onClick={() => { setStep('config'); setResult(null) }}
            className="text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Gerar novo
          </button>
        </div>

        {/* Day selector */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {weekDays.map((d, i) => (
            <button
              key={i}
              onClick={() => setDayIndex(i)}
              className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium border transition-all"
              style={{
                borderColor: dayIndex === i ? 'var(--color-primary)' : 'var(--color-border)',
                backgroundColor: dayIndex === i ? '#E1F5EE' : 'var(--color-surface)',
                color: dayIndex === i ? 'var(--color-primary)' : 'inherit',
              }}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Day summary */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Kcal', value: Math.round(day.totalCalories), color: '#1D9E75' },
            { label: 'Prot', value: `${Math.round(day.totalProteinG)}g`, color: '#1D9E75' },
            { label: 'Carb', value: `${Math.round(day.totalCarbsG)}g`, color: '#378ADD' },
            { label: 'Gord', value: `${Math.round(day.totalFatG)}g`, color: '#EF9F27' },
          ].map(m => (
            <div key={m.label} className="text-center p-2 rounded-xl" style={{ backgroundColor: 'var(--color-surface)' }}>
              <p className="text-sm font-medium" style={{ color: m.color }}>{m.value}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{m.label}</p>
            </div>
          ))}
        </div>

        {/* Meals */}
        <div className="space-y-3">
          {day.meals.map((meal, mi) => (
            <div key={mi} className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium">{meal.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{meal.time}</p>
                </div>
                <p className="text-sm font-medium">{Math.round(meal.totalCalories)} kcal</p>
              </div>
              <div className="space-y-1.5">
                {meal.items.map((item, ii) => (
                  <div key={ii} className="flex items-center justify-between text-xs">
                    <div>
                      <span>{item.food}</span>
                      <span className="ml-1" style={{ color: 'var(--color-text-muted)' }}>({item.quantity})</span>
                    </div>
                    <span style={{ color: 'var(--color-text-muted)' }}>{item.calories} kcal</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t flex gap-3 text-xs" style={{ borderColor: 'var(--color-border)' }}>
                <span style={{ color: '#1D9E75' }}>P: {Math.round(meal.totalProteinG)}g</span>
                <span style={{ color: '#378ADD' }}>C: {Math.round(meal.totalCarbsG)}g</span>
                <span style={{ color: '#EF9F27' }}>G: {Math.round(meal.totalFatG)}g</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tips */}
        {result.tips.length > 0 && (
          <div className="rounded-xl p-4" style={{ backgroundColor: '#E1F5EE' }}>
            <p className="text-sm font-medium mb-2" style={{ color: '#085041' }}>Dicas nutricionais</p>
            <ul className="space-y-1">
              {result.tips.map((tip, i) => (
                <li key={i} className="text-xs flex gap-2" style={{ color: '#085041' }}>
                  <span>•</span>{tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.substitutions.length > 0 && (
          <div className="rounded-xl p-4 border" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm font-medium mb-2">Substituições possíveis</p>
            <ul className="space-y-1">
              {result.substitutions.map((s, i) => (
                <li key={i} className="text-xs flex gap-2" style={{ color: 'var(--color-text-muted)' }}>
                  <span>↔</span>{s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
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
  const [tab, setTab] = useState<Tab>('treino')

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
