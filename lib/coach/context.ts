/**
 * Monta o "briefing" do usuário injetado a cada mensagem do coach.
 * É a fonte de verdade do ESTADO DE HOJE. Para histórico antigo, detalhes ou
 * recálculo após uma ação, o coach usa tools.
 */
import { prisma } from '@/lib/prisma'
import {
  GOAL_LABELS_PT,
  LEVEL_LABELS_PT,
  dayRange,
  saoPauloDateStr,
  scaleMacros,
  round,
} from '@/lib/coach/shared'

export interface UserContext {
  nome: string | null
  objetivo: string
  nivel: string
  peso_kg: number | null
  altura_cm: number | null
  metas_diarias: {
    kcal: number | null
    proteina_g: number | null
    carbo_g: number | null
    gordura_g: number | null
  }
  hoje: {
    data: string
    refeicoes_registradas: Array<{ nome: string; kcal: number; proteina_g: number }>
    consumido: { kcal: number; proteina_g: number; carbo_g: number; gordura_g: number }
    faltante: { kcal: number; proteina_g: number; carbo_g: number; gordura_g: number }
    treino_do_dia: {
      nome: string
      status: string
      exercicios_resumo: string
    } | null
  }
  ultimos_7_dias: {
    treinos_feitos: number
  }
}

const MEALTYPE_PT: Record<string, string> = {
  BREAKFAST: 'Café da manhã',
  LUNCH: 'Almoço',
  DINNER: 'Jantar',
  SNACK: 'Lanche',
  PRE_WORKOUT: 'Pré-treino',
  POST_WORKOUT: 'Pós-treino',
  CEIA: 'Ceia',
}

export async function buildUserContext(userId: string): Promise<UserContext> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  })

  const profile = dbUser?.profile ?? null
  const { start, end, dateStr } = dayRange()

  // ── Refeições de hoje ──────────────────────────────────────────────
  const mealLogs = await prisma.mealLog.findMany({
    where: { userId, date: { gte: start, lte: end } },
    include: { items: { include: { food: true } } },
  })

  const consumido = { kcal: 0, proteina_g: 0, carbo_g: 0, gordura_g: 0 }
  const refeicoes_registradas: Array<{ nome: string; kcal: number; proteina_g: number }> = []

  for (const log of mealLogs) {
    let mealKcal = 0
    let mealProt = 0
    for (const item of log.items) {
      const m = scaleMacros(item.food, item.quantityG)
      consumido.kcal += m.calories
      consumido.proteina_g += m.proteinG
      consumido.carbo_g += m.carbsG
      consumido.gordura_g += m.fatG
      mealKcal += m.calories
      mealProt += m.proteinG
    }
    if (log.items.length > 0) {
      refeicoes_registradas.push({
        nome: MEALTYPE_PT[log.mealType] ?? log.mealType,
        kcal: round(mealKcal),
        proteina_g: round(mealProt),
      })
    }
  }

  const metaKcal = profile?.calorieGoal ?? null
  const metaProt = profile?.proteinGoalG ?? null
  const metaCarb = profile?.carbsGoalG ?? null
  const metaFat = profile?.fatGoalG ?? null

  const faltante = {
    kcal: metaKcal != null ? round(metaKcal - consumido.kcal) : 0,
    proteina_g: metaProt != null ? round(metaProt - consumido.proteina_g) : 0,
    carbo_g: metaCarb != null ? round(metaCarb - consumido.carbo_g) : 0,
    gordura_g: metaFat != null ? round(metaFat - consumido.gordura_g) : 0,
  }

  // ── Treino do dia (plano ativo = mais recente) ─────────────────────
  const latestWorkout = await prisma.workout.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      exercises: { include: { exercise: true }, orderBy: { order: 'asc' } },
    },
  })

  let treino_do_dia: UserContext['hoje']['treino_do_dia'] = null
  if (latestWorkout) {
    const sessionToday = await prisma.workoutSession.findFirst({
      where: { userId, workoutId: latestWorkout.id, date: { gte: start, lte: end } },
    })
    treino_do_dia = {
      nome: latestWorkout.name,
      status: sessionToday ? 'concluido' : 'nao_iniciado',
      exercicios_resumo: latestWorkout.exercises.map(e => e.exercise.name).join(', '),
    }
  }

  // ── Últimos 7 dias ─────────────────────────────────────────────────
  const sevenDaysAgo = new Date(start)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const treinos_feitos = await prisma.workoutSession.count({
    where: { userId, date: { gte: sevenDaysAgo, lte: end } },
  })

  return {
    nome: dbUser?.name ?? null,
    objetivo: GOAL_LABELS_PT[profile?.goalType ?? 'MAINTAIN'] ?? 'Manutenção',
    nivel: LEVEL_LABELS_PT[profile?.activityLevel ?? 'MODERATE'] ?? 'Intermediário',
    peso_kg: profile?.weightKg ?? null,
    altura_cm: profile?.heightCm ?? null,
    metas_diarias: {
      kcal: metaKcal != null ? round(metaKcal) : null,
      proteina_g: metaProt != null ? round(metaProt) : null,
      carbo_g: metaCarb != null ? round(metaCarb) : null,
      gordura_g: metaFat != null ? round(metaFat) : null,
    },
    hoje: {
      data: dateStr,
      refeicoes_registradas,
      consumido: {
        kcal: round(consumido.kcal),
        proteina_g: round(consumido.proteina_g),
        carbo_g: round(consumido.carbo_g),
        gordura_g: round(consumido.gordura_g),
      },
      faltante,
      treino_do_dia,
    },
    ultimos_7_dias: { treinos_feitos },
  }
}

