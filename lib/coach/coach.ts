/**
 * Coach Sync — loop de function calling.
 * Carrega contexto + memória, deixa a LLM raciocinar e chamar tools, executa,
 * gera a resposta final (estilo WhatsApp) e persiste o turno na memória.
 */
import type {
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import { getOpenAI } from '@/lib/openai'
import { prisma } from '@/lib/prisma'
import { COACH_SYSTEM_PROMPT } from '@/lib/coach/prompt'
import { buildUserContext, formatUserContext } from '@/lib/coach/context'
import { TOOL_DEFINITIONS, executeTool } from '@/lib/coach/tools'

const COACH_MODEL = 'gpt-4.1-mini'
const MAX_TOOL_ROUNDS = 3
const MEMORY_TURNS = 10 // últimas N mensagens (user+assistant) carregadas

export interface RunCoachParams {
  userId: string
  message: string
  channel?: 'whatsapp' | 'app'
}

export async function runCoach({ userId, message, channel = 'whatsapp' }: RunCoachParams): Promise<string> {
  // 1. Contexto (briefing do estado de hoje) + memória recente.
  // A memória é best-effort: se a tabela chat_messages ainda não existe
  // (migração não rodada), o coach segue funcionando, só sem histórico.
  const ctx = await buildUserContext(userId)
  const history = await prisma.chatMessage
    .findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: MEMORY_TURNS })
    .catch(() => [] as Array<{ role: string; content: string }>)

  const historyAsc = [...history].reverse()

  // Carimbo de data/hora (São Paulo) em cada mensagem do histórico.
  // Sem isso o modelo mistura registros de dias anteriores com "hoje".
  const stamp = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: COACH_SYSTEM_PROMPT },
    { role: 'system', content: formatUserContext(ctx) },
    ...historyAsc.map(m => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: `[${'createdAt' in m && m.createdAt ? stamp.format(m.createdAt as Date) : 'anterior'}] ${m.content}`,
    })),
    { role: 'user', content: message },
  ]

  // 2. Loop de function calling
  let finalText = ''
  const openai = getOpenAI()

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await openai.chat.completions.create({
      model: COACH_MODEL,
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
      temperature: 0.6,
    })

    const choice = completion.choices[0].message
    messages.push(choice)

    const toolCalls = choice.tool_calls ?? []
    if (toolCalls.length === 0) {
      finalText = choice.content ?? ''
      break
    }

    // Executa cada tool e devolve o resultado como tool message
    for (const call of toolCalls) {
      if (call.type !== 'function') continue
      let args: Record<string, unknown> = {}
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {}
      } catch {
        args = {}
      }
      const result = await executeTool(call.function.name, args, userId)
      messages.push({ role: 'tool', tool_call_id: call.id, content: result })
    }

    // Se foi a última rodada e ainda há tool calls, pede uma resposta final sem tools
    if (round === MAX_TOOL_ROUNDS - 1) {
      const wrap = await openai.chat.completions.create({
        model: COACH_MODEL,
        messages,
        temperature: 0.6,
      })
      finalText = wrap.choices[0].message.content ?? ''
    }
  }

  if (!finalText.trim()) {
    finalText = 'Deu um probleminha aqui pra processar isso. Manda de novo?'
  }

  // 3. Persiste o turno na memória (best-effort)
  try {
    await prisma.chatMessage.createMany({
      data: [
        { userId, role: 'user', content: message, channel },
        { userId, role: 'assistant', content: finalText, channel },
      ],
    })
  } catch (e) {
    console.error('Falha ao salvar memória do coach:', e)
  }

  return finalText
}
