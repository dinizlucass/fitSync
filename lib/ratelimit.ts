/**
 * Rate limit distribuído (Redis/Upstash) — protege o custo de OpenAI.
 *
 * Por que Upstash e não um Redis local: o app roda na Vercel (serverless),
 * onde não existe processo persistente pra hospedar um redis-server. O Upstash
 * é Redis servless via HTTP/REST — a mesma proteção, compatível com funções
 * efêmeras. Basta configurar UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.
 *
 * Filosofia FAIL-OPEN: se o Redis não estiver configurado ou ficar indisponível,
 * as chamadas passam (o app nunca quebra por causa do limitador). O limite só
 * fica ATIVO depois que as env vars do Upstash existirem — no dev e na Vercel.
 *
 * Cada "bucket" pode ter mais de uma janela (ex.: rajada + teto diário); a
 * requisição é bloqueada se QUALQUER janela estourar.
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { Duration } from '@upstash/ratelimit'

interface Window {
  tokens: number
  window: Duration
}

interface BucketDef {
  limits: Window[]
  message: string
}

/**
 * Orçamento por usuário. Números dimensionados para não atrapalhar uso legítimo
 * e barrar spam/loop antes de gastar créditos.
 */
const BUCKETS = {
  // Geração de treino: dispara 1 + N chamadas gpt-4o. Ação rara — bucket próprio
  // pra não competir com a dieta (usuário pode montar treino E dieta no mesmo dia).
  'ai:generate:treino': {
    limits: [
      { tokens: 3, window: '10 m' },
      { tokens: 12, window: '1 d' },
    ],
    message: 'Você gerou muitos treinos em pouco tempo. Espere alguns minutos e tente de novo. 💪',
  },
  // Geração de dieta (gpt-4o): bucket separado do treino.
  'ai:generate:dieta': {
    limits: [
      { tokens: 3, window: '10 m' },
      { tokens: 12, window: '1 d' },
    ],
    message: 'Você gerou muitos cardápios em pouco tempo. Espere alguns minutos e tente de novo. 🥗',
  },
  // Ajustes pontuais (gpt-4o-mini): baratos, mas ainda assim limitados.
  'ai:refine': {
    limits: [{ tokens: 20, window: '1 h' }],
    message: 'Muitos ajustes seguidos 😅 Dá um instante e tenta de novo.',
  },
  // Insight semanal (gpt-4o) disparado ao abrir a tela de progresso.
  'ai:insight': {
    limits: [{ tokens: 20, window: '1 h' }],
    message: 'Sua análise foi atualizada há pouco. Tente novamente em instantes.',
  },
  // Coach conversacional — camada extra sobre o limite por banco (defesa em
  // profundidade e mais precisa contra rajada).
  'ai:coach': {
    limits: [
      { tokens: 8, window: '1 m' },
      { tokens: 80, window: '1 d' },
    ],
    message: 'Opa, muitas mensagens de uma vez 😄 Me dá um minutinho e manda de novo.',
  },
  // Geração de código de vínculo do WhatsApp (por usuário).
  'phone:generate': {
    limits: [{ tokens: 5, window: '10 m' }],
    message: 'Muitos códigos gerados. Aguarde alguns minutos e tente de novo.',
  },
  // Tentativas de ENVIAR um código FIT-XXXXXX ao bot (por número remetente) —
  // barra força-bruta pra sequestrar o vínculo de outra conta.
  'phone:attempt': {
    limits: [{ tokens: 5, window: '10 m' }],
    message: 'Muitas tentativas de código. Aguarde alguns minutos e tente de novo.',
  },
  // Criação de checkout no Asaas (por usuário) — evita lixo PENDING e abuso da API.
  'checkout': {
    limits: [{ tokens: 5, window: '10 m' }],
    message: 'Muitas tentativas de assinatura em sequência. Aguarde um instante e tente de novo.',
  },
  // Escudo global por IP em rotas sensíveis (login, /api não-webhook) — anti-flood.
  'ip:sensitive': {
    limits: [{ tokens: 100, window: '1 m' }],
    message: 'Muitas requisições. Aguarde um instante.',
  },
  // Envio de lead do quiz (por IP) — /quiz é público e recebe tráfego pago; barra
  // spam/bot antes de gravar lead e disparar evento de conversão.
  'quiz:lead': {
    limits: [
      { tokens: 5, window: '10 m' },
      { tokens: 30, window: '1 d' },
    ],
    message: 'Muitos envios em pouco tempo. Aguarde alguns minutos e tente de novo.',
  },
} satisfies Record<string, BucketDef>