/** Renderiza o contexto como bloco legível para injetar no system/developer message. */
export function formatUserContext(ctx: UserContext): string {
  const semMeta = ctx.metas_diarias.kcal == null
  return `CONTEXTO DO USUÁRIO (estado real de hoje — use como fonte de verdade):

Perfil: ${ctx.nome ?? 'sem nome'} | Objetivo: ${ctx.objetivo} | Nível: ${ctx.nivel}${ctx.peso_kg ? ` | Peso: ${ctx.peso_kg}kg` : ''}${ctx.altura_cm ? ` | Altura: ${ctx.altura_cm}cm` : ''}

Metas diárias: ${semMeta ? 'NÃO CONFIGURADAS (oriente o usuário a definir metas no app)' : `${ctx.metas_diarias.kcal} kcal | Proteína ${ctx.metas_diarias.proteina_g}g | Carbo ${ctx.metas_diarias.carbo_g}g | Gordura ${ctx.metas_diarias.gordura_g}g`}

Hoje (${ctx.hoje.data}):
- Refeições registradas: ${ctx.hoje.refeicoes_registradas.length > 0 ? ctx.hoje.refeicoes_registradas.map(r => `${r.nome} (${r.kcal}kcal, ${r.proteina_g}g prot)`).join('; ') : 'nenhuma ainda'}
- Consumido: ${ctx.hoje.consumido.kcal} kcal | P:${ctx.hoje.consumido.proteina_g}g C:${ctx.hoje.consumido.carbo_g}g G:${ctx.hoje.consumido.gordura_g}g
- Faltante p/ meta: ${semMeta ? '—' : `${ctx.hoje.faltante.kcal} kcal | P:${ctx.hoje.faltante.proteina_g}g C:${ctx.hoje.faltante.carbo_g}g G:${ctx.hoje.faltante.gordura_g}g`}
- Treino do dia: ${ctx.hoje.treino_do_dia ? `${ctx.hoje.treino_do_dia.nome} (${ctx.hoje.treino_do_dia.status}) — ${ctx.hoje.treino_do_dia.exercicios_resumo}` : 'nenhum plano de treino cadastrado'}

Últimos 7 dias: ${ctx.ultimos_7_dias.treinos_feitos} treino(s) registrado(s).

Para recalcular após uma ação, ver detalhes ou histórico antigo, use as tools — não estime de cabeça.`
}
