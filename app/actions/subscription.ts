'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { saoPauloDateStr } from '@/lib/coach/shared'
import { reportError } from '@/lib/monitoring'
import { getPlan, DEFAULT_BILLING_TYPE, ACTIVE_STATUSES } from '@/lib/asaas/config'
import {
  createAsaasCustomer,
  createAsaasSubscription,
  getSubscriptionPayments,
  cancelAsaasSubscription,
} from '@/lib/asaas/client'

// ─── Validação de CPF/CNPJ ──────────────────────────────────────────────

function onlyDigits(s: string): string {
  return (s ?? '').replace(/\D/g, '')
}

function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const calc = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += parseInt(cpf[i], 10) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === parseInt(cpf[9], 10) && calc(10) === parseInt(cpf[10], 10)
}

function isValidCpfCnpj(digits: string): boolean {
  if (digits.length === 11) return isValidCpf(digits)
  if (digits.length === 14) return true // CNPJ: valida formato; Asaas confere o dígito
  return false
}

/** Data de vencimento inicial (hoje + dias de trial) em yyyy-MM-dd, ancorada ao meio-dia. */
function nextDueDateISO(trialDays: number): string {
  const base = new Date(saoPauloDateStr() + 'T12:00:00')
  base.setDate(base.getDate() + trialDays)
  return base.toISOString().slice(0, 10)
}

// ─── Iniciar/atualizar assinatura ──────────────────────────────────────

export async function startSubscription(params: {
  planId: string
  cpfCnpj: string
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
    return { alreadyActive: true, checkoutUrl: existing.checkoutUrl ?? undefined }
  }

  const cpfCnpj = onlyDigits(params.cpfCnpj)
  if (!isValidCpfCnpj(cpfCnpj)) {
    return { error: 'CPF/CNPJ inválido. Confira os números.' }
  }

  try {
    // 1. Cliente no Asaas (reaproveita se já existir)
    let asaasCustomerId = existing?.asaasCustomerId ?? null
    if (!asaasCustomerId) {
      const customer = await createAsaasCustomer({
        name: dbUser.name ?? dbUser.email,
        cpfCnpj,
        email: dbUser.email,
        mobilePhone: dbUser.phone ?? undefined,
        externalReference: dbUser.id,
      })
      asaasCustomerId = customer.id
    }

    // 2. Assinatura (cobrança recorrente) com trial
    const nextDueDate = nextDueDateISO(plan.trialDays)
    const subscription = await createAsaasSubscription({
      customer: asaasCustomerId,
      billingType: DEFAULT_BILLING_TYPE,
      value: plan.value,
      nextDueDate,
      cycle: plan.cycle,
      description: plan.description,
      externalReference: dbUser.id,
    })

    // 3. Checkout hospedado = invoiceUrl da 1ª cobrança gerada
    let checkoutUrl: string | undefined
    try {
      const payments = await getSubscriptionPayments(subscription.id)
      checkoutUrl = payments.data[0]?.invoiceUrl
    } catch {
      // sem pagamento ainda — segue sem checkoutUrl, será preenchido via webhook
    }

    // 4. Persiste (upsert — um registro por usuário)
    const status = plan.trialDays > 0 ? 'TRIALING' : 'PENDING'
    const trialEndsAt = plan.trialDays > 0 ? new Date(nextDueDate + 'T12:00:00') : null

    await prisma.subscription.upsert({
      where: { userId: dbUser.id },
      create: {
        userId: dbUser.id,
        plan: plan.id,
        status,
        billingType: DEFAULT_BILLING_TYPE,
        value: plan.value,
        cycle: plan.cycle,
        cpfCnpj,
        asaasCustomerId,
        asaasSubscriptionId: subscription.id,
        checkoutUrl,
        currentDueDate: new Date(nextDueDate + 'T12:00:00'),
        trialEndsAt,
      },
      update: {
        plan: plan.id,
        status,
        billingType: DEFAULT_BILLING_TYPE,
        value: plan.value,
        cycle: plan.cycle,
        cpfCnpj,
        asaasCustomerId,
        asaasSubscriptionId: subscription.id,
        checkoutUrl,
        currentDueDate: new Date(nextDueDate + 'T12:00:00'),
        trialEndsAt,
      },
    })

    revalidatePath('/app/assinatura')
    return { checkoutUrl }
  } catch (e) {
    reportError('asaas:startSubscription', e, { userId: dbUser.id, plan: plan.id })
    return { error: e instanceof Error ? e.message : 'Erro ao iniciar assinatura' }
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
