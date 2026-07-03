/**
 * Tools (function calling) do coach Sync.
 * Cada tool faz UMA coisa e devolve JSON limpo. Leitura e ação consultam/escrevem
 * via Prisma. Nada de dados inventados — se algo falha, devolve { erro }.
 */
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { prisma } from '@/lib/prisma'
import { parseMealMessage } from '@/lib/openai'
import { buildUserContext } from '@/lib/coach/context'
import { dayRange, scaleMacros, round } from '@/lib/coach/shared'

type MealTypeEnum = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'PRE_WORKOUT' | 'POST_WORKOUT' | 'CEIA'

function mealNameToType(name: string): MealTypeEnum {
  const l = (name ?? '').toLowerCase()
  if (l.includes('café') || l.includes('cafe') || (l.includes('manhã') && !l.includes('lanche'))) return 'BREAKFAST'
  if (l.includes('almoç') || l.includes('almoc')) return 'LUNCH'
  if (l.includes('jantar') || l.includes('janta')) return 'DINNER'
  // "ceia" antes de pós-treino: é a refeição da noite, não lanche/café da tarde
  if (l.includes('ceia')) return 'CEIA'
  if (l.includes('pré-treino') || l.includes('pre-treino') || l.includes('pré treino') || l.includes('pre treino')) return 'PRE_WORKOUT'
  if (l.includes('pós-treino') || l.includes('pos-treino') || l.includes('pós treino') || l.includes('pos treino')) return 'POST_WORKOUT'
  return 'SNACK'
}

// Tabelas curadas para sugestão de alimentos (valores por 100g, exceto onde indicado)
const SUGGESTION_FOODS: Record<string, Array<{ nome: string; per100kcal: number; per100: number }>> = {
  proteina: [
    { nome: 'Peito de frango grelhado', per100kcal: 165, per100: 31 },
    { nome: 'Whey protein', per100kcal: 370, per100: 80 },
    { nome: 'Atum em lata (água)', per100kcal: 128, per100: 28 },
    { nome: 'Patinho/carne magra grelhada', per100kcal: 215, per100: 26 },
    { nome: 'Clara de ovo', per100kcal: 52, per100: 11 },
    { nome: 'Iogurte grego natural', per100kcal: 97, per100: 9 },
    { nome: 'Tilápia grelhada', per100kcal: 128, per100: 26 },
  ],
  carbo: [
    { nome: 'Arroz integral cozido', per100kcal: 123, per100: 25.6 },
    { nome: 'Batata doce cozida', per100kcal: 86, per100: 20 },
    { nome: 'Aveia em flocos', per100kcal: 380, per100: 67 },
    { nome: 'Banana', per100kcal: 89, per100: 22.8 },
    { nome: 'Macarrão cozido', per100kcal: 158, per100: 30.9 },
  ],
  gordura: [
    { nome: 'Azeite de oliva', per100kcal: 884, per100: 100 },
    { nome: 'Pasta de amendoim', per100kcal: 588, per100: 50 },
    { nome: 'Castanha do Pará', per100kcal: 656, per100: 67 },
    { nome: 'Abacate', per100kcal: 160, per100: 15 },
  ],
}

