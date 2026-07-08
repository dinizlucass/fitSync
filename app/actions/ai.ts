'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
  generateWeekSkeleton,
  generateProgramDay,
  generateSmartDietPlan,
  refineMealVariant,
  refineExercise,
  type ChatMessage,
  type ProgramContext,
} from '@/lib/openai'
import { runCoach } from '@/lib/coach/coach'
import { reportError } from '@/lib/monitoring'
import { WORKOUT_METHODS } from '@/lib/workout-methods'
import type { SmartDietPlan, MealVariant } from '@/lib/diet-types'
import type { SmartProgramPlan, ExerciseAlternative, VolumePreference } from '@/lib/workout-types'

// ─── Generate & Save Workout Plan ─────────────────────────────────────────

const GOAL_LABELS_PT: Record<string, string> = {
  GAIN_MUSCLE: 'Ganho de massa muscular',
  LOSE_FAT: 'Perda de gordura',
  RECOMPOSITION: 'Recomposição corporal',
  MAINTAIN: 'Manutenção',
}

const VOLUME_MAP: Record<VolumePreference, { sets: string; setsNum: number; label: string }> = {
  low:      { sets: '2-3', setsNum: 2, label: 'Baixo' },
  moderate: { sets: '3-4', setsNum: 3, label: 'Moderado' },
  high:     { sets: '4-5', setsNum: 4, label: 'Alto' },
}

export interface GenerateProgramParams {
  methodId: string
  daysPerWeek: number
  goal: string
  level: string
  sessionDuration: number
  includeCardio: boolean
  volumePreference: VolumePreference
  emphasis: string           // descrição legível da ênfase (presets ou custom)
  equipment: string          // descrição legível do equipamento
  limitations?: string       // lesões/restrições/preferências em texto livre
}

/** Tenta fn até 2x — geração por IA pode falhar validação na primeira. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch {
    return await fn()
  }
}

/**
 * Gera o PROGRAMA COMPLETO (todos os dias da divisão):
 * 1 chamada monta o esqueleto da semana conforme a ênfase, depois 1 chamada
 * POR DIA em paralelo. Não salva nada — o salvamento é decisão do usuário
 * na tela de resultado (saveProgramAction).
 */
export async function generateProgramAction(
  params: GenerateProgramParams
): Promise<{ plan?: SmartProgramPlan; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { profile: true },
  })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  const method = WORKOUT_METHODS.find(m => m.id === params.methodId)
  if (!method) return { error: 'Método inválido' }

  const ctx: ProgramContext = {
    methodName: method.name,
    daysPerWeek: params.daysPerWeek,
    goal: params.goal,
    level: params.level,
    sex: dbUser.profile?.sex ?? null,
    emphasis: params.emphasis,
    equipment: params.equipment,
    limitations: params.limitations,
    sessionDuration: params.sessionDuration,
    volumeLabel: VOLUME_MAP[params.volumePreference].label,
    setsRange: VOLUME_MAP[params.volumePreference].sets,
    includeCardio: params.includeCardio,
    dailyCalorieGoal: dbUser.profile?.calorieGoal ?? undefined,
  }

  try {
    // Etapa 1 — esqueleto da semana (divisão adaptada à ênfase)
    const skeleton = await withRetry(() => generateWeekSkeleton(ctx))

    // Etapa 2 — todos os dias em paralelo, cada um com retry próprio
    const days = await Promise.all(
      skeleton.days.map(day => withRetry(() => generateProgramDay(ctx, skeleton, day)))
    )

    const plan: SmartProgramPlan = {
      programName: skeleton.programName,
      weeklyRationale: skeleton.weeklyRationale,
      days,
      tips: [],
      cardio: skeleton.cardio && skeleton.cardio.length > 0 ? skeleton.cardio : undefined,
    }
    return { plan }
  } catch (e) {
    reportError('ia:generateProgram', e, { userId: dbUser.id, method: params.methodId, days: params.daysPerWeek })
    return { error: 'Erro ao gerar o programa. Tente novamente.' }
  }
}

// ─── Auto Workout Plan (inferred from profile) ─────────────────────────────

const AUTO_PARAMS_BY_ACTIVITY: Record<string, { days: number; methodId: string; sessionDuration: number }> = {
  SEDENTARY:   { days: 3, methodId: 'full_body',   sessionDuration: 30 },
  LIGHT:       { days: 3, methodId: 'full_body',   sessionDuration: 45 },
  MODERATE:    { days: 4, methodId: 'upper_lower', sessionDuration: 60 },
  ACTIVE:      { days: 5, methodId: 'abcde',       sessionDuration: 60 },
  VERY_ACTIVE: { days: 6, methodId: 'ppl',         sessionDuration: 90 },
}

