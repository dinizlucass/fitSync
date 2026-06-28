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

type MealTypeEnum = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'PRE_WORKOUT' | 'POST_WORKOUT'

function mealNameToType(name: string): MealTypeEnum {
  const l = (name ?? '').toLowerCase()
  if (l.includes('café') || l.includes('cafe') || (l.includes('manhã') && !l.includes('lanche'))) return 'BREAKFAST'
  if (l.includes('almoç') || l.includes('almoc')) return 'LUNCH'
  if (l.includes('jantar') || l.includes('janta')) return 'DINNER'
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
          refeicao: { type: 'string', description: 'Ex: café, almoço, lanche, jantar.' },
          itens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                alimento: { type: 'string' },
                quantidade_g: { type: 'number' },
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
        'Calcula como distribuir o que falta de macros nas refeições restantes do dia e sugere alimentos. Retorna um plano para você apresentar. Use para "como reajusto pra bater minha proteína hoje".',
      parameters: {
        type: 'object',
        properties: {
          foco: { type: 'string', enum: ['bater_proteina', 'bater_kcal', 'equilibrar_macros'] },
          refeicoes_restantes: { type: 'integer', description: 'Quantas refeições ainda vai fazer hoje. Se não souber, pergunte antes.' },
        },
        required: ['refeicoes_restantes'],
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
        return await registrarRefeicao(userId, args.refeicao as string | undefined, (args.itens as Array<{ alimento: string; quantidade_g?: number }>) ?? [])
      case 'registrar_treino':
        return await registrarTreino(userId, (args.exercicios as Array<{ nome: string; series?: number; reps?: number; carga_kg?: number }>) ?? [])
      case 'trocar_treino_do_dia':
        return await trocarTreino(userId, args.motivo as string | undefined, args.preferencia as string | undefined)
      case 'ajustar_plano_alimentar_restante':
        return await ajustarPlano(userId, (args.foco as string) ?? 'equilibrar_macros', Number(args.refeicoes_restantes))
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
  const workout = await prisma.workout.findFirst({
    where: { userId },
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
    where: { userId },
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
  itens: Array<{ alimento: string; quantidade_g?: number }>,
): Promise<string> {
  if (!itens.length) return JSON.stringify({ erro: 'Nenhum alimento informado.' })

  const text = itens
    .map(i => (i.quantidade_g ? `${i.quantidade_g}g de ${i.alimento}` : i.alimento))
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

async function ajustarPlano(userId: string, foco: string, refeicoesRestantes: number): Promise<string> {
  if (!refeicoesRestantes || refeicoesRestantes < 1) {
    return JSON.stringify({ erro: 'Preciso saber quantas refeições ainda faltam hoje. Pergunte ao usuário.' })
  }

  const ctx = await buildUserContext(userId)
  if (ctx.metas_diarias.kcal == null) {
    return JSON.stringify({ aviso: 'Usuário sem metas definidas. Oriente a configurar em Configurações → Metas.' })
  }

  const falta = ctx.hoje.faltante
  const porRefeicao = {
    kcal: round(falta.kcal / refeicoesRestantes),
    proteina_g: round(falta.proteina_g / refeicoesRestantes),
    carbo_g: round(falta.carbo_g / refeicoesRestantes),
    gordura_g: round(falta.gordura_g / refeicoesRestantes),
  }

  // Sugestão de alimentos para o foco principal
  const macroFoco = foco === 'bater_proteina' ? 'proteina' : foco === 'bater_kcal' ? 'kcal' : 'proteina'
  const faltaFoco = macroFoco === 'kcal' ? falta.kcal : falta.proteina_g
  const sugestaoFoco = JSON.parse(sugerirAlimentos(macroFoco, faltaFoco))

  return JSON.stringify({
    foco,
    refeicoes_restantes: refeicoesRestantes,
    faltante_total: falta,
    alvo_por_refeicao: porRefeicao,
    sugestoes_para_o_foco: sugestaoFoco.opcoes ?? [],
    instrucao: 'Monte um plano concreto e curto com base nesses números e ofereça registrar via registrar_refeicao quando ele comer.',
  })
}

// ── util ──
function roundAll(o: { kcal: number; proteina_g: number; carbo_g: number; gordura_g: number }) {
  return { kcal: round(o.kcal), proteina_g: round(o.proteina_g), carbo_g: round(o.carbo_g), gordura_g: round(o.gordura_g) }
}
