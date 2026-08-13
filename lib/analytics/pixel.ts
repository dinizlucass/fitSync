/**
 * Meta (Facebook) Pixel — disparo de eventos padrão pelo client.
 * No-op se o Pixel não estiver carregado (sem NEXT_PUBLIC_META_PIXEL_ID).
 */
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

export type PixelEvent =
  | 'PageView'
  | 'CompleteRegistration'
  | 'InitiateCheckout'
  | 'StartTrial'
  | 'Subscribe'
  | 'Lead'

/** Dispara um evento padrão do Meta Pixel (seguro no server: vira no-op). */
export function trackPixel(event: PixelEvent, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  window.fbq?.('track', event, params)
}