// ─── Schemas (formato tools da OpenAI) ──────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_resumo_nutricional_hoje',
      description:
        "Retorna o consumido vs. meta do dia e o que falta para bater as metas (kcal e macros). Use quando o usuário perguntar sobre dieta, proteína, calorias, 'o que falta', 'como bato minha meta'.",
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'Data ISO YYYY-MM-DD. Default: hoje (America/Sao_Paulo).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_treino_do_dia',
      description:
        "Retorna APENAS o treino ativo do usuário (nome, exercícios, séries, reps e status). NUNCA lista todos os treinos. Use para 'qual o treino de hoje', 'o que treino hoje'.",
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'Data ISO. Default: hoje.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_treinos_disponiveis',
      description:
        'Lista os planos de treino que o usuário tem cadastrados (nomes, grupos musculares e nº de exercícios). Use SOMENTE quando ele pedir explicitamente a lista de treinos disponíveis, não para "treino de hoje".',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sugerir_alimentos_para_meta',
      description:
        'Dado o macro que falta (ex: proteína), sugere opções de alimentos com a porção e o custo calórico para fechar a meta sem estourar. Use para dar planos concretos.',
      parameters: {
        type: 'object',
        properties: {
          macro_alvo: { type: 'string', enum: ['proteina', 'carbo', 'gordura', 'kcal'] },
          quantidade_faltante: { type: 'number', description: 'Quanto falta do macro (g) ou kcal.' },
          restricoes: {
            type: 'array',
            items: { type: 'string' },
            description: "Ex: ['vegetariano','sem lactose']. Opcional.",
          },
        },
        required: ['macro_alvo', 'quantidade_faltante'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_refeicao',
      description:
        'Registra uma refeição consumida (alimentos + quantidades). Use quando o usuário relatar o que comeu. Pode registrar direto, sem confirmar.',
      parameters: {
        type: 'object',
        properties: {
          refeicao: { type: 'string', description: 'Ex: café da manhã, almoço, lanche, jantar, ceia.' },
          itens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                alimento: { type: 'string' },
                quantidade: {
                  type: 'string',
                  description:
                    "A quantidade EXATAMENTE como o usuário disse: '2 fatias', '5 colheres', '2 unidades', '150g'. NUNCA converta unidades (fatias/colheres/unidades) em gramas — a conversão é feita depois.",
                },
                quantidade_g: {
                  type: 'number',
                  description: 'APENAS se o usuário informou o peso em gramas (ex: "200g"). Não use para unidades.',
                },
              },
              required: ['alimento'],
            },
          },
        },
        required: ['itens'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remover_refeicao_hoje',
      description:
        'Remove TODOS os itens de uma refeição registrada HOJE (ex: apagar um registro errado antes de re-registrar corrigido). Use quando o usuário corrigir um registro ou pedir pra apagar.',
      parameters: {
        type: 'object',
        properties: {
          refeicao: { type: 'string', description: 'Qual refeição de hoje remover: café da manhã, almoço, lanche, pré-treino, jantar, pós-treino ou ceia.' },
        },
        required: ['refeicao'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_treino',
      description:
        'Registra um treino executado (exercícios, séries, reps, carga). Use quando o usuário relatar o que treinou. Pode registrar direto.',
      parameters: {
        type: 'object',
        properties: {
          exercicios: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nome: { type: 'string' },
                series: { type: 'integer' },
                reps: { type: 'integer' },
                carga_kg: { type: 'number' },
              },
              required: ['nome'],
            },
          },
        },
        required: ['exercicios'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trocar_treino_do_dia',
      description:
        'Gera uma PROPOSTA de treino alternativo para hoje (mais curto, outro grupo, ou descanso ativo) quando o usuário não quer/não pode fazer o treino do dia. Retorna opções para você apresentar e confirmar — não altera nada sozinho.',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string', description: "Ex: 'sem tempo', 'dor no ombro', 'sem vontade'." },
          preferencia: { type: 'string', description: "Opcional: o que ele prefere fazer (ex: 'algo de perna', 'treino de 30min', 'só cardio')." },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ajustar_plano_alimentar_restante',
      description:
        'Monta o plano do resto do dia: identifica pelo HORÁRIO quais refeições ainda faltam, traz os alimentos que o usuário costuma comer em cada uma (histórico de 14 dias) e o alvo de macros por refeição. Use para "como bato minha meta hoje", "planeja o resto do dia", "o que como agora". NÃO pergunte quantas refeições antes — a tool infere sozinha.',
      parameters: {
        type: 'object',
        properties: {
          foco: { type: 'string', enum: ['bater_proteina', 'bater_kcal', 'equilibrar_macros'] },
          refeicoes_restantes: { type: 'integer', description: 'Opcional. Só passe se o usuário DISSE quantas refeições ainda fará; senão a tool infere pelo horário.' },
        },
      },
    },
  },
] satisfies ChatCompletionTool[]

// ─── Executores ─────────────────────────────────────────────────────────────

type ToolArgs = Record<string, unknown>

