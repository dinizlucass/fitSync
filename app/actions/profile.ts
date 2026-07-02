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

// ─── WhatsApp — vinculação por código ──────────────────────────────────────
// Fluxo seguro: o app gera um código e o USUÁRIO envia pelo WhatsApp para o
// bot. O webhook vincula o número REAL informado pela Meta (from) ao dono do
// código — impossível cadastrar número de terceiros ou errar digitação.

const PHONE_VERIFY_TTL_MIN = 15

export async function startPhoneVerification(): Promise<{
  code?: string
  botNumber?: string
  expiresInMin?: number
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  const { randomInt } = await import('crypto')
  const code = `FIT-${randomInt(100000, 1000000)}`
  const expiresAt = new Date(Date.now() + PHONE_VERIFY_TTL_MIN * 60_000)

  try {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { phoneVerifyCode: code, phoneVerifyExpiresAt: expiresAt },
    })
    return {
      code,
      botNumber: process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER ?? undefined,
      expiresInMin: PHONE_VERIFY_TTL_MIN,
    }
  } catch (e) {
    console.error('startPhoneVerification:', e)
    return { error: 'Erro ao gerar código. Tente novamente.' }
  }
}

/** Consulta se o número já foi vinculado (para o botão "Já enviei"). */
export async function getLinkedPhone(): Promise<{ phone: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { phone: null }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } }).catch(() => null)
  if (dbUser?.phone) revalidatePath('/app/configuracoes')
  return { phone: dbUser?.phone ?? null }
}

export async function unlinkPhone(): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  try {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { phone: null, phoneVerifyCode: null, phoneVerifyExpiresAt: null },
    })
    revalidatePath('/app/configuracoes')
    return { success: true }
  } catch (e) {
    console.error('unlinkPhone:', e)
    return { error: 'Erro ao desvincular' }
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
