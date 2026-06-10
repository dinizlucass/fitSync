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

// ─── Shared helpers ────────────────────────────────────────────────────────

function parseQuantityG(quantityStr: string, calories: number): number {
  const match = quantityStr.match(/(\d+(?:[.,]\d+)?)/)
  if (match) {
    const num = parseFloat(match[1].replace(',', '.'))
    if (!isNaN(num) && num > 0 && num < 5000) return num
  }
  // Fallback: 1 kcal ≈ 1.5g (rough but better than using raw kcal)
  return Math.round(calories / 1.5) || 100
}

function mealNameToType(name: string): 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'PRE_WORKOUT' | 'POST_WORKOUT' {
  const l = name.toLowerCase()
  if (l.includes('café') || l.includes('cafe') || (l.includes('manhã') && !l.includes('lanche'))) return 'BREAKFAST'
  if (l.includes('almoço') || l.includes('almoco')) return 'LUNCH'
  if (l.includes('jantar')) return 'DINNER'
  if (l.includes('pré-treino') || l.includes('pre-treino') || l.includes('pré treino') || l.includes('pre treino')) return 'PRE_WORKOUT'
  if (l.includes('pós-treino') || l.includes('pos-treino') || l.includes('pós treino') || l.includes('pos treino')) return 'POST_WORKOUT'
  return 'SNACK'
}

// ─── Search ────────────────────────────────────────────────────────────────