export async function executeTool(name: string, args: ToolArgs, userId: string): Promise<string> {
  try {
    switch (name) {
      case 'get_resumo_nutricional_hoje':
        return await getResumoNutricional(userId, args.data as string | undefined)
      case 'get_treino_do_dia':
        return await getTreinoDoDia(userId)
      case 'listar_treinos_disponiveis':
        return await listarTreinos(userId)
      case 'sugerir_alimentos_para_meta':
        return sugerirAlimentos(args.macro_alvo as string, Number(args.quantidade_faltante))
      case 'registrar_refeicao':
        return await registrarRefeicao(userId, args.refeicao as string | undefined, (args.itens as Array<{ alimento: string; quantidade?: string; quantidade_g?: number }>) ?? [])
      case 'remover_refeicao_hoje':
        return await removerRefeicaoHoje(userId, args.refeicao as string)
      case 'registrar_treino':
        return await registrarTreino(userId, (args.exercicios as Array<{ nome: string; series?: number; reps?: number; carga_kg?: number }>) ?? [])
      case 'trocar_treino_do_dia':
        return await trocarTreino(userId, args.motivo as string | undefined, args.preferencia as string | undefined)
      case 'ajustar_plano_alimentar_restante':
        return await ajustarPlano(
          userId,
          (args.foco as string) ?? 'equilibrar_macros',
          args.refeicoes_restantes ? Number(args.refeicoes_restantes) : undefined,
        )
      default:
        return JSON.stringify({ erro: `Tool desconhecida: ${name}` })
    }
  } catch (e) {
    console.error(`Tool ${name} falhou:`, e)
    return JSON.stringify({ erro: 'Não consegui executar essa ação agora.' })
  }
}

// ── Leitura ──────────────────────────────────────────────────────────────

async function getResumoNutricional(userId: string, data?: string): Promise<string> {
  const { start, end, dateStr } = dayRange(data)
  const [user, mealLogs] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
    prisma.mealLog.findMany({
      where: { userId, date: { gte: start, lte: end } },
      include: { items: { include: { food: true } } },
    }),
  ])

  const consumido = { kcal: 0, proteina_g: 0, carbo_g: 0, gordura_g: 0 }
  for (const log of mealLogs) {
    for (const item of log.items) {
      const m = scaleMacros(item.food, item.quantityG)
      consumido.kcal += m.calories
      consumido.proteina_g += m.proteinG
      consumido.carbo_g += m.carbsG
      consumido.gordura_g += m.fatG
    }
  }

  const p = user?.profile
  if (!p?.calorieGoal) {
    return JSON.stringify({
      data: dateStr,
      consumido: roundAll(consumido),
      aviso: 'Usuário ainda não definiu metas. Oriente a configurar em Configurações → Metas.',
    })
  }

  return JSON.stringify({
    data: dateStr,
    metas: { kcal: round(p.calorieGoal), proteina_g: round(p.proteinGoalG ?? 0), carbo_g: round(p.carbsGoalG ?? 0), gordura_g: round(p.fatGoalG ?? 0) },
    consumido: roundAll(consumido),
    faltante: {
      kcal: round(p.calorieGoal - consumido.kcal),
      proteina_g: round((p.proteinGoalG ?? 0) - consumido.proteina_g),
      carbo_g: round((p.carbsGoalG ?? 0) - consumido.carbo_g),
      gordura_g: round((p.fatGoalG ?? 0) - consumido.gordura_g),
    },
    refeicoes_registradas: mealLogs.filter(l => l.items.length > 0).length,
  })
}

async function getTreinoDoDia(userId: string): Promise<string> {
  const { start, end } = dayRange()
  // exclui "Treino avulso" (0 exercícios) — não é um plano de verdade
  const workout = await prisma.workout.findFirst({
    where: { userId, exercises: { some: {} } },
    orderBy: { createdAt: 'desc' },
    include: { exercises: { include: { exercise: true }, orderBy: { order: 'asc' } } },
  })

  if (!workout) {
    return JSON.stringify({ treino: null, aviso: 'Nenhum plano de treino cadastrado. Sugira gerar um no app (aba IA → Treino).' })
  }

  const sessionToday = await prisma.workoutSession.findFirst({
    where: { userId, workoutId: workout.id, date: { gte: start, lte: end } },
  })

  return JSON.stringify({
    nome: workout.name,
    grupos_musculares: workout.muscleGroups,
    status: sessionToday ? 'concluido' : 'nao_iniciado',
    exercicios: workout.exercises.map(e => ({
      nome: e.exercise.name,
      grupo: e.exercise.muscleGroup,
      series: e.targetSets,
      reps: e.targetReps,
      equipamento: e.exercise.equipment ?? undefined,
    })),
  })
}

async function listarTreinos(userId: string): Promise<string> {
  const workouts = await prisma.workout.findMany({
    where: { userId, exercises: { some: {} } },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { exercises: true } } },
  })

  if (workouts.length === 0) {
    return JSON.stringify({ treinos: [], aviso: 'Nenhum treino cadastrado ainda.' })
  }

  return JSON.stringify({
    treinos: workouts.map(w => ({
      nome: w.name,
      grupos_musculares: w.muscleGroups,
      num_exercicios: w._count.exercises,
    })),
  })
}

