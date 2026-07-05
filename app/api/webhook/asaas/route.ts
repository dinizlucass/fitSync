import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { reportError } from '@/lib/monitoring'

/**
 * Webhook do Asaas para eventos de cobrança.
 * Autenticação: o Asaas envia o header `asaas-access-token` igual ao token que
 * você define ao cadastrar o webhook no painel. Validamos contra ASAAS_WEBHOOK_TOKEN.
 *
 * Como o checkout hospedado cria a assinatura/cliente do lado do Asaas, amarramos
 * de volta pelo externalReference (= userId), que o Asaas propaga do checkout para
 * a assinatura e para os pagamentos.
 */

// Evento do Asaas → status da nossa assinatura (null = sem mudança determinística)
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
      return null
  }
}

export async function POST(request: NextRequest) {
  // Validação do token — fail-closed: sem ASAAS_WEBHOOK_TOKEN configurado, recusa tudo.
  const expected = process.env.ASAAS_WEBHOOK_TOKEN
  const received = request.headers.get('asaas-access-token')
  if (!expected || received !== expected) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  let body: {
    event?: string
    payment?: {
      id: string
      subscription?: string
      customer?: string
      externalReference?: string
      status?: string
      dueDate?: string
      invoiceUrl?: string
    }
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = body.event
  const payment = body.payment
  if (!event || !payment) return Response.json({ status: 'ignored' })

  // Só interessam cobranças ligadas a uma assinatura
  if (!payment.subscription) return Response.json({ status: 'no_subscription' })

  // Localiza nosso registro: por assinatura já vinculada OU pelo externalReference (userId)
  const sub = await prisma.subscription.findFirst({
    where: {
      OR: [
        { asaasSubscriptionId: payment.subscription },
        ...(payment.externalReference ? [{ userId: payment.externalReference }] : []),
      ],
    },
  }).catch(() => null)

  if (!sub) return Response.json({ status: 'subscription_not_found' })

  // PAYMENT_CREATED numa assinatura ainda PENDENTE = checkout concluído, cartão salvo,
  // trial começou → TRIALING. Depois, o pagamento confirmado sobe para ACTIVE.
  let newStatus = statusForEvent(event)
  if (!newStatus && event === 'PAYMENT_CREATED' && sub.status === 'PENDING') {
    newStatus = 'TRIALING'
  }

  try {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        ...(newStatus ? { status: newStatus } : {}),
        lastEvent: event,
        // Vincula os ids do Asaas na primeira vez que os recebemos
        ...(sub.asaasSubscriptionId ? {} : { asaasSubscriptionId: payment.subscription }),
        ...(sub.asaasCustomerId || !payment.customer ? {} : { asaasCustomerId: payment.customer }),
        ...(payment.dueDate ? { currentDueDate: new Date(payment.dueDate + 'T12:00:00') } : {}),
        ...(payment.invoiceUrl ? { checkoutUrl: payment.invoiceUrl } : {}),
      },
    })
  } catch (e) {
    reportError('asaas:webhook', e, { event, subscription: payment.subscription })
    return Response.json({ status: 'error' }, { status: 500 })
  }

  return Response.json({ status: 'ok' })
}
