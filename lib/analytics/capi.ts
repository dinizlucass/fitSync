/**
 * Meta Conversions API (CAPI) — envio de eventos server-side.
 *
 * Por que server-side: eventos de conversão que acontecem no servidor (pagamento
 * confirmado, início de trial) não passam pelo navegador, então o Pixel do client
 * não os captura. Sem isso, o algoritmo do anúncio não otimiza para quem paga.
 *
 * Env-gated e fail-open: sem META_CAPI_ACCESS_TOKEN, é no-op. Nunca derruba o
 * fluxo de negócio por causa de tracking.
 */
import crypto from 'crypto'
import { reportError } from '@/lib/monitoring'

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '1659563822223017'
const TOKEN = process.env.META_CAPI_ACCESS_TOKEN
const API_VERSION = process.env.META_CAPI_API_VERSION ?? 'v19.0'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fitsync.app.br'

export type CapiEvent =
  | 'CompleteRegistration'
  | 'InitiateCheckout'
  | 'StartTrial'
  | 'Subscribe'
  | 'Purchase'
  | 'Lead'

/** Hash SHA-256 (normalizado) exigido pelo CAPI para dados pessoais. */
function sha256(value?: string | null): string | undefined {
  if (!value) return undefined
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

export interface CapiParams {
  eventName: CapiEvent
  /** Mesmo id do evento do Pixel client, quando houver, para deduplicação. */
  eventId?: string
  email?: string | null
  clientIp?: string | null
  userAgent?: string | null
  /** Cookies do navegador (_fbp / _fbc) melhoram o match, quando disponíveis. */
  fbp?: string | null
  fbc?: string | null
  value?: number
  currency?: string
  eventSourceUrl?: string
}

/** Envia um evento para a Conversions API do Meta. No-op sem token configurado. */
export async function sendCapiEvent(params: CapiParams): Promise<void> {
  if (!TOKEN || !PIXEL_ID) return // env-gated

  try {
    const user_data: Record<string, unknown> = {}
    const em = sha256(params.email)
    if (em) user_data.em = [em]
    if (params.clientIp) user_data.client_ip_address = params.clientIp
    if (params.userAgent) user_data.client_user_agent = params.userAgent
    if (params.fbp) user_data.fbp = params.fbp
    if (params.fbc) user_data.fbc = params.fbc

    const custom_data: Record<string, unknown> = {}
    if (typeof params.value === 'number') {
      custom_data.value = params.value
      custom_data.currency = params.currency ?? 'BRL'
    }

    const payload = {
      data: [
        {
          event_name: params.eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          event_source_url: params.eventSourceUrl ?? APP_URL,
          ...(params.eventId ? { event_id: params.eventId } : {}),
          user_data,
          ...(Object.keys(custom_data).length ? { custom_data } : {}),
        },
      ],
    }

    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      reportError('capi:send', new Error(`CAPI ${res.status}: ${detail.slice(0, 300)}`), {
        event: params.eventName,
      })
    }
  } catch (e) {
    reportError('capi:send', e, { event: params.eventName })
    // fail-open: tracking nunca interrompe o fluxo
  }
}