function sugerirAlimentos(macroAlvo: string, faltante: number): string {
  const key = macroAlvo === 'kcal' ? 'proteina' : macroAlvo
  const table = SUGGESTION_FOODS[key] ?? SUGGESTION_FOODS.proteina
  if (!faltante || faltante <= 0) {
    return JSON.stringify({ aviso: 'A meta desse macro já está batida ou o valor faltante é inválido.' })
  }

  const sugestoes = table.slice(0, 4).map(food => {
    if (macroAlvo === 'kcal') {
      const porcao_g = round((faltante / food.per100kcal) * 100)
      return { alimento: food.nome, porcao_g, fornece_kcal: round(faltante) }
    }
    const porcao_g = round((faltante / food.per100) * 100)
    const custo_kcal = round((porcao_g / 100) * food.per100kcal)
    return { alimento: food.nome, porcao_g, [`fornece_${macroAlvo}_g`]: round(faltante), custo_kcal }
  })

  return JSON.stringify({ macro: macroAlvo, faltante: round(faltante), opcoes: sugestoes })
}

// ── Ação ──────────────────────────────────────────────────────────────────

async function registrarRefeicao(
  userId: string,
  refeicao: string | undefined,
  itens: Array<{ alimento: string; quantidade?: string; quantidade_g?: number }>,
): Promise<string> {
  if (!itens.length) return JSON.stringify({ erro: 'Nenhum alimento informado.' })

  // Prioriza o texto livre ("2 fatias") — a IA nutricional converte pra gramas.
  // quantidade_g só quando o usuário realmente informou peso em gramas.
  const text = itens
    .map(i => {
      if (i.quantidade) return `${i.quantidade} de ${i.alimento}`
      if (i.quantidade_g) return `${i.quantidade_g}g de ${i.alimento}`
      return i.alimento
    })
    .join(', ')
  const parsed = await parseMealMessage(text)
  if (!parsed.items.length) return JSON.stringify({ erro: 'Não consegui estimar os macros desses alimentos.' })

  const mealType = mealNameToType(refeicao ?? '')
  const { start } = dayRange()

  let mealLog = await prisma.mealLog.findFirst({ where: { userId, date: start, mealType } })
  if (!mealLog) {
    mealLog = await prisma.mealLog.create({ data: { userId, date: start, mealType } })
  }

  for (const item of parsed.items) {
    const food = await prisma.food.upsert({
      where: { name: item.name },
      create: { name: item.name, calories: item.calories, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG, servingSize: item.quantityG || 100 },
      update: {},
    })
    // Macros do alimento estão por servingSize; gravamos a quantidade consumida.
    const quantityG = item.quantityG || food.servingSize
    await prisma.mealItem.create({ data: { mealLogId: mealLog.id, foodId: food.id, quantityG } })
  }

  return JSON.stringify({
    sucesso: true,
    registrado_em: mealType,
    total: {
      kcal: round(parsed.totalCalories),
      proteina_g: round(parsed.totalProteinG),
      carbo_g: round(parsed.totalCarbsG),
      gordura_g: round(parsed.totalFatG),
    },
    itens: parsed.items.map(i => `${i.name} (${round(i.quantityG)}g)`),
  })
}

async function removerRefeicaoHoje(userId: string, refeicao: string): Promise<string> {
  if (!refeicao) return JSON.stringify({ erro: 'Informe qual refeição remover.' })

  const mealType = mealNameToType(refeicao)
  const { start, end } = dayRange()

  const logs = await prisma.mealLog.findMany({
    where: { userId, mealType, date: { gte: start, lte: end } },
    include: { _count: { select: { items: true } } },
  })

  if (logs.length === 0) {
    return JSON.stringify({ aviso: `Nenhum registro de ${refeicao} encontrado hoje.` })
  }

  const removidos = logs.reduce((s, l) => s + l._count.items, 0)
  // deleteMany no MealLog cascateia os MealItems (onDelete: Cascade)
  await prisma.mealLog.deleteMany({
    where: { id: { in: logs.map(l => l.id) } },
  })

  return JSON.stringify({ sucesso: true, refeicao_removida: mealType, itens_removidos: removidos })
}