const LEVEL_BY_ACTIVITY: Record<string, string> = {
  SEDENTARY: 'Iniciante',
  LIGHT: 'Iniciante',
  MODERATE: 'Intermediário',
  ACTIVE: 'Intermediário',
  VERY_ACTIVE: 'Avançado',
}

export async function generateAutoProgramAction(): Promise<{ plan?: SmartProgramPlan; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { profile: true },
  })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  const profile = dbUser.profile
  if (!profile) {
    return { error: 'Configure seu perfil primeiro em Configurações → Metas.' }
  }

  const auto = AUTO_PARAMS_BY_ACTIVITY[profile.activityLevel] ?? AUTO_PARAMS_BY_ACTIVITY.MODERATE
  const goal = GOAL_LABELS_PT[profile.goalType] ?? 'Manutenção'
  const level = LEVEL_BY_ACTIVITY[profile.activityLevel] ?? 'Intermediário'
  const includeCardio = profile.goalType === 'LOSE_FAT' || profile.goalType === 'RECOMPOSITION'

  const volumePreference: VolumePreference =
    profile.goalType === 'LOSE_FAT' ? 'low'
    : profile.goalType === 'GAIN_MUSCLE' ? 'high'
    : 'moderate'

  return generateProgramAction({
    methodId: auto.methodId,
    daysPerWeek: auto.days,
    goal,
    level,
    sessionDuration: auto.sessionDuration,
    includeCardio,
    volumePreference,
    emphasis:
      profile.sex === 'female'
        ? 'Equilibrado com leve prioridade para inferiores e glúteos (padrão do perfil — a aluna não personalizou)'
        : 'Equilibrado — todos os grupos com volume semelhante',
    equipment: 'Academia completa (máquinas, barras e halteres)',
    limitations: '',
  })
}

// ─── Generate Diet Plan ────────────────────────────────────────────────────

export async function generateDietPlanAction(params: {
  preferences: string[]
  mealsPerDay: number
}): Promise<{ success?: boolean; plan?: SmartDietPlan; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { profile: true },
  })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  const profile = dbUser.profile
  if (!profile?.calorieGoal) {
    return { error: 'Configure suas metas primeiro em Configurações → Metas.' }
  }

  const goalLabels: Record<string, string> = {
    GAIN_MUSCLE: 'Ganho de massa muscular',
    LOSE_FAT: 'Perda de gordura',
    RECOMPOSITION: 'Recomposição corporal',
    MAINTAIN: 'Manutenção',
  }

  try {
    const plan = await generateSmartDietPlan({
      calories: Math.round(profile.calorieGoal),
      proteinG: Math.round(profile.proteinGoalG ?? 150),
      carbsG: Math.round(profile.carbsGoalG ?? 200),
      fatG: Math.round(profile.fatGoalG ?? 60),
      goal: goalLabels[profile.goalType] ?? 'Manutenção',
      preferences: params.preferences,
      mealsPerDay: params.mealsPerDay,
      weight: profile.weightKg ?? undefined,
      height: profile.heightCm ?? undefined,
    })

    return { success: true, plan }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao gerar plano alimentar. Tente novamente.' }
  }
}

// ─── Refine Meal Variant ───────────────────────────────────────────────────

export async function refineMealVariantAction(params: {
  mealName: string
  currentVariant: MealVariant
  userMessage: string
}): Promise<{ newVariant?: MealVariant & { explanation: string }; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  try {
    const newVariant = await refineMealVariant(params)
    return { newVariant }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao ajustar refeição. Tente novamente.' }
  }
}

// ─── Refine Exercise ───────────────────────────────────────────────────────

export async function refineExerciseAction(params: {
  exerciseName: string
  sets: number
  reps: string
  muscleGroup: string
  userMessage: string
}): Promise<{ newExercise?: ExerciseAlternative & { explanation: string }; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  try {
    const newExercise = await refineExercise(params)
    return { newExercise }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao ajustar exercício. Tente novamente.' }
  }
}

// ─── AI Coach Chat ─────────────────────────────────────────────────────────

export async function sendChatMessage(params: {
  message: string
  // Mantido por compatibilidade com o chat do app; o histórico real vem da
  // memória persistida do coach (tabela chat_messages).
  history?: ChatMessage[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  try {
    const reply = await runCoach({ userId: dbUser.id, message: params.message, channel: 'app' })
    return { success: true, reply }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao processar mensagem. Tente novamente.' }
  }
}