export type RateLimitBucket = keyof typeof BUCKETS

export interface RateLimitResult {
  allowed: boolean
  message?: string
  retryAfterSec?: number
}

let _redis: Redis | null | undefined
let _warned = false

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    if (!_warned) {
      console.warn(
        '[ratelimit] Upstash não configurado (UPSTASH_REDIS_REST_URL/TOKEN ausentes) — ' +
          'limite de IA DESATIVADO. Configure as env vars para proteger seus créditos.'
      )
      _warned = true
    }
    _redis = null
    return null
  }
  _redis = new Redis({ url, token })
  return _redis
}

const _limiters = new Map<RateLimitBucket, Ratelimit[]>()

function getLimiters(bucket: RateLimitBucket): Ratelimit[] | null {
  const redis = getRedis()
  if (!redis) return null

  const cached = _limiters.get(bucket)
  if (cached) return cached

  const instances = BUCKETS[bucket].limits.map(
    (l, i) =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(l.tokens, l.window),
        prefix: `fitsync:rl:${bucket}:${i}`,
        analytics: false,
      })
  )
  _limiters.set(bucket, instances)
  return instances
}

/**
 * Consome 1 token do usuário no bucket. Retorna { allowed:false, message } quando
 * qualquer janela do bucket estourou. Fail-open se o Redis não estiver disponível.
 *
 * @param bucket    orçamento a aplicar
 * @param identifier chave estável por usuário (ex.: dbUser.id ou supabase user.id)
 */
export async function enforceRateLimit(
  bucket: RateLimitBucket,
  identifier: string
): Promise<RateLimitResult> {
  const limiters = getLimiters(bucket)
  if (!limiters) return { allowed: true } // Redis não configurado → não bloqueia

  try {
    for (const limiter of limiters) {
      const res = await limiter.limit(identifier)
      if (!res.success) {
        return {
          allowed: false,
          message: BUCKETS[bucket].message,
          retryAfterSec: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
        }
      }
    }
    return { allowed: true }
  } catch (e) {
    // Redis indisponível/instável NÃO pode derrubar a funcionalidade.
    console.error('[ratelimit] falha ao consultar Redis, liberando request:', e)
    return { allowed: true }
  }
}

// ─── Idempotência (dedupe de webhooks) ──────────────────────────────────────

/**
 * Marca (namespace,id) como visto de forma atômica. Retorna `true` na PRIMEIRA
 * vez (deve processar) e `false` se já foi visto (duplicata → ignore).
 *
 * Fail-open: sem Redis, retorna sempre `true` (processa) — mesmo comportamento
 * de hoje. Use com `release()` no catch pra permitir reprocessar em caso de erro.
 */
export async function once(namespace: string, id: string, ttlSeconds = 86_400): Promise<boolean> {
  const redis = getRedis()
  if (!redis) return true
  try {
    const res = await redis.set(`fitsync:once:${namespace}:${id}`, '1', { nx: true, ex: ttlSeconds })
    return res === 'OK' // 'OK' = gravou agora (1ª vez); null = já existia
  } catch (e) {
    console.error('[idempotency] falha no Redis, processando mesmo assim:', e)
    return true
  }
}

/** Desfaz a marca de `once()` — chame no catch pra liberar reentrega após falha. */
export async function release(namespace: string, id: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(`fitsync:once:${namespace}:${id}`)
  } catch {
    // best-effort; se falhar, a chave expira pelo TTL
  }
}