async function registrarTreino(
  userId: string,
  exercicios: Array<{ nome: string; series?: number; reps?: number; carga_kg?: number }>,
): Promise<string> {
  if (!exercicios.length) return JSON.stringify({ erro: 'Nenhum exercício informado.' })

  // Sessão precisa de um workout. Usa o mais recente ou cria um avulso.
  let workout = await prisma.workout.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } })
  if (!workout) {
    workout = await prisma.workout.create({ data: { userId, name: 'Treino avulso', muscleGroups: [] } })
  }

  const sessionSets: Array<{ exerciseId: string; setNumber: number; weightKg: number | null; reps: number | null; isPersonalRecord: boolean }> = []
  for (const ex of exercicios) {
    let exercise = await prisma.exercise.findFirst({ where: { name: { contains: ex.nome, mode: 'insensitive' } } })
    if (!exercise) {
      exercise = await prisma.exercise.create({ data: { name: ex.nome, muscleGroup: 'Outros' } })
    }
    const series = ex.series && ex.series > 0 ? ex.series : 1
    for (let i = 0; i < series; i++) {
      sessionSets.push({
        exerciseId: exercise.id,
        setNumber: i + 1,
        weightKg: ex.carga_kg ?? null,
        reps: ex.reps ?? null,
        isPersonalRecord: false,
      })
    }
  }

  await prisma.workoutSession.create({
    data: { userId, workoutId: workout.id, sets: { create: sessionSets } },
  })

  return JSON.stringify({
    sucesso: true,
    exercicios_registrados: exercicios.map(e => `${e.nome}${e.series ? ` ${e.series}x${e.reps ?? '?'}` : ''}${e.carga_kg ? ` ${e.carga_kg}kg` : ''}`),
    total_series: sessionSets.length,
  })
}

async function trocarTreino(userId: string, motivo?: string, preferencia?: string): Promise<string> {
  const ctx = await buildUserContext(userId)
  const treinoAtual = ctx.hoje.treino_do_dia?.nome ?? 'seu treino do dia'

  // Propostas determinísticas para o coach apresentar (não altera o banco).
  const opcoes = [
    { tipo: 'curto', descricao: 'Versão express de 25-30min: só os 3-4 exercícios compostos principais, 3 séries cada, descanso de 45-60s.' },
    { tipo: 'outro_grupo', descricao: 'Trocar o foco para outro grupo muscular que esteja descansado (ex: pernas ou costas), mantendo a frequência da semana.' },
    { tipo: 'descanso_ativo', descricao: 'Descanso ativo: 30-40min de caminhada inclinada ou bike leve. Mantém a sequência sem sobrecarregar.' },
  ]

  return JSON.stringify({
    proposta: true,
    treino_original: treinoAtual,
    motivo: motivo ?? null,
    preferencia: preferencia ?? null,
    opcoes,
    instrucao: 'Apresente 1-2 opções que melhor encaixam no motivo/preferência e confirme com o usuário antes de considerar trocado. Esta tool não altera o plano sozinha.',
  })
}

// Grade de refeições do app (mesma da página Dieta) com pesos calóricos típicos
const MEAL_SCHEDULE: Array<{ type: MealTypeEnum; nome: string; hora: string; peso: number; principal: boolean }> = [
  { type: 'BREAKFAST',    nome: 'Café da manhã', hora: '07:00', peso: 1.2, principal: true },
  { type: 'LUNCH',        nome: 'Almoço',        hora: '12:30', peso: 1.6, principal: true },
  { type: 'SNACK',        nome: 'Lanche',        hora: '15:30', peso: 0.8, principal: true },
  { type: 'PRE_WORKOUT',  nome: 'Pré-treino',    hora: '17:00', peso: 0.6, principal: false },
  { type: 'DINNER',       nome: 'Jantar',        hora: '19:00', peso: 1.5, principal: true },
  { type: 'POST_WORKOUT', nome: 'Pós-treino',    hora: '20:00', peso: 0.6, principal: false },
  { type: 'CEIA',         nome: 'Ceia',          hora: '22:00', peso: 0.7, principal: true },
]

