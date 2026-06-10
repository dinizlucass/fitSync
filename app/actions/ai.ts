'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
  generateWorkoutPlan,
  generateSmartDietPlan,
  refineMealVariant,
  refineExercise,
  chatWithCoach,
  type ChatMessage,
} from '@/lib/openai'
import { WORKOUT_METHODS } from '@/lib/workout-methods'
import type { SmartDietPlan, MealVariant } from '@/lib/diet-types'
import type { SmartWorkoutPlan, ExerciseAlternative } from '@/lib/workout-types'

// ─── Generate & Save Workout Plan ─────────────────────────────────────────

const GOAL_LABELS_PT: Record<string, string> = {
  GAIN_MUSCLE: 'Ganho de massa muscular',
  LOSE_FAT: 'Perda de gordura',
  RECOMPOSITION: 'Recomposição corporal',
  MAINTAIN: 'Manutenção',
}

export async function generateAndSaveWorkoutPlan(params: {
  methodId: string
  daysPerWeek: number
  goal: string
  level: string
  sessionDuration: number
  includeCardio: boolean
}): Promise<{ success?: boolean; plan?: SmartWorkoutPlan; error?: string }> {
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

  const splits = method.splits[params.daysPerWeek as keyof typeof method.splits] ?? []

  try {
    const plan = await generateWorkoutPlan({
      method: params.methodId,
      methodName: method.name,
      daysPerWeek: params.daysPerWeek,
      goal: params.goal,
      level: params.level,
      splits,
      sessionDuration: params.sessionDuration,
      includeCardio: params.includeCardio,
      cardioGoal: GOAL_LABELS_PT[dbUser.profile?.goalType ?? 'MAINTAIN'],
      dailyCalorieGoal: dbUser.profile?.calorieGoal ?? undefined,
    })

    // Save each primary exercise slot to the DB as a single Workout
    const exerciseRecords = await Promise.all(
      plan.exercises.map(async (slot) => {
        const ex = slot.primary
        let exercise = await prisma.exercise.findFirst({ where: { name: ex.name } })
        if (!exercise) {
          exercise = await prisma.exercise.create({
            data: {
              name: ex.name,
              muscleGroup: slot.muscleGroup,
              equipment: ex.equipment,
              instructions: ex.notes,
            },
          })
        }
        return { ...ex, exerciseId: exercise.id, muscleGroup: slot.muscleGroup }
      })
    )

    const muscleGroups = [...new Set(plan.exercises.map(e => e.muscleGroup))]

    await prisma.workout.create({
      data: {
        userId: dbUser.id,
        name: plan.name,
        muscleGroups,
        exercises: {
          create: exerciseRecords.map((ex, i) => ({
            exerciseId: ex.exerciseId,
            targetSets: ex.sets,
            targetReps: parseInt(ex.reps.split('-')[0], 10) || 10,
            order: i,
          })),
        },
      },
    })

    revalidatePath('/app/treino')
    return { success: true, plan }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao gerar plano de treino. Tente novamente.' }
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

export async function generateAutoWorkoutPlan(): Promise<{ plan?: SmartWorkoutPlan; error?: string }> {
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

  const method = WORKOUT_METHODS.find(m => m.id === auto.methodId)
  if (!method) return { error: 'Método inválido' }

  const splits = method.splits[auto.days as keyof typeof method.splits] ?? []

  try {
    const plan = await generateWorkoutPlan({
      method: auto.methodId,
      methodName: method.name,
      daysPerWeek: auto.days,
      goal,
      level,
      splits,
      sessionDuration: auto.sessionDuration,
      includeCardio,
      cardioGoal: goal,
      dailyCalorieGoal: profile.calorieGoal ?? undefined,
    })

    return { plan }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao gerar plano automático. Tente novamente.' }
  }
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
  history: ChatMessage[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { profile: true },
  })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  const profile = dbUser.profile
  const goalLabels: Record<string, string> = {
    GAIN_MUSCLE: 'Ganho de massa muscular',
    LOSE_FAT: 'Perda de gordura',
    RECOMPOSITION: 'Recomposição corporal',
    MAINTAIN: 'Manutenção',
  }
  const levelLabels: Record<string, string> = {
    SEDENTARY: 'Sedentário',
    LIGHT: 'Iniciante',
    MODERATE: 'Intermediário',
    ACTIVE: 'Ativo',
    VERY_ACTIVE: 'Avançado',
  }

  try {
    const reply = await chatWithCoach({
      message: params.message,
      history: params.history,
      userContext: {
        goal: goalLabels[profile?.goalType ?? 'MAINTAIN'] ?? 'Manutenção',
        level: levelLabels[profile?.activityLevel ?? 'MODERATE'] ?? 'Intermediário',
        weight: profile?.weightKg ?? undefined,
        height: profile?.heightCm ?? undefined,
        calorieGoal: profile?.calorieGoal ?? undefined,
        proteinGoal: profile?.proteinGoalG ?? undefined,
      },
    })

    return { success: true, reply }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao processar mensagem. Tente novamente.' }
  }
}
