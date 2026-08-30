/**
 * Tracking unificado do funil (client). Um único `track()` dispara o evento
 * para o PostHog (nome snake_case) e, quando existe equivalente, o evento padrão
 * do Meta Pixel. Seguro no server (vira no-op).
 */
declare global {
  interface Window {
    posthog?: {
      capture?: (event: string, props?: Record<string, unknown>) => void
      identify?: (id: string, props?: Record<string, unknown>) => void
      reset?: () => void
    }
  }
}

export type FunnelEvent =
  | 'clicked_cta'
  | 'started_signup'
  | 'completed_registration'
  | 'linked_whatsapp'
  | 'initiated_checkout'
  | 'started_trial'
  | 'subscribed'
  | 'quiz_started'
  | 'quiz_answered'
  | 'quiz_lead'
  | 'quiz_completed'

// Eventos do funil → evento padrão do Meta Pixel (os demais vão só pro PostHog)
const PIXEL_MAP: Partial<Record<FunnelEvent, string>> = {
  completed_registration: 'CompleteRegistration',
  initiated_checkout: 'InitiateCheckout',
  started_trial: 'StartTrial',
  subscribed: 'Subscribe',
  quiz_lead: 'Lead',
}

/**
 * Dispara um evento de funil no PostHog e (quando aplicável) no Meta Pixel.
 * `opts.eventId` é repassado ao Pixel como `eventID` — use o MESMO id no evento
 * server-side (CAPI) para o Meta deduplicar e não contar a conversão duas vezes.
 */
export function track(
  event: FunnelEvent,
  props?: Record<string, unknown>,
  opts?: { eventId?: string },
): void {
  if (typeof window === 'undefined') return
  try { window.posthog?.capture?.(event, props) } catch { /* fail-open */ }
  const pixelEvent = PIXEL_MAP[event]
  if (pixelEvent) {
    try {
      window.fbq?.('track', pixelEvent, props, opts?.eventId ? { eventID: opts.eventId } : undefined)
    } catch { /* fail-open */ }
  }
}

/** Associa os eventos seguintes a um usuário identificado no PostHog. */
export function identifyUser(id: string, props?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  try { window.posthog?.identify?.(id, props) } catch { /* fail-open */ }
}
