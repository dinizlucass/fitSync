/** Respostas de confirmação baseadas somente no resultado persistido da tool. */
export function verifiedToolReply(name: string, rawResult: string, userMessage = ''): string | null {
  let result: Record<string, unknown>
  try {
    result = JSON.parse(rawResult) as Record<string, unknown>
  } catch {
    return null
  }

  if (name === 'salvar_treino_personalizado' && result.sucesso === true && typeof result.nome === 'string') {
    const exercises = Array.isArray(result.exercicios) ? result.exercicios : []
    const details = exercises.map(ex => {
      if (!ex || typeof ex.nome !== 'string') return null
      const series = Number(ex.series)
      const reps = Number(ex.repeticoes)
      return `• ${ex.nome}${Number.isFinite(series) && Number.isFinite(reps) ? ` — ${series}x${reps}` : ''}`
    }).filter(Boolean).join('\n')
    return `*${result.nome}* ${result.ja_existia ? 'já estava salvo' : 'salvo'} no app.${details ? `\n\n${details}` : ''}\n\nDisponível na aba Treino; não há agendamento automático para amanhã.`
  }

  if (name === 'registrar_treino' && result.sucesso === true) {
    if (result.ja_registrado) return 'Esse treino já consta como concluído hoje. Não dupliquei o registro.'
    const details = Array.isArray(result.exercicios_registrados) ? result.exercicios_registrados.join(', ') : ''
    return `Registrei *${String(result.treino ?? 'seu treino')}* hoje${details ? `: ${details}` : '.'}`
  }

  if (name === 'get_treino_do_dia' && Array.isArray(result.treinos_concluidos_hoje)) {
    const next = result.proximo_treino as { nome?: string; exercicios?: Array<{ nome?: string; series?: number; reps?: number }> } | null
    const exercises = next && Array.isArray(next.exercicios) ? next.exercicios.map(ex =>
      typeof ex.nome === 'string' ? `• ${ex.nome}${ex.series && ex.reps ? ` — ${ex.series}x${ex.reps}` : ''}` : null
    ).filter(Boolean).join('\n') : ''
    if (/amanh[ãa]|pr[oó]xim/i.test(userMessage)) {
      if (!next?.nome) return 'Você já treinou hoje. Não encontrei outro treino do programa para sugerir amanhã.'
      return `Não há treino agendado para amanhã. O próximo sugerido pelo programa é *${next.nome}*${exercises ? `:\n${exercises}` : '.'}`
    }
    if (result.treinos_concluidos_hoje.length) {
      const completed = result.treinos_concluidos_hoje.map(session => {
        if (!session || typeof session.nome !== 'string') return null
        const done = Array.isArray(session.exercicios) ? session.exercicios.filter((ex: unknown) => typeof ex === 'string').join(', ') : ''
        return `*${session.nome}*${done ? ` — ${done}` : ''}`
      }).filter(Boolean).join('; ')
      return completed ? `Hoje você já registrou: ${completed}.` : null
    }
    if (next?.nome) return `Seu próximo treino sugerido é *${next.nome}*${exercises ? `:\n${exercises}` : '.'}`
    return 'Não encontrei um plano de treino cadastrado. Você pode gerar um na aba IA → Treino.'
  }

  return null
}
