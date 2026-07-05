/**
 * Configuração da integração de cobrança recorrente (Asaas).
 * Chaves e ambiente vêm de env — as credenciais finais entram depois.
 */

export type PlanId = 'monthly' | 'annual'
export type AsaasCycle = 'MONTHLY' | 'YEARLY'
/** Deixado UNDEFINED de propósito: o cliente escolhe PIX/Boleto/Cartão na página do Asaas. */
export type AsaasBillingType = 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX'

export interface Plan {
  id: PlanId
  name: string
  value: number          // em reais
  cycle: AsaasCycle
  trialDays: number      // dias grátis antes da 1ª cobrança
  description: string
}

export const PLANS: Record<PlanId, Plan> = {
  monthly: {
    id: 'monthly',
    name: 'Mensal',
    value: 29.9,
    cycle: 'MONTHLY',
    trialDays: 7,
    description: 'FitSync Premium — plano mensal',
  },
  annual: {
    id: 'annual',
    name: 'Anual',
    value: 257,
    cycle: 'YEARLY',
    trialDays: 7,
    description: 'FitSync Premium — plano anual',
  },
}

export const DEFAULT_BILLING_TYPE: AsaasBillingType = 'UNDEFINED'

// Checkout hospedado: só cartão (permite cobrança automática recorrente).
export const CHECKOUT_BILLING_TYPES = ['CREDIT_CARD'] as const
export const CHECKOUT_EXPIRES_MIN = 60

export function getPlan(planId: string): Plan | null {
  return PLANS[planId as PlanId] ?? null
}

/** URL pública do app (para as URLs de retorno do checkout). */
export function appPublicUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fitsync.app.br'
}

/** Base da API conforme o ambiente. Sandbox por padrão até a chave de produção entrar. */
export function asaasBaseUrl(): string {
  const env = (process.env.ASAAS_ENV ?? 'sandbox').toLowerCase()
  return env === 'production' || env === 'prod'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3'
}

/** Quando true, exige assinatura ativa para usar o app. Desligado por padrão. */
export const SUBSCRIPTION_ENFORCED = process.env.SUBSCRIPTION_ENFORCED === 'true'

/** Status que liberam o acesso ao app. */
export const ACTIVE_STATUSES = ['TRIALING', 'ACTIVE'] as const
export type SubscriptionStatus =
  | 'PENDING'    // criada, aguardando 1º pagamento/confirmação
  | 'TRIALING'   // dentro do período de teste
  | 'ACTIVE'     // pagamento confirmado
  | 'PAST_DUE'   // cobrança vencida
  | 'CANCELED'   // cancelada
  | 'EXPIRED'    // expirada
