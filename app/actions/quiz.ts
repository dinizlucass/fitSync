'use server'

import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit } from '@/lib/ratelimit'
import { sendCapiEvent } from '@/lib/analytics/capi'
import { reportError } from '@/lib/monitoring'
import { buildResult, type QuizAnswers, type QuizResult } from '@/lib/quiz/config'

export interface QuizUtms {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  fbclid?: string
}

/** Normaliza o WhatsApp para dígitos com DDI 55 (Brasil) quando ausente. */
function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.length <= 11) d = '55' + d // sem DDI → assume Brasil
  return d
}

/**
 * Recebe o lead do quiz (nome + WhatsApp + respostas), grava, dispara o evento
 * de conversão (Lead) e devolve o resultado personalizado. Protegido por
 * rate-limit por IP (o /quiz é público e recebe tráfego pago).
 */
export async function submitQuizLead(params: {
  name: string
  whatsapp: string
  answers: QuizAnswers
  utms?: QuizUtms
  /** id do evento gerado no client, para deduplicar o Lead (Pixel + CAPI). */
  eventId?: string
}): Promise<{ result?: QuizResult; error?: string }> {
  const name = params.name?.trim()
  const phoneDigits = (params.whatsapp ?? '').replace(/\D/g, '')

  if (!name || name.length < 2) return { error: 'Informe seu nome.' }
  if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    return { error: 'Informe um WhatsApp válido com DDD.' }
  }

  // Rate-limit por IP — barra spam/bot antes de gravar e disparar conversão.
  const h = await headers()
  const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim()
  const rl = await enforceRateLimit('quiz:lead', ip)
  if (!rl.allowed) return { error: rl.message }

  const whatsapp = normalizePhone(params.whatsapp)
  const objective = typeof params.answers.objective === 'string' ? params.answers.objective : null

  // Grava o lead (best-effort: se a tabela ainda não existe, não derruba o fluxo).
  let leadId: string | null = null
  try {
    const lead = await prisma.quizLead.create({
      data: {
        name,
        whatsapp,
        objective,
        answers: params.answers as object,
        utmSource: params.utms?.utmSource ?? null,
        utmMedium: params.utms?.utmMedium ?? null,
        utmCampaign: params.utms?.utmCampaign ?? null,
        utmContent: params.utms?.utmContent ?? null,
        utmTerm: params.utms?.utmTerm ?? null,
        fbclid: params.utms?.fbclid ?? null,
      },
    })
    leadId = lead.id
  } catch (e) {
    reportError('quiz:saveLead', e, { objective })
    // segue mesmo assim — não vamos perder a conversão por falha de gravação
  }

  // Conversão: Lead server-side (CAPI). Usa o mesmo eventId do client → Meta dedup.
  void sendCapiEvent({
    eventName: 'Lead',
    phone: whatsapp,
    eventId: params.eventId ?? (leadId ? `lead:${leadId}` : `lead:${ip}:${Date.now()}`),
  })

  return { result: buildResult(name, params.answers) }
}
