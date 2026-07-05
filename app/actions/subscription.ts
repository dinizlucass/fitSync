'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { saoPauloDateStr } from '@/lib/coach/shared'
import { reportError } from '@/lib/monitoring'
import {
  getPlan, ACTIVE_STATUSES,
  CHECKOUT_BILLING_TYPES, CHECKOUT_EXPIRES_MIN, appPublicUrl,
} from '@/lib/asaas/config'
import { createAsaasCheckout, cancelAsaasSubscription } from '@/lib/asaas/client'

/** Data de vencimento inicial (hoje + dias de trial) em yyyy-MM-dd, ancorada ao meio-dia. */
function nextDueDateISO(trialDays: number): string {
  const base = new Date(saoPauloDateStr() + 'T12:00:00')
  base.setDate(base.getDate() + trialDays)
  return base.toISOString().slice(0, 10)
}

// ─── Iniciar checkout (cartão + trial) ──────────────────────────────────

export async function startCheckout(params: {
  planId: string
}): Promise<{ checkoutUrl?: string; alreadyActive?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { subscription: true },
  })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  const plan = getPlan(params.planId)
  if (!plan) return { error: 'Plano inválido' }

  // Já tem assinatura liberando acesso? Não cria outra.
  const existing = dbUser.subscription
  if (existing && ACTIVE_STATUSES.includes(existing.status as never)) {
    return { alreadyActive: true }
  }

  try {
    const nextDueDate = nextDueDateISO(plan.trialDays)
    const base = appPublicUrl()

    // Checkout hospedado: cartão digitado na página do Asaas (PCI-safe),
    // assinatura recorrente com 1ª cobrança em nextDueDate (trial).
    // externalReference = userId amarra o webhook de volta ao usuário.
    const checkout = await createAsaasCheckout({
      billingTypes: CHECKOUT_BILLING_TYPES,
      chargeTypes: ['RECURRENT'],
      minutesToExpire: CHECKOUT_EXPIRES_MIN,
      externalReference: dbUser.id,
      callback: {
        successUrl: `${base}/app/assinatura?status=ok`,
        cancelUrl: `${base}/app/assinatura?status=cancel`,
      },
      items: [{ name: `FitSync Premium — ${plan.name}`, quantity: 1, value: plan.value }],
      subscription: { cycle: plan.cycle, nextDueDate },
    })

    // Persiste o checkout pendente (o webhook completa quando o cartão passar)
    const trialEndsAt = plan.trialDays > 0 ? new Date(nextDueDate + 'T12:00:00') : null
    await prisma.subscription.upsert({
      where: { userId: dbUser.id },
      create: {
        userId: dbUser.id,
        plan: plan.id,
        status: 'PENDING',
        billingType: 'CREDIT_CARD',
        value: plan.value,
        cycle: plan.cycle,
        asaasCheckoutId: checkout.id,
        checkoutUrl: checkout.link,
        currentDueDate: new Date(nextDueDate + 'T12:00:00'),
        trialEndsAt,
      },
      update: {
        plan: plan.id,
        status: 'PENDING',
        billingType: 'CREDIT_CARD',
        value: plan.value,
        cycle: plan.cycle,
        asaasCheckoutId: checkout.id,
        checkoutUrl: checkout.link,
        currentDueDate: new Date(nextDueDate + 'T12:00:00'),
        trialEndsAt,
      },
    })

    revalidatePath('/app/assinatura')
    return { checkoutUrl: checkout.link }
  } catch (e) {
    reportError('asaas:startCheckout', e, { userId: dbUser.id, plan: plan.id })
    return { error: e instanceof Error ? e.message : 'Erro ao iniciar o checkout' }
  }
}

// ─── Consultar assinatura ──────────────────────────────────────────────

export interface MySubscription {
  status: string
  plan: string
  value: number
  cycle: string
  checkoutUrl: string | null
  currentDueDate: string | null
  trialEndsAt: string | null
}

export async function getMySubscription(): Promise<MySubscription | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // best-effort: se a tabela subscriptions ainda não existe (migração não rodada),
  // não quebra a página — apenas mostra os planos.
  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { subscription: true },
  }).catch(() => null)
  const sub = dbUser?.subscription
  if (!sub) return null

  return {
    status: sub.status,
    plan: sub.plan,
    value: sub.value,
    cycle: sub.cycle,
    checkoutUrl: sub.checkoutUrl,
    currentDueDate: sub.currentDueDate?.toISOString() ?? null,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
  }
}

// ─── Cancelar ──────────────────────────────────────────────────────────

export async function cancelMySubscription(): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { subscription: true },
  })
  const sub = dbUser?.subscription
  if (!sub?.asaasSubscriptionId) return { error: 'Nenhuma assinatura ativa' }

  try {
    await cancelAsaasSubscription(sub.asaasSubscriptionId)
    await prisma.subscription.update({
      where: { userId: dbUser!.id },
      data: { status: 'CANCELED', lastEvent: 'CANCELED_BY_USER' },
    })
    revalidatePath('/app/assinatura')
    return { success: true }
  } catch (e) {
    reportError('asaas:cancelSubscription', e, { userId: dbUser!.id })
    return { error: e instanceof Error ? e.message : 'Erro ao cancelar' }
  }
}

// ─── Gate ──────────────────────────────────────────────────────────────

/** True se o usuário tem assinatura em status que libera o app. */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { userId } }).catch(() => null)
  if (!sub) return false
  return ACTIVE_STATUSES.includes(sub.status as never)
}
