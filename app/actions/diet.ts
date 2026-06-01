'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { startOfDay, endOfDay } from 'date-fns'

// Seed foods for search fallback
const SEED_FOODS = [
  { name: 'Frango grelhado', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0, servingSize: 100, servingUnit: 'g' },
  { name: 'Arroz integral cozido', calories: 123, proteinG: 2.6, carbsG: 25.6, fatG: 1, fiberG: 1.8, servingSize: 100, servingUnit: 'g' },
  { name: 'Ovo inteiro cozido', calories: 155, proteinG: 13, carbsG: 1.1, fatG: 11, fiberG: 0, servingSize: 100, servingUnit: 'g' },
  { name: 'Batata doce cozida', calories: 86, proteinG: 1.6, carbsG: 20, fatG: 0.1, fiberG: 3, servingSize: 100, servingUnit: 'g' },
  { name: 'Brócolis cozido', calories: 35, proteinG: 2.4, carbsG: 7, fatG: 0.4, fiberG: 3.3, servingSize: 100, servingUnit: 'g' },
  { name: 'Carne bovina moída', calories: 215, proteinG: 26, carbsG: 0, fatG: 12, fiberG: 0, servingSize: 100, servingUnit: 'g' },
  { name: 'Atum em lata (água)', calories: 128, proteinG: 28.1, carbsG: 0, fatG: 0.8, fiberG: 0, servingSize: 100, servingUnit: 'g' },
  { name: 'Feijão carioca cozido', calories: 76, proteinG: 4.8, carbsG: 13.6, fatG: 0.5, fiberG: 8.4, servingSize: 100, servingUnit: 'g' },
  { name: 'Aveia em flocos', calories: 380, proteinG: 13.9, carbsG: 67, fatG: 7, fiberG: 10.6, servingSize: 100, servingUnit: 'g' },
  { name: 'Banana', calories: 89, proteinG: 1.1, carbsG: 22.8, fatG: 0.3, fiberG: 2.6, servingSize: 100, servingUnit: 'g' },
  { name: 'Maçã', calories: 52, proteinG: 0.3, carbsG: 13.8, fatG: 0.2, fiberG: 2.4, servingSize: 100, servingUnit: 'g' },
  { name: 'Whey Protein', calories: 370, proteinG: 80, carbsG: 6, fatG: 5, fiberG: 0, servingSize: 30, servingUnit: 'g' },
  { name: 'Iogurte grego natural', calories: 97, proteinG: 9, carbsG: 3.6, fatG: 5, fiberG: 0, servingSize: 100, servingUnit: 'g' },
  { name: 'Azeite de oliva', calories: 884, proteinG: 0, carbsG: 0, fatG: 100, fiberG: 0, servingSize: 100, servingUnit: 'ml' },
  { name: 'Pão integral', calories: 247, proteinG: 8.8, carbsG: 47.7, fatG: 3.4, fiberG: 6.7, servingSize: 100, servingUnit: 'g' },
  { name: 'Macarrão cozido', calories: 158, proteinG: 5.8, carbsG: 30.9, fatG: 0.9, fiberG: 1.8, servingSize: 100, servingUnit: 'g' },
  { name: 'Salmão grelhado', calories: 208, proteinG: 20, carbsG: 0, fatG: 13, fiberG: 0, servingSize: 100, servingUnit: 'g' },
  { name: 'Queijo minas frescal', calories: 264, proteinG: 17.4, carbsG: 3, fatG: 20.2, fiberG: 0, servingSize: 100, servingUnit: 'g' },
]

export async function searchFoods(query: string) {
  // First try DB
  const dbFoods = await prisma.food.findMany({
    where: {
      name: { contains: query, mode: 'insensitive' },
    },
    take: 10,
  }).catch(() => [])

  // If no results, seed and return matches from seed
  if (dbFoods.length === 0 && query.length >= 2) {
    // Upsert seed foods
    for (const food of SEED_FOODS) {
      await prisma.food.upsert({
        where: { name: food.name },
        create: food,
        update: {},
      }).catch(() => {})
    }

    return SEED_FOODS.filter(f =>
      f.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10)
  }

  return dbFoods
}

export async function addMealItem(data: {
  foodId?: string
  foodName?: string
  mealType: string
  date: string
  quantityG: number
  calories?: number
  proteinG?: number
  carbsG?: number
  fatG?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  try {
    let foodId = data.foodId

    // If no foodId, create a custom food entry
    if (!foodId && data.foodName) {
      const food = await prisma.food.create({
        data: {
          name: data.foodName,
          calories: data.calories ?? 0,
          proteinG: data.proteinG ?? 0,
          carbsG: data.carbsG ?? 0,
          fatG: data.fatG ?? 0,
        },
      })
      foodId = food.id
    }

    if (!foodId) return { error: 'Alimento inválido' }

    const date = new Date(data.date)
    const mealType = data.mealType as 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'PRE_WORKOUT' | 'POST_WORKOUT'

    // Find or create meal log
    let mealLog = await prisma.mealLog.findFirst({
      where: {
        userId: dbUser.id,
        date: { gte: startOfDay(date), lte: endOfDay(date) },
        mealType,
      },
    })

    if (!mealLog) {
      mealLog = await prisma.mealLog.create({
        data: { userId: dbUser.id, date, mealType },
      })
    }

    await prisma.mealItem.create({
      data: { mealLogId: mealLog.id, foodId, quantityG: data.quantityG },
    })

    revalidatePath('/app/dieta')
    revalidatePath('/app/hoje')
    return { success: true }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao adicionar alimento' }
  }
}

export async function removeMealItem(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  try {
    await prisma.mealItem.delete({ where: { id } })
    revalidatePath('/app/dieta')
    revalidatePath('/app/hoje')
    return { success: true }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao remover alimento' }
  }
}

export async function updateMealItem(data: { itemId: string; newQuantityG: number }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  try {
    const item = await prisma.mealItem.findUnique({
      where: { id: data.itemId },
      include: { food: true },
    })
    if (!item) return { error: 'Item não encontrado' }

    await prisma.mealItem.update({
      where: { id: data.itemId },
      data: { quantityG: data.newQuantityG },
    })

    revalidatePath('/app/dieta')
    revalidatePath('/app/hoje')
    return { success: true }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao atualizar alimento' }
  }
}
