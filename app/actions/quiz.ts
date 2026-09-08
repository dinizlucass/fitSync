'use server'

import { headers } from 'next/headers'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit } from '@/lib/ratelimit'
import { sendCapiEvent } from '@/lib/analytics/capi'
import { reportError } from '@/lib/monitoring'
import { buildResult, type QuizAnswers, type QuizResult } from '@/lib/quiz/config'
import { quizLeadSchema, validateQuizAnswers } from '@/lib/quiz/validation'

export interface QuizUtms {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  fbclid?: string
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
}): Promise<{ result?: QuizResult; saved?: boolean; error?: string }> {
  const parsed = quizLeadSchema.safeParse(params)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Confira os dados informados.' }
  const checked = validateQuizAnswers(parsed.data.answers)
  if (!checked.answers) return { error: checked.error }
  const { name } = parsed.data
  const answers = checked.answers

  // Rate-limit por IP — barra spam/bot antes de gravar e disparar conversão.
  const h = await headers()
  const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim()
  const rl = await enforceRateLimit('quiz:lead', ip)
  if (!rl.allowed) return { error: rl.message }

  const whatsapp = parsed.data.whatsapp!
  const objective = answers.objective as string

  // Grava o lead (best-effort: se a tabela ainda não existe, não derruba o fluxo).
  let leadId: string | null = null
  try {
    const lead = await prisma.quizLead.create({
      data: {
        name,
        whatsapp,
        objective,
        answers: answers as object,
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
    // A prévia continua disponível, mas não contabilizamos um lead não salvo.
  }

  // Conversão: Lead server-side (CAPI). Usa o mesmo eventId do client → Meta dedup.
  if (leadId) after(() => sendCapiEvent({
    eventName: 'Lead',
    phone: whatsapp,
    eventId: params.eventId ?? `lead:${leadId}`,
  }))

  return { result: buildResult(name, answers), saved: Boolean(leadId) }
}
