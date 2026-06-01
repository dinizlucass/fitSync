'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
  generateWorkoutPlan,
  generateDietPlan,
  chatWithCoach,
  type ChatMessage,
} from '@/lib/openai'
import { WORKOUT_METHODS } from '@/lib/workout-methods'

// ─── Generate & Save Workout Plan ─────────────────────────────────────────

export async function generateAndSaveWorkoutPlan(params: {
  methodId: string
  daysPerWeek: number
  goal: string
  level: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
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
    })

    // Save each day as a Workout in the DB
    const savedWorkouts = await Promise.all(
      plan.days.map(async (day) => {
        const exerciseRecords = await Promise.all(
          day.exercises.map(async (ex) => {
            let exercise = await prisma.exercise.findFirst({ where: { name: ex.name } })
            if (!exercise) {
              exercise = await prisma.exercise.create({
                data: { name: ex.name, muscleGroup: ex.muscleGroup },
              })
            }
            return { ...ex, exerciseId: exercise.id }
          })
        )

        return prisma.workout.create({
          data: {
            userId: dbUser.id,
            name: day.name,
            muscleGroups: day.muscleGroups,
            exercises: {
              create: exerciseRecords.map((ex, i) => ({
                exerciseId: ex.exerciseId,
                targetSets: ex.targetSets,
                targetReps: ex.targetReps,
                order: i,
              })),
            },
          },
        })
      })
    )

    revalidatePath('/app/treino')
    return { success: true, workoutIds: savedWorkouts.map((w: { id: string }) => w.id), plan }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao gerar plano de treino. Tente novamente.' }
  }
}

// ─── Generate Diet Plan ────────────────────────────────────────────────────

export async function generateDietPlanAction(params: {
  preferences: string[]
  mealsPerDay: number
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
    const plan = await generateDietPlan({
      calories: Math.round(profile.calorieGoal),
      proteinG: Math.round(profile.proteinGoalG ?? 150),
      carbsG: Math.round(profile.carbsGoalG ?? 200),
      fatG: Math.round(profile.fatGoalG ?? 60),
      goal: goalLabels[profile.goalType] ?? 'Manutenção',
      preferences: params.preferences,
      mealsPerDay: params.mealsPerDay,
    })

    return { success: true, plan }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao gerar plano alimentar. Tente novamente.' }
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
