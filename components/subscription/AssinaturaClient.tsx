'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startCheckout, cancelMySubscription, getMySubscription, type MySubscription } from '@/app/actions/subscription'

interface PlanView {
  id: string
  name: string
  value: number
  cycle: string
  trialDays: number
  description: string
}

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const cycleLabel = (c: string) => (c === 'YEARLY' ? '/ano' : '/mês')
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : '—'
const fmtInDays = (days: number) =>
  new Date(Date.now() + days * 86400_000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  TRIALING: { text: 'Período de teste', color: 'var(--color-primary)' },
  ACTIVE: { text: 'Assinatura ativa', color: 'var(--color-primary)' },
  PAST_DUE: { text: 'Pagamento pendente', color: 'var(--color-fat, #EF9F27)' },
  PENDING: { text: 'Aguardando pagamento', color: 'var(--color-fat, #EF9F27)' },
  CANCELED: { text: 'Cancelada', color: 'var(--color-text-muted)' },
  EXPIRED: { text: 'Expirada', color: 'var(--color-alert, #E24B4A)' },
}

export default function AssinaturaClient({
  plans,
  current,
  gated,
}: {
  plans: PlanView[]
  current: MySubscription | null
  gated?: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string>(plans[0]?.id ?? 'monthly')
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false) // aguardando confirmação do checkout
  const [isPending, startTransition] = useTransition()

  const isActive = current && (current.status === 'ACTIVE' || current.status === 'TRIALING')

  // Retorno do checkout do Asaas (?status=ok|cancel)
  useEffect(() => {
    if (typeof window === 'undefined' || isActive) return
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status')
    if (!status) return
    window.history.replaceState({}, '', '/app/assinatura')

    if (status === 'cancel') {
      setError('Pagamento não concluído. Você pode tentar de novo quando quiser.')
      return
    }
    if (status === 'ok') {
      // O webhook confirma de forma assíncrona — faz poll até virar TRIALING/ACTIVE
      setProcessing(true)
      let tries = 0
      const timer = setInterval(async () => {
        tries++
        const sub = await getMySubscription()
        if (sub && (sub.status === 'TRIALING' || sub.status === 'ACTIVE')) {
          clearInterval(timer)
          router.refresh()
        } else if (tries >= 8) {
          clearInterval(timer)
          setProcessing(false)
        }
      }, 2000)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubscribe() {
    setError(null)
    startTransition(async () => {
      const res = await startCheckout({ planId: selected })
      if (res.error) { setError(res.error); return }
      if (res.checkoutUrl) { window.location.href = res.checkoutUrl; return }
      if (res.alreadyActive) { router.refresh(); return }
      router.refresh()
    })
  }

  function handleCancel() {
    if (!confirm('Tem certeza que deseja cancelar sua assinatura?')) return
    setError(null)
    startTransition(async () => {
      const res = await cancelMySubscription()
      if (res.error) setError(res.error)
      router.refresh()
    })
  }

  // ── Processando retorno do checkout ──────────────────────────────────
  if (processing) {
    return (
      <div className="rounded-xl p-6 border text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-card)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
        <p className="text-sm font-medium mb-1">Confirmando seu pagamento...</p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Isso leva alguns segundos. Não feche a página.</p>
      </div>
    )
  }

  // ── Estado: assinatura ativa / em teste ──────────────────────────────
  if (isActive) {
    const label = STATUS_LABEL[current!.status] ?? STATUS_LABEL.ACTIVE
    return (
      <div className="rounded-xl p-5 border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: label.color }} />
          <span className="text-sm font-medium" style={{ color: label.color }}>{label.text}</span>
        </div>
        <p className="text-sm mb-1">
          Plano <span className="font-medium">{current!.plan === 'annual' ? 'Anual' : 'Mensal'}</span> — {BRL(current!.value)}{cycleLabel(current!.cycle)}
        </p>
        {current!.status === 'TRIALING' && (
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Teste grátis ativo. 1ª cobrança em {fmtDate(current!.trialEndsAt ?? current!.currentDueDate)}.
          </p>
        )}
        {current!.status === 'ACTIVE' && current!.currentDueDate && (
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Próxima cobrança em {fmtDate(current!.currentDueDate)}.
          </p>
        )}
        <div>
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="text-xs px-3 py-2 rounded-lg border disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-alert, #E24B4A)' }}
          >
            {isPending ? '...' : 'Cancelar assinatura'}
          </button>
        </div>
        {error && <p className="text-xs mt-2" style={{ color: 'var(--color-alert, #E24B4A)' }}>{error}</p>}
      </div>
    )
  }

  // ── Estado: sem assinatura ativa (novo / pendente / cancelada) ──────
  const resumeCheckout = current && current.status === 'PENDING' ? current.checkoutUrl : null
  const selectedPlan = plans.find(p => p.id === selected) ?? plans[0]

  return (
    <div>
      {gated && (
        <div className="rounded-xl p-4 mb-4 border" style={{ backgroundColor: 'var(--color-primary-light)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-card)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>Comece seus {plans[0]?.trialDays ?? 7} dias grátis</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Escolha um plano para liberar o FitSync completo. Você só é cobrado depois do teste.</p>
        </div>
      )}

      {resumeCheckout && (
        <div className="rounded-xl p-4 mb-4 border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-fat, #EF9F27)', borderRadius: 'var(--radius-card)' }}>
          <p className="text-sm font-medium mb-1">Você começou um checkout</p>
          <a href={resumeCheckout} className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
            Continuar o pagamento →
          </a>
        </div>
      )}

      {/* Planos */}
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        {plans.map((p) => {
          const active = selected === p.id
          const monthlyEquiv = p.cycle === 'YEARLY' ? p.value / 12 : null
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className="text-left rounded-xl p-4 border transition-colors"
              style={{
                backgroundColor: active ? 'var(--color-primary-light)' : 'var(--color-surface)',
                borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                borderRadius: 'var(--radius-card)',
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{p.name}</span>
                {active && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div className="text-xl font-medium">
                {BRL(p.value)}<span className="text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>{cycleLabel(p.cycle)}</span>
              </div>
              {monthlyEquiv && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>≈ {BRL(monthlyEquiv)}/mês</p>
              )}
              <p className="text-xs mt-2" style={{ color: 'var(--color-primary)' }}>{p.trialDays} dias grátis</p>
            </button>
          )
        })}
      </div>

      <button
        onClick={handleSubscribe}
        disabled={isPending}
        className="w-full py-3 rounded-lg text-white font-medium disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {isPending ? 'Abrindo pagamento...' : `Começar ${selectedPlan?.trialDays ?? 7} dias grátis`}
      </button>

      {error && <p className="text-xs mt-2" style={{ color: 'var(--color-alert, #E24B4A)' }}>{error}</p>}

      <p className="text-xs mt-3 text-center leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        Você informa o cartão na página segura do Asaas.<br />
        Nada é cobrado agora — a 1ª cobrança é só em <strong>{fmtInDays(selectedPlan?.trialDays ?? 7)}</strong>. Cancele quando quiser.
      </p>
    </div>
  )
}
