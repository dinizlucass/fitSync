'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { calculateTDEE, calculateMacros } from '@/lib/calculations'
import { revalidatePath } from 'next/cache'

type GoalType = 'GAIN_MUSCLE' | 'LOSE_FAT' | 'RECOMPOSITION' | 'MAINTAIN'
type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE'

interface SaveGoalsInput {
  goalType: GoalType
  activityLevel: ActivityLevel
  weightKg: number
  heightCm: number
  birthDate: string
  sex: 'male' | 'female'
}

export async function saveGoals(data: SaveGoalsInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  let dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })

  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        supabaseId: user.id,
        email: user.email ?? '',
        name: user.user_metadata?.name ?? null,
      },
    })
  }

  // Calculate age
  const birthDate = new Date(data.birthDate)
  const today = new Date()
  const age = today.getFullYear() - birthDate.getFullYear()

  // Calculate TDEE and macros
  const tdee = calculateTDEE(data.weightKg, data.heightCm, age, data.activityLevel, data.sex)
  const macros = calculateMacros(tdee, data.goalType, data.weightKg)

  try {
    await prisma.profile.upsert({
      where: { userId: dbUser.id },
      create: {
        userId: dbUser.id,
        goalType: data.goalType,
        activityLevel: data.activityLevel,
        weightKg: data.weightKg,
        heightCm: data.heightCm,
        birthDate,
        sex: data.sex,
        tdee,
        calorieGoal: macros.calories,
        proteinGoalG: macros.proteinG,
        carbsGoalG: macros.carbsG,
        fatGoalG: macros.fatG,
      },
      update: {
        goalType: data.goalType,
        activityLevel: data.activityLevel,
        weightKg: data.weightKg,
        heightCm: data.heightCm,
        birthDate,
        sex: data.sex,
        tdee,
        calorieGoal: macros.calories,
        proteinGoalG: macros.proteinG,
        carbsGoalG: macros.carbsG,
        fatGoalG: macros.fatG,
      },
    })

    // Also log the initial weight
    await prisma.weightLog.create({
      data: { userId: dbUser.id, weightKg: data.weightKg },
    }).catch(() => {})

    revalidatePath('/app/hoje')
    revalidatePath('/app/configuracoes')
    return { success: true }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao salvar metas' }
  }
}