async function ajustarPlano(userId: string, foco: string, refeicoesRestantes?: number): Promise<string> {
  const ctx = await buildUserContext(userId)
  if (ctx.metas_diarias.kcal == null) {
    return JSON.stringify({ aviso: 'Usuário sem metas definidas. Oriente a configurar em Configurações → Metas.' })
  }

  const { start, end } = dayRange()
  const agora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date())
  const horaAtual = parseInt(agora.split(':')[0], 10)

  // Refeições já registradas hoje + histórico de 14 dias em paralelo
  const since = new Date(Date.now() - 14 * 86400_000)
  const [logsHoje, historico] = await Promise.all([
    prisma.mealLog.findMany({
      where: { userId, date: { gte: start, lte: end } },
      select: { mealType: true, items: { select: { id: true }, take: 1 } },
    }),
    prisma.mealItem.findMany({
      where: { mealLog: { userId, date: { gte: since } } },
      include: { food: true, mealLog: { select: { mealType: true } } },
    }),
  ])

  const feitasHoje = new Set(logsHoje.filter(l => l.items.length > 0).map(l => l.mealType))

  // Frequência de uso por refeição (para saber se ele costuma fazer pré/pós-treino)
  const freqPorTipo = new Map<string, number>()
  // Alimentos habituais: por refeição, top alimentos por frequência com qtde típica
  const habituais = new Map<string, Map<string, { count: number; qts: number[]; food: (typeof historico)[number]['food'] }>>()
  for (const item of historico) {
    const t = item.mealLog.mealType
    freqPorTipo.set(t, (freqPorTipo.get(t) ?? 0) + 1)
    if (!habituais.has(t)) habituais.set(t, new Map())
    const m = habituais.get(t)!
    const e = m.get(item.food.name) ?? { count: 0, qts: [], food: item.food }
    e.count++
    e.qts.push(item.quantityG)
    m.set(item.food.name, e)
  }

  // Slots restantes: principais ainda não feitos e cujo horário não passou (1h de tolerância);
  // pré/pós-treino só se fazem parte do hábito do usuário
  let candidatos = MEAL_SCHEDULE.filter(s => {
    if (feitasHoje.has(s.type)) return false
    const horaSlot = parseInt(s.hora.split(':')[0], 10)
    if (horaSlot < horaAtual - 1) return false
    if (!s.principal && (freqPorTipo.get(s.type) ?? 0) < 3) return false
    return true
  })
  if (refeicoesRestantes && refeicoesRestantes > 0 && refeicoesRestantes < candidatos.length) {
    candidatos = candidatos.slice(0, refeicoesRestantes)
  }

  if (candidatos.length === 0) {
    return JSON.stringify({
      agora,
      aviso: 'Pelo horário, não há refeições padrão restantes hoje. Se ele ainda quer comer, sugira uma ceia leve e registre como CEIA.',
      faltante_total: ctx.hoje.faltante,
    })
  }

  // Divide o faltante pelos slots, ponderado pelo peso típico de cada refeição
  const falta = ctx.hoje.faltante
  const somaPesos = candidatos.reduce((s, c) => s + c.peso, 0)
  const mediana = (arr: number[]) => {
    const a = [...arr].sort((x, y) => x - y)
    return a[Math.floor(a.length / 2)]
  }

  const refeicoes_planejadas = candidatos.map(slot => {
    const frac = slot.peso / somaPesos
    const habitTop = [...(habituais.get(slot.type)?.entries() ?? [])]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 4)
      .map(([nome, e]) => {
        const qt = round(mediana(e.qts))
        const m = scaleMacros(e.food, qt)
        return { alimento: nome, quantidade_tipica_g: qt, kcal: round(m.calories), proteina_g: round(m.proteinG) }
      })
    return {
      refeicao: slot.nome,
      hora: slot.hora,
      alvo: {
        kcal: round(falta.kcal * frac),
        proteina_g: round(falta.proteina_g * frac),
        carbo_g: round(falta.carbo_g * frac),
        gordura_g: round(falta.gordura_g * frac),
      },
      alimentos_habituais: habitTop, // vazio = usuário novo, use alimentos comuns BR (TACO)
    }
  })

  return JSON.stringify({
    agora,
    foco: foco ?? 'equilibrar_macros',
    faltante_total: falta,
    refeicoes_ja_feitas_hoje: [...feitasHoje],
    refeicoes_planejadas,
    instrucao:
      'Monte um CARDÁPIO DETALHADO por refeição: cada alimento com quantidade em g/medida caseira + kcal + proteína, ' +
      'fechando perto do alvo da refeição. Priorize os alimentos_habituais (é o que a pessoa já come); complete com ' +
      'alimentos comuns no Brasil quando faltar. Se o faltante_total não couber bem nas refeições restantes, sugira ' +
      'adicionar uma ceia leve e PERGUNTE se ele topa. Ofereça trocar qualquer item.',
  })
}

// ── util ──
function roundAll(o: { kcal: number; proteina_g: number; carbo_g: number; gordura_g: number }) {
  return { kcal: round(o.kcal), proteina_g: round(o.proteina_g), carbo_g: round(o.carbo_g), gordura_g: round(o.gordura_g) }
}
