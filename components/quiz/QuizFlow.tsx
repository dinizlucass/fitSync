'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { QUESTIONS, type Objective, type QuizAnswers, type QuizResult } from '@/lib/quiz/config'
import { submitQuizLead, type QuizUtms } from '@/app/actions/quiz'
import { track } from '@/lib/analytics/track'
import { normalizeQuizPhone } from '@/lib/quiz/validation'
import { PLANS } from '@/lib/asaas/config'

type Phase = 'question' | 'interstitial' | 'lead' | 'analyzing' | 'result'

// Telas de reforço mostradas DEPOIS de responder certa pergunta.
const INTERSTITIALS: Record<string, { emoji: string; title: string; text: string }> = {
  objective: {
    emoji: '🎯',
    title: 'Boa escolha!',
    text: 'Vamos montar um plano sob medida pro seu objetivo. Responda com sinceridade — quanto melhor entendermos você, melhor fica o resultado.',
  },
  days: {
    emoji: '💬',
    title: 'Falta pouco',
    text: 'Seu plano vai viver no WhatsApp: você registra treino e refeição mandando uma mensagem, sem app complicado. Só mais algumas perguntas.',
  },
}

const ANALYZING_STEPS = [
  'Analisando suas respostas...',
  'Calculando suas metas de calorias e macros...',
  'Montando sua divisão de treino ideal...',
  'Finalizando seu plano personalizado...',
]

function captureUtms(): QuizUtms {
  if (typeof window === 'undefined') return {}
  const p = new URLSearchParams(window.location.search)
  const g = (k: string) => p.get(k) ?? undefined
  return {
    utmSource: g('utm_source'),
    utmMedium: g('utm_medium'),
    utmCampaign: g('utm_campaign'),
    utmContent: g('utm_content'),
    utmTerm: g('utm_term'),
    fbclid: g('fbclid'),
  }
}