export async function searchFoods(query: string) {
  const dbFoods = await prisma.food.findMany({
    where: { name: { contains: query, mode: 'insensitive' } },
    take: 10,
  }).catch(() => [])

  if (dbFoods.length === 0 && query.length >= 2) {
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

// ─── Add item ──────────────────────────────────────────────────────────────

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

// ─── Remove item ───────────────────────────────────────────────────────────

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

// ─── Update item quantity ──────────────────────────────────────────────────

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

// ─── Save AI diet plan ─────────────────────────────────────────────────────

export async function saveDietPlanAction(meals: Array<{
  name: string
  time: string
  items: Array<{
    food: string
    quantity: string
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }>
}>): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { success: false, error: 'Usuário não encontrado' }

  try {
    const today = startOfDay(new Date())

    for (const meal of meals) {
      const mealType = mealNameToType(meal.name)

      // Remove existing logs for today of this type to avoid duplicates
      await prisma.mealLog.deleteMany({
        where: { userId: dbUser.id, date: today, mealType },
      })

      const mealLog = await prisma.mealLog.create({
        data: { userId: dbUser.id, date: today, mealType },
      })

      for (const item of meal.items) {
        const food = await prisma.food.upsert({
          where: { name: item.food },
          create: {
            name: item.food,
            calories: item.calories,
            proteinG: item.proteinG,
            carbsG: item.carbsG,
            fatG: item.fatG,
          },
          update: {},
        })

        const quantityG = parseQuantityG(item.quantity, item.calories)

        await prisma.mealItem.create({
          data: { mealLogId: mealLog.id, foodId: food.id, quantityG },
        })
      }
    }

    revalidatePath('/app/dieta')
    return { success: true }
  } catch (e) {
    console.error(e)
    return { success: false, error: 'Erro ao salvar cardápio' }
  }
}

// ─── Copy meals from yesterday ─────────────────────────────────────────────

export async function copyMealsFromYesterday(
  targetDate: string
): Promise<{ success: boolean; copied: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, copied: 0, error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { success: false, copied: 0, error: 'Usuário não encontrado' }

  const todayDate = startOfDay(new Date(targetDate + 'T12:00:00'))
  const yesterday = new Date(todayDate)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayEnd = endOfDay(yesterday)

  const yesterdayLogs = await prisma.mealLog.findMany({
    where: {
      userId: dbUser.id,
      date: { gte: yesterday, lte: yesterdayEnd },
    },
    include: { items: true },
  })

  if (yesterdayLogs.length === 0) {
    return { success: false, copied: 0, error: 'Nenhuma refeição registrada ontem' }
  }

  let copied = 0
  try {
    for (const log of yesterdayLogs) {
      if (log.items.length === 0) continue

      // Remove existing for today to avoid duplicates
      await prisma.mealLog.deleteMany({
        where: { userId: dbUser.id, date: todayDate, mealType: log.mealType },
      })

      const newLog = await prisma.mealLog.create({
        data: { userId: dbUser.id, date: todayDate, mealType: log.mealType },
      })

      for (const item of log.items) {
        await prisma.mealItem.create({
          data: { mealLogId: newLog.id, foodId: item.foodId, quantityG: item.quantityG },
        })
        copied++
      }
    }

    revalidatePath('/app/dieta')
    revalidatePath('/app/hoje')
    return { success: true, copied }
  } catch (e) {
    console.error(e)
    return { success: false, copied: 0, error: 'Erro ao copiar refeições' }
  }
}

// ─── Diet Template (Melhoria 1) ────────────────────────────────────────────

type MealInput = {
  name: string
  time: string
  items: Array<{
    food: string
    quantity: string
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }>
}

export async function saveDietTemplateAction(
  meals: MealInput[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { success: false, error: 'Usuário não encontrado' }

  try {
    const totalCalories = meals.reduce<number>((sum, m) =>
      sum + m.items.reduce<number>((s, i) => s + i.calories, 0), 0
    )

    // Upsert template (one per user) — cascade deletes existing meals
    const existing = await prisma.dietTemplate.findUnique({ where: { userId: dbUser.id } })
    if (existing) {
      await prisma.dietTemplateMeal.deleteMany({ where: { templateId: existing.id } })
      await prisma.dietTemplate.update({
        where: { id: existing.id },
        data: { calorieGoal: Math.round(totalCalories), updatedAt: new Date() },
      })
    }

    const template = existing ?? await prisma.dietTemplate.create({
      data: { userId: dbUser.id, calorieGoal: Math.round(totalCalories) },
    })

    for (const meal of meals) {
      const mealType = mealNameToType(meal.name)
      const templateMeal = await prisma.dietTemplateMeal.create({
        data: { templateId: template.id, mealType, mealName: meal.name },
      })

      for (const item of meal.items) {
        const food = await prisma.food.upsert({
          where: { name: item.food },
          create: { name: item.food, calories: item.calories, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG },
          update: {},
        })
        const quantityG = parseQuantityG(item.quantity, item.calories)
        await prisma.dietTemplateMealItem.create({
          data: { mealId: templateMeal.id, foodId: food.id, quantityG },
        })
      }
    }

    revalidatePath('/app/dieta')
    return { success: true }
  } catch (e) {
    console.error(e)
    return { success: false, error: 'Erro ao salvar cardápio padrão' }
  }
}

export async function applyTemplateToTodayAction(targetDate?: string): Promise<{ success: boolean; applied: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, applied: 0, error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { success: false, applied: 0, error: 'Usuário não encontrado' }

  const template = await prisma.dietTemplate.findUnique({
    where: { userId: dbUser.id },
    include: { meals: { include: { items: { include: { food: true } } } } },
  })
  if (!template) return { success: false, applied: 0, error: 'Nenhum cardápio padrão encontrado' }

  // Use client-provided date to avoid UTC timezone mismatch (server is UTC, user may be UTC-3)
  const today = targetDate
    ? startOfDay(new Date(targetDate + 'T12:00:00'))
    : startOfDay(new Date())
  let applied = 0

  try {
    for (const meal of template.meals) {
      if (meal.items.length === 0) continue

      await prisma.mealLog.deleteMany({ where: { userId: dbUser.id, date: today, mealType: meal.mealType } })

      const mealLog = await prisma.mealLog.create({
        data: { userId: dbUser.id, date: today, mealType: meal.mealType },
      })

      for (const item of meal.items) {
        await prisma.mealItem.create({
          data: { mealLogId: mealLog.id, foodId: item.foodId, quantityG: item.quantityG },
        })
        applied++
      }
    }

    revalidatePath('/app/dieta')
    revalidatePath('/app/hoje')
    return { success: true, applied }
  } catch (e) {
    console.error(e)
    return { success: false, applied: 0, error: 'Erro ao aplicar cardápio' }
  }
}

export async function getDietTemplateStatus(): Promise<{
  exists: boolean
  name?: string
  calorieGoal?: number
  updatedAt?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { exists: false }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { exists: false }

  const template = await prisma.dietTemplate.findUnique({ where: { userId: dbUser.id } })
  if (!template) return { exists: false }

  return {
    exists: true,
    name: template.name,
    calorieGoal: template.calorieGoal,
    updatedAt: template.updatedAt.toISOString(),
  }
}

export interface TemplateMealPreview {
  mealName: string
  mealType: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  itemCount: number
  itemNames: string[]
}

export async function getDietTemplatePreview(): Promise<{
  exists: boolean
  calorieGoal?: number
  meals?: TemplateMealPreview[]
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { exists: false }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { exists: false }

  const template = await prisma.dietTemplate.findUnique({
    where: { userId: dbUser.id },
    include: {
      meals: {
        include: { items: { include: { food: true } } },
      },
    },
  })
  if (!template) return { exists: false }

  const meals: TemplateMealPreview[] = template.meals.map(meal => {
    const calories = meal.items.reduce<number>((s, i) => {
      const ratio = i.quantityG / i.food.servingSize
      return s + i.food.calories * ratio
    }, 0)
    const proteinG = meal.items.reduce<number>((s, i) => {
      const ratio = i.quantityG / i.food.servingSize
      return s + i.food.proteinG * ratio
    }, 0)
    const carbsG = meal.items.reduce<number>((s, i) => {
      const ratio = i.quantityG / i.food.servingSize
      return s + i.food.carbsG * ratio
    }, 0)
    const fatG = meal.items.reduce<number>((s, i) => {
      const ratio = i.quantityG / i.food.servingSize
      return s + i.food.fatG * ratio
    }, 0)
    return {
      mealName: meal.mealName || meal.mealType,
      mealType: meal.mealType,
      calories: Math.round(calories),
      proteinG: Math.round(proteinG),
      carbsG: Math.round(carbsG),
      fatG: Math.round(fatG),
      itemCount: meal.items.length,
      itemNames: meal.items.slice(0, 3).map(i => i.food.name),
    }
  })

  return { exists: true, calorieGoal: template.calorieGoal, meals }
}
