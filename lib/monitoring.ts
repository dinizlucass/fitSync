/**
 * Monitoramento de erros do FitSync.
 *
 * Sempre loga estruturado no console (visível em Vercel → Logs) e, se
 * MONITORING_WEBHOOK_URL estiver configurada, envia alerta em tempo real
 * (formato compatível com webhook do Discord; Slack aceita via "content" também).
 *
 * Nunca lança — monitoramento não pode derrubar o fluxo que está monitorando.
 */

export async function reportError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  // 1. Log estruturado (Vercel Logs)
  console.error(`[FitSync:${context}]`, message, extra ?? '', stack ?? '')

  // 2. Alerta em tempo real (opcional)
  const webhookUrl = process.env.MONITORING_WEBHOOK_URL
  if (!webhookUrl) return

  const when = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date())

  const extraText = extra ? `\n\`\`\`json\n${JSON.stringify(extra).slice(0, 400)}\n\`\`\`` : ''
  const content = `🚨 **[${context}]** ${when}\n${message.slice(0, 1200)}${extraText}`.slice(0, 1900)

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    // alerta falhou — o console.error acima já registrou o erro original
  }
}