export default function QuizFlow({ presetObjective }: { presetObjective?: Objective }) {
  const [answers, setAnswers] = useState<QuizAnswers>(
    presetObjective ? { objective: presetObjective } : {},
  )
  const [phase, setPhase] = useState<Phase>('question')
  const [qIndex, setQIndex] = useState(0)
  const [interKey, setInterKey] = useState<string | null>(null)
  const [numInput, setNumInput] = useState('')
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [analyzingStep, setAnalyzingStep] = useState(0)
  const utms = useRef<QuizUtms>({})
  const advancing = useRef(false)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
  }, [])

  useEffect(() => { advancing.current = false }, [qIndex, phase])

  // Lista de perguntas visível (respeita preset de objetivo e skips condicionais).
  const visible = useMemo(
    () =>
      QUESTIONS.filter((q) => {
        if (presetObjective && q.id === 'objective') return false
        if (q.skipIf && q.skipIf(answers)) return false
        return true
      }),
    [answers, presetObjective],
  )

  const current = visible[qIndex]
  const progress = Math.round(((phase === 'result' || phase === 'lead' || phase === 'analyzing' ? visible.length : qIndex) / (visible.length + 1)) * 100)

  useEffect(() => {
    utms.current = captureUtms()
    track('quiz_started', { objective: presetObjective ?? null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Animação da tela "analisando" (troca as mensagens em sequência).
  useEffect(() => {
    if (phase !== 'analyzing') return
    setAnalyzingStep(0)
    const t = setInterval(() => setAnalyzingStep((s) => Math.min(s + 1, ANALYZING_STEPS.length - 1)), 700)
    return () => clearInterval(t)
  }, [phase])

  function goNext() {
    // Reforço depois desta pergunta?
    if (current && INTERSTITIALS[current.id]) {
      setInterKey(current.id)
      setPhase('interstitial')
      return
    }
    advanceQuestion()
  }

  function advanceQuestion() {
    setNumInput(typeof answers[visible[qIndex + 1]?.id] === 'string' ? answers[visible[qIndex + 1]?.id] as string : '')
    setError(null)
    if (qIndex + 1 >= visible.length) {
      setPhase('lead')
    } else {
      setQIndex((i) => i + 1)
      setPhase('question')
    }
  }

  function answerSingle(value: string) {
    if (!current || advancing.current) return
    advancing.current = true
    setAnswers((a) => ({ ...a, [current.id]: value }))
    track('quiz_answered', { question: current.id })
    advanceTimer.current = setTimeout(goNext, 180)
  }

  function goBack() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    advancing.current = false
    const previous = phase === 'lead' ? visible.length - 1 : Math.max(0, qIndex - 1)
    setQIndex(previous)
    setNumInput(typeof answers[visible[previous].id] === 'string' ? answers[visible[previous].id] as string : '')
    setError(null)
    setPhase('question')
  }

  function toggleMulti(value: string) {
    if (!current) return
    setAnswers((a) => {
      const prev = Array.isArray(a[current.id]) ? (a[current.id] as string[]) : []
      // "nenhuma" é exclusiva
      if (value === 'nenhuma') return { ...a, [current.id]: ['nenhuma'] }
      const withoutNone = prev.filter((v) => v !== 'nenhuma')
      const next = withoutNone.includes(value)
        ? withoutNone.filter((v) => v !== value)
        : [...withoutNone, value]
      return { ...a, [current.id]: next }
    })
  }

  function confirmMulti() {
    if (!current) return
    track('quiz_answered', { question: current.id })
    goNext()
  }

  function confirmNumber() {
    if (!current) return
    const n = /^\d+(?:[.,]\d+)?$/.test(numInput.trim()) ? Number(numInput.replace(',', '.')) : NaN
    if (!Number.isFinite(n) || (current.min && n < current.min) || (current.max && n > current.max)) {
      setError(`Informe um valor entre ${current.min} e ${current.max} ${current.unit ?? ''}.`)
      return
    }
    setAnswers((a) => ({ ...a, [current.id]: String(n) }))
    track('quiz_answered', { question: current.id })
    goNext()
  }

  async function submitLead(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    if (name.trim().length < 2) { setError('Digite seu nome.'); return }
    if (!normalizeQuizPhone(whatsapp)) { setError('Digite um WhatsApp válido com DDD.'); return }

    setSubmitting(true)
    setPhase('analyzing')
    const startedAt = Date.now()
    const eventId = (globalThis.crypto?.randomUUID?.() ?? `lead-${Date.now()}`)

    try {
      const res = await submitQuizLead({
        name: name.trim(),
        whatsapp,
        answers,
        utms: utms.current,
        eventId,
      })

      // Garante a animação mínima (percepção de "análise") mesmo se o servidor responder rápido.
      const elapsed = Date.now() - startedAt
      await new Promise((r) => setTimeout(r, Math.max(0, 2600 - elapsed)))
      setSubmitting(false)

      if (res.error || !res.result) {
        setError(res.error ?? 'Algo deu errado. Tente de novo.')
        setPhase('lead')
        return
      }

      if (res.saved) track('quiz_lead', undefined, { eventId })
      track('quiz_completed')
      // Persiste respostas + nome para pré-preencher o cadastro/onboarding.
      try {
        localStorage.setItem('fitsync_quiz', JSON.stringify({ name: name.trim(), answers, utms: utms.current }))
      } catch { /* localStorage indisponível: segue sem prefill */ }
      setResult(res.result)
      setPhase('result')
    } catch {
      setError('Não foi possível concluir. Confira sua conexão e tente novamente; suas respostas foram mantidas.')
      setPhase('lead')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Barra de progresso ─────────────────────────────────────────────────
  const showProgress = phase === 'question' || phase === 'interstitial' || phase === 'lead'

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
      {/* Topo: logo + progresso */}
      <div className="px-4 pt-5 pb-3 max-w-lg w-full mx-auto">
        <div className="text-center mb-3">
          <span className="text-lg font-medium tracking-tight">
            <span className="text-black dark:text-white">Fit</span>
            <span style={{ color: 'var(--color-primary)' }}>Sync</span>
          </span>
        </div>
        {showProgress && (
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface)' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.max(progress, 5)}%`, backgroundColor: 'var(--color-primary)' }} />
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center px-4 pb-10 max-w-lg w-full mx-auto">
        {((phase === 'question' && qIndex > 0) || phase === 'lead') && (
          <button type="button" onClick={goBack} className="self-start text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>← Voltar e corrigir</button>
        )}
        {/* ── Pergunta ──────────────────────────────────────────────────── */}
        {phase === 'question' && current && (
          <div>
            <h1 className="text-2xl font-medium tracking-tight mb-1">{current.title}</h1>
            {current.subtitle && (
              <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>{current.subtitle}</p>
            )}
            {!current.subtitle && <div className="mb-6" />}

            {current.type === 'single' && (
              <div className="space-y-2.5">
                {current.options!.map((opt) => {
                  const active = answers[current.id] === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => answerSingle(opt.value)}
                      aria-pressed={active}
                      className="w-full flex items-center gap-3 text-left px-4 py-4 rounded-xl border transition-colors"
                      style={{
                        borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                        backgroundColor: active ? 'var(--color-primary-light)' : 'var(--color-surface)',
                        borderRadius: 'var(--radius-card)',
                      }}
                    >
                      {opt.emoji && <span className="text-xl">{opt.emoji}</span>}
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {current.type === 'multi' && (
              <>
                <div className="space-y-2.5">
                  {current.options!.map((opt) => {
                    const arr = Array.isArray(answers[current.id]) ? (answers[current.id] as string[]) : []
                    const active = arr.includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleMulti(opt.value)}
                        aria-pressed={active}
                        className="w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-xl border transition-colors"
                        style={{
                          borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                          backgroundColor: active ? 'var(--color-primary-light)' : 'var(--color-surface)',
                          borderRadius: 'var(--radius-card)',
                        }}
                      >
                        <span className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0" style={{ borderColor: active ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: active ? 'var(--color-primary)' : 'transparent' }}>
                          {active && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                          )}
                        </span>
                        <span className="text-sm font-medium">{opt.label}</span>
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={confirmMulti}
                  disabled={!Array.isArray(answers[current.id]) || (answers[current.id] as string[]).length === 0}
                  className="w-full mt-5 py-3.5 rounded-xl text-white font-medium disabled:opacity-40"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Continuar
                </button>
              </>
            )}

            {current.type === 'number' && (
              <form onSubmit={(e) => { e.preventDefault(); confirmNumber() }}>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={current.title}
                    value={numInput}
                    onChange={(e) => setNumInput(e.target.value)}
                    placeholder={current.placeholder}
                    autoFocus
                    className="min-w-0 flex-1 text-lg px-4 py-3.5 rounded-xl border outline-none focus:ring-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  />
                  <span className="text-sm font-medium w-8" style={{ color: 'var(--color-text-muted)' }}>{current.unit}</span>
                </div>
                {error && <p className="text-xs mt-2" style={{ color: 'var(--color-alert, #E24B4A)' }}>{error}</p>}
                <button type="submit" className="w-full mt-5 py-3.5 rounded-xl text-white font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
                  Continuar
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── Reforço ───────────────────────────────────────────────────── */}
        {phase === 'interstitial' && interKey && (
          <div className="text-center">
            <div className="text-5xl mb-4">{INTERSTITIALS[interKey].emoji}</div>
            <h2 className="text-2xl font-medium tracking-tight mb-3">{INTERSTITIALS[interKey].title}</h2>
            <p className="text-sm mb-8 max-w-sm mx-auto" style={{ color: 'var(--color-text-muted)' }}>{INTERSTITIALS[interKey].text}</p>
            <button onClick={advanceQuestion} className="w-full py-3.5 rounded-xl text-white font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
              Continuar
            </button>
          </div>
        )}

        {/* ── Captura de lead ───────────────────────────────────────────── */}
        {phase === 'lead' && (
          <form onSubmit={submitLead}>
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">✅</div>
              <h1 className="text-2xl font-medium tracking-tight mb-2">Sua prévia está pronta!</h1>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Deixe seu nome e WhatsApp para ver suas estimativas e uma sugestão de divisão de treino.
              </p>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                aria-label="Seu nome"
                autoComplete="given-name"
                maxLength={100}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                autoFocus
                className="w-full text-sm px-4 py-3.5 rounded-xl border outline-none focus:ring-2"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              />
              <input
                type="tel"
                aria-label="WhatsApp com DDD"
                autoComplete="tel"
                maxLength={30}
                required
                inputMode="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="WhatsApp com DDD (ex: 11 99999-9999)"
                className="w-full text-sm px-4 py-3.5 rounded-xl border outline-none focus:ring-2"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              />
            </div>
            {error && <p className="text-xs mt-2" style={{ color: 'var(--color-alert, #E24B4A)' }}>{error}</p>}
            <button type="submit" disabled={submitting} className="w-full mt-5 py-3.5 rounded-xl text-white font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
              Ver meu plano personalizado
            </button>
            <p className="text-xs text-center mt-3" style={{ color: 'var(--color-text-muted)' }}>
              Usamos seus dados para gerar esta prévia e entrar em contato sobre a FitSync. Consulte a{' '}
              <Link href="/privacidade" target="_blank" className="underline">Política de Privacidade</Link> e os{' '}
              <Link href="/termos" target="_blank" className="underline">Termos de Uso</Link>.
            </p>
          </form>
        )}

        {/* ── Analisando (animação) ─────────────────────────────────────── */}
        {phase === 'analyzing' && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-6" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            <h2 className="text-xl font-medium tracking-tight mb-2">Montando seu plano…</h2>
            <p className="text-sm transition-all" style={{ color: 'var(--color-text-muted)' }}>{ANALYZING_STEPS[analyzingStep]}</p>
          </div>
        )}

        {/* ── Resultado ─────────────────────────────────────────────────── */}
        {phase === 'result' && result && (
          <QuizResultView result={result} />
        )}
      </div>
    </div>
  )
}

function QuizResultView({ result }: { result: QuizResult }) {
  const macro = (label: string, val: string, color: string) => (
    <div className="rounded-xl p-3 text-center border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
      <div className="text-lg font-medium" style={{ color }}>{val}</div>
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
    </div>
  )
  return (
    <div>
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-3" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
          Prévia personalizada
        </div>
        <h1 className="text-2xl font-medium tracking-tight">{result.headline}</h1>
      </div>

      <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-text-muted)' }}>{result.diagnosis}</p>
      <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>{result.painLine}</p>
      <p className="text-xs leading-relaxed mb-5" style={{ color: 'var(--color-text-muted)' }}>
        Esta é uma estimativa inicial baseada nas suas respostas, incluindo faixa de idade e disponibilidade para treinar. Confirme seus dados e atividade real no app para ajustar as metas.
      </p>

      {/* Metas */}
      <div className="rounded-xl border p-4 mb-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-sm font-medium">Estimativa de metas diárias</span>
          <span className="text-2xl font-medium" style={{ color: 'var(--color-primary)' }}>{result.calories}<span className="text-sm font-normal" style={{ color: 'var(--color-text-muted)' }}> kcal</span></span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {macro('Proteína', `${result.proteinG}g`, 'var(--color-primary)')}
          {macro('Carbo', `${result.carbsG}g`, 'var(--color-carbs, #4A90D9)')}
          {macro('Gordura', `${result.fatG}g`, 'var(--color-fat, #EF9F27)')}
        </div>
        {result.restrictionNote && (
          <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>{result.restrictionNote}</p>
        )}
      </div>

      {/* Treino */}
      <div className="rounded-xl border p-4 mb-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
        <span className="text-sm font-medium">{result.split.name}</span>
        <div className="mt-3 space-y-2">
          {result.split.days.map((d) => (
            <div key={d.day} className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium text-white flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>{d.day}</span>
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{d.focus}</span>
            </div>
          ))}
        </div>
      </div>

      {result.timeline && (
        <div className="rounded-xl p-4 mb-6 text-sm" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: 'var(--radius-card)' }}>
          🎯 {result.timeline}
        </div>
      )}

      {/* Âncora WhatsApp + CTA */}
      <p className="text-sm leading-relaxed mb-5 text-center" style={{ color: 'var(--color-text-muted)' }}>
        E o melhor: seu coach acompanha tudo pelo <strong style={{ color: 'var(--color-text)' }}>WhatsApp</strong> — você registra treino e refeição mandando uma mensagem.
      </p>

      <Link
        href="/login?tab=signup&from=quiz"
        onClick={() => track('clicked_cta', { source: 'quiz_result' })}
        className="block text-center py-4 rounded-xl text-white font-medium"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        Desbloquear com 7 dias grátis
      </Link>
      <p className="text-xs text-center mt-3" style={{ color: 'var(--color-text-muted)' }}>
        {PLANS.monthly.trialDays} dias grátis no mensal; depois R$ {PLANS.monthly.value.toFixed(2).replace('.', ',')}/mês. Cartão necessário para ativar o teste. Cancele antes do fim para não ser cobrado.
      </p>
    </div>
  )
}
