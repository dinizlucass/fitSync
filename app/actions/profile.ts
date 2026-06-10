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

// ─── Quick profile update (inline editing) ────────────────────────────────

export interface UpdateProfileInput {
  name?: string
  goalType?: GoalType
  calorieGoal?: number
  proteinGoalG?: number
  weightKg?: number
}

export async function updateProfileAction(data: UpdateProfileInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { profile: true },
  })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  try {
    // Update user name if provided
    if (data.name !== undefined) {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { name: data.name },
      })
    }

    // Update profile fields
    const profileData: Record<string, unknown> = {}
    if (data.goalType !== undefined) profileData.goalType = data.goalType
    if (data.calorieGoal !== undefined) profileData.calorieGoal = data.calorieGoal
    if (data.proteinGoalG !== undefined) profileData.proteinGoalG = data.proteinGoalG
    if (data.weightKg !== undefined) profileData.weightKg = data.weightKg

    if (Object.keys(profileData).length > 0) {
      await prisma.profile.upsert({
        where: { userId: dbUser.id },
        create: { userId: dbUser.id, ...profileData },
        update: profileData,
      })

      // Log new weight if it changed
      if (data.weightKg !== undefined) {
        await prisma.weightLog.create({
          data: { userId: dbUser.id, weightKg: data.weightKg },
        }).catch(() => {})
      }
    }

    revalidatePath('/app/configuracoes')
    revalidatePath('/app/hoje')
    return { success: true }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao atualizar perfil' }
  }
}
