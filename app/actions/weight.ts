'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function logWeight(data: { weightKg: number; notes?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  if (!data.weightKg || data.weightKg <= 0) {
    return { error: 'Peso inválido' }
  }

  try {
    const entry = await prisma.weightLog.create({
      data: {
        userId: dbUser.id,
        weightKg: data.weightKg,
        notes: data.notes,
      },
    })

    // Also update profile weight
    await prisma.profile.updateMany({
      where: { userId: dbUser.id },
      data: { weightKg: data.weightKg },
    })

    revalidatePath('/app/hoje')
    revalidatePath('/app/progresso')
    return { success: true, id: entry.id }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao registrar peso' }
  }
}
