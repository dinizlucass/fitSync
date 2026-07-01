import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Webhook do Asaas para eventos de cobrança.
 * Autenticação: o Asaas envia o header `asaas-access-token` igual ao token que
 * você define ao cadastrar o webhook no painel. Validamos contra ASAAS_WEBHOOK_TOKEN.
 */

// Evento do Asaas → status da nossa assinatura
function statusForEvent(event: string): string | null {
  switch (event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_RECEIVED_IN_CASH':
      return 'ACTIVE'
    case 'PAYMENT_OVERDUE':
    case 'PAYMENT_DUNNING_REQUESTED':
      return 'PAST_DUE'
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_CHARGEBACK_REQUESTED':
    case 'PAYMENT_DELETED':
      return 'CANCELED'
    default:
      return null // PAYMENT_CREATED / PAYMENT_UPDATED etc. — sem mudança de status
  }
}

export async function POST(request: NextRequest) {
  // Validação do token (quando configurado)
  const expected = process.env.ASAAS_WEBHOOK_TOKEN
  const received = request.headers.get('asaas-access-token')
  if (expected && received !== expected) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  let body: {
    event?: string
    payment?: { id: string; subscription?: string; status?: string; dueDate?: string; invoiceUrl?: string }
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = body.event
  const payment = body.payment
  if (!event || !payment) {
    return Response.json({ status: 'ignored' })
  }

  // Só nos interessam cobranças ligadas a uma assinatura
  if (!payment.subscription) {
    return Response.json({ status: 'no_subscription' })
  }

  const sub = await prisma.subscription.findUnique({
    where: { asaasSubscriptionId: payment.subscription },
  }).catch(() => null)

  if (!sub) {
    return Response.json({ status: 'subscription_not_found' })
  }

  const newStatus = statusForEvent(event)

  try {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        ...(newStatus ? { status: newStatus } : {}),
        lastEvent: event,
        ...(payment.dueDate ? { currentDueDate: new Date(payment.dueDate + 'T12:00:00') } : {}),
        ...(payment.invoiceUrl ? { checkoutUrl: payment.invoiceUrl } : {}),
      },
    })
  } catch (e) {
    console.error('Asaas webhook update error:', e)
    return Response.json({ status: 'error' }, { status: 500 })
  }

  return Response.json({ status: 'ok' })
}
