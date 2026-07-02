/**
 * Rate limit do coach — protege o custo de OpenAI contra spam/loop.
 *
 * Dimensionamento (uso real de um usuário pesado num dia):
 *   ~6 refeições × 2 msgs (registro + correção)  ≈ 12
 *   treino (registro + dúvidas)                  ≈ 5
 *   planejamento/perguntas ao coach              ≈ 20
 *   folga                                        ≈ 20+
 * → limite diário de 60 mensagens cobre qualquer uso legítimo.
 * Rajada: 8 msgs/minuto barra loops e flood sem atrapalhar conversa normal.
 *
 * Conta somente mensagens ACEITAS (persistidas em chat_messages). Mensagens
 * bloqueadas não chamam a OpenAI — o custo fica protegido pelo teto diário.
 */
import { prisma } from '@/lib/prisma'
import { dayRange } from '@/lib/coach/shared'

const DAILY_LIMIT = parseInt(process.env.COACH_DAILY_MSG_LIMIT ?? '60', 10)
const BURST_LIMIT = parseInt(process.env.COACH_BURST_MSG_LIMIT ?? '8', 10)

export interface RateLimitResult {
  allowed: boolean
  reason?: 'daily' | 'burst'
  message?: string
}

export async function checkCoachRateLimit(userId: string): Promise<RateLimitResult> {
  try {
    const { start, end } = dayRange()
    const oneMinuteAgo = new Date(Date.now() - 60_000)

    const [todayCount, burstCount] = await Promise.all([
      prisma.chatMessage.count({
        where: { userId, role: 'user', createdAt: { gte: start, lte: end } },
      }),
      prisma.chatMessage.count({
        where: { userId, role: 'user', createdAt: { gte: oneMinuteAgo } },
      }),
    ])

    if (todayCount >= DAILY_LIMIT) {
      return {
        allowed: false,
        reason: 'daily',
        message:
          `Você chegou ao limite de ${DAILY_LIMIT} mensagens do coach por hoje. ` +
          'Amanhã a gente continua! Enquanto isso, dá pra registrar tudo direto no app. 💪',
      }
    }

    if (burstCount >= BURST_LIMIT) {
      return {
        allowed: false,
        reason: 'burst',
        message: 'Opa, muitas mensagens de uma vez 😄 Me dá um minutinho e manda de novo.',
      }
    }

    return { allowed: true }
  } catch {
    // Tabela chat_messages indisponível → não bloqueia o usuário
    return { allowed: true }
  }
}
