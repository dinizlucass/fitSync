/**
 * Cliente HTTP do Asaas. Autenticação via header `access_token`.
 * Lazy: só lê a env quando chamado (a chave entra depois).
 */
import { asaasBaseUrl } from '@/lib/asaas/config'

export interface AsaasCustomer {
  id: string
  name: string
  email?: string
  cpfCnpj?: string
}

export interface AsaasSubscription {
  id: string
  customer: string
  value: number
  cycle: string
  status: string
  billingType: string
  nextDueDate: string
}

export interface AsaasPayment {
  id: string
  subscription?: string
  customer: string
  status: string
  value: number
  dueDate: string
  invoiceUrl?: string
  billingType: string
}

interface AsaasList<T> {
  data: T[]
  hasMore: boolean
  totalCount: number
}

function apiKey(): string {
  const key = process.env.ASAAS_API_KEY
  if (!key) throw new Error('ASAAS_API_KEY não configurada')
  return key
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${asaasBaseUrl()}${path}`, {
    ...init,
    headers: {
      access_token: apiKey(),
      'Content-Type': 'application/json',
      // Asaas recomenda um User-Agent identificável
      'User-Agent': 'FitSync/1.0',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })

  const text = await res.text()
  const body = text ? JSON.parse(text) : {}

  if (!res.ok) {
    const msg = body?.errors?.[0]?.description ?? `Asaas erro ${res.status}`
    throw new Error(msg)
  }
  return body as T
}

// ─── Clientes ────────────────────────────────────────────────────────────

export interface CreateCustomerInput {
  name: string
  cpfCnpj: string
  email?: string
  mobilePhone?: string
  externalReference?: string
}

export function createAsaasCustomer(input: CreateCustomerInput): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getAsaasCustomer(id: string): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>(`/customers/${id}`)
}

// ─── Assinaturas (cobrança recorrente) ──────────────────────────────────

export interface CreateSubscriptionInput {
  customer: string
  billingType: string
  value: number
  nextDueDate: string      // yyyy-MM-dd
  cycle: string
  description?: string
  externalReference?: string
}

export function createAsaasSubscription(input: CreateSubscriptionInput): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getAsaasSubscription(id: string): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>(`/subscriptions/${id}`)
}

/** Pagamentos gerados por uma assinatura — o 1º traz o invoiceUrl (checkout hospedado). */
export function getSubscriptionPayments(subscriptionId: string): Promise<AsaasList<AsaasPayment>> {
  return asaasFetch<AsaasList<AsaasPayment>>(`/subscriptions/${subscriptionId}/payments`)
}

export function cancelAsaasSubscription(id: string): Promise<{ deleted: boolean; id: string }> {
  return asaasFetch<{ deleted: boolean; id: string }>(`/subscriptions/${id}`, {
    method: 'DELETE',
  })
}

// ─── Checkout hospedado (cartão + assinatura + trial) ───────────────────

export interface CreateCheckoutInput {
  billingTypes: readonly string[]        // ['CREDIT_CARD']
  chargeTypes: readonly string[]         // ['RECURRENT']
  minutesToExpire: number
  externalReference: string              // = userId (amarra o webhook de volta)
  callback: { successUrl: string; cancelUrl: string; expiredUrl?: string }
  items: Array<{ name: string; quantity: number; value: number; description?: string }>
  subscription: { cycle: string; nextDueDate: string; endDate?: string }
}

export interface AsaasCheckout {
  id: string
  link: string
  status: string
}

export function createAsaasCheckout(input: CreateCheckoutInput): Promise<AsaasCheckout> {
  return asaasFetch<AsaasCheckout>('/checkouts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
