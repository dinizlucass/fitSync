import { z } from 'zod'
import { QUESTIONS, type QuizAnswers } from './config'

/** The public action must validate runtime input, not only TypeScript types. */
export function validateQuizAnswers(input: unknown): { answers?: QuizAnswers; error?: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Responda às perguntas do quiz.' }
  const raw = input as Record<string, unknown>
  const answers: QuizAnswers = {}
  for (const question of QUESTIONS) {
    if (question.skipIf?.(answers)) continue
    const value = raw[question.id]
    const allowed = question.options?.map(option => option.value) ?? []
    let valid = false
    if (question.type === 'number' && typeof value === 'string' && /^\d+(?:[.,]\d+)?$/.test(value.trim())) {
      const number = Number(value.replace(',', '.'))
      valid = Number.isFinite(number) && number >= (question.min ?? -Infinity) && number <= (question.max ?? Infinity)
      if (valid) answers[question.id] = String(number)
    } else if (question.type === 'single' && typeof value === 'string') {
      valid = allowed.includes(value)
      if (valid) answers[question.id] = value
    } else if (question.type === 'multi' && Array.isArray(value)) {
      valid = value.length > 0 && value.length <= allowed.length && value.every(v => typeof v === 'string' && allowed.includes(v))
        && new Set(value).size === value.length && !(value.includes('nenhuma') && value.length > 1)
      if (valid) answers[question.id] = value as string[]
    }
    if (!valid) return { error: `Confira sua resposta: ${question.title}` }
  }
  return { answers }
}

export function normalizeQuizPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  const national = digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits
  // Brazilian mobile number: DDD + 9 + eight digits.
  if (!/^[1-9][1-9]9\d{8}$/.test(national) || /^(\d)\1{8}$/.test(national.slice(2))) return null
  return `55${national}`
}

export const quizLeadSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(100),
  whatsapp: z.string().max(30).transform(normalizeQuizPhone).refine(Boolean, 'Informe um WhatsApp válido com DDD.'),
  answers: z.unknown(),
  utms: z.object({
    utmSource: z.string().max(500).optional(), utmMedium: z.string().max(500).optional(),
    utmCampaign: z.string().max(500).optional(), utmContent: z.string().max(500).optional(),
    utmTerm: z.string().max(500).optional(), fbclid: z.string().max(500).optional(),
  }).optional(),
  eventId: z.string().max(100).optional(),
})
