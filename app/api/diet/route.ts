import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { endOfDay, format, startOfDay, subDays } from 'date-fns'

type FoodSource = {
  id: string
  name: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  servingSize: number
  servingUnit: string
}

function nutrition(food: FoodSource, quantityG: number) {
  const ratio = food.servingSize > 0 ? quantityG / food.servingSize : 0
  return {
    calories: food.calories * ratio,
    proteinG: food.proteinG * ratio,
    carbsG: food.carbsG * ratio,
    fatG: food.fatG * ratio,
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const localToday = format(new Date(), 'yyyy-MM-dd')
  const dateStr = request.nextUrl.searchParams.get('date') ?? localToday
  const date = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(date.getTime())) return Response.json({ error: 'Invalid date' }, { status: 400 })

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { profile: true },
  })
  if (!dbUser) return Response.json({ error: 'Not found' }, { status: 404 })

  const rangeStart = startOfDay(subDays(date, 29))
  const rangeEnd = endOfDay(date)
  const weekday = date.getDay()

  const [logs, template, scheduledWorkout] = await Promise.all([
    prisma.mealLog.findMany({
      where: { userId: dbUser.id, date: { gte: rangeStart, lte: rangeEnd } },
      orderBy: { date: 'desc' },
      include: { items: { include: { food: true } } },
    }),
    prisma.dietTemplate.findUnique({
      where: { userId: dbUser.id },
      include: { meals: { include: { items: { include: { food: true } } } } },
    }),
    prisma.workout.findFirst({
      where: { userId: dbUser.id, archived: false, scheduledWeekdays: { has: weekday } },
      select: { id: true, name: true },
    }).catch(() => null),
  ])

  const serializeItems = (items: typeof logs[number]['items']) => items.map(item => ({
    id: item.id,
    foodId: item.foodId,
    foodName: item.food.name,
    quantityG: item.quantityG,
    servingUnit: item.food.servingUnit,
    ...nutrition(item.food, item.quantityG),
  }))

  const historyMap = new Map<string, {
    date: string
    mealLogs: Array<{ id: string; mealType: string; items: ReturnType<typeof serializeItems> }>
  }>()

  for (const log of logs) {
    const key = format(log.date, 'yyyy-MM-dd')
    const day = historyMap.get(key) ?? { date: key, mealLogs: [] }
    day.mealLogs.push({ id: log.id, mealType: log.mealType, items: serializeItems(log.items) })
    historyMap.set(key, day)
  }

  const history = [...historyMap.values()].map(day => {
    const items = day.mealLogs.flatMap(meal => meal.items)
    return {
      ...day,
      calories: items.reduce((sum, item) => sum + item.calories, 0),
      proteinG: items.reduce((sum, item) => sum + item.proteinG, 0),
      carbsG: items.reduce((sum, item) => sum + item.carbsG, 0),
      fatG: items.reduce((sum, item) => sum + item.fatG, 0),
      mealCount: day.mealLogs.length,
    }
  }).sort((a, b) => b.date.localeCompare(a.date))

  const frequentMap = new Map<string, {
    id: string
    name: string
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
    servingUnit: string
    times: number
  }>()
  for (const log of logs) {
    for (const item of log.items) {
      const per100 = nutrition(item.food, 100)
      const current = frequentMap.get(item.foodId)
      frequentMap.set(item.foodId, {
        id: item.foodId,
        name: item.food.name,
        servingUnit: item.food.servingUnit,
        ...per100,
        times: (current?.times ?? 0) + 1,
      })
    }
  }

  const currentDay = historyMap.get(dateStr)

  return Response.json({
    mealLogs: currentDay?.mealLogs ?? [],
    calorieGoal: dbUser.profile?.calorieGoal ?? 2000,
    proteinGoal: dbUser.profile?.proteinGoalG ?? 150,
    carbsGoal: dbUser.profile?.carbsGoalG ?? 200,
    fatGoal: dbUser.profile?.fatGoalG ?? 65,
    scheduledWorkout,
    history,
    frequentFoods: [...frequentMap.values()].sort((a, b) => b.times - a.times).slice(0, 6),
    template: template ? {
      id: template.id,
      name: template.name,
      calorieGoal: template.calorieGoal,
      updatedAt: template.updatedAt.toISOString(),
      meals: template.meals.map(meal => ({
        id: meal.id,
        mealType: meal.mealType,
        mealName: meal.mealName || meal.mealType,
        items: meal.items.map(item => ({
          id: item.id,
          foodId: item.foodId,
          foodName: item.food.name,
          quantityG: item.quantityG,
          servingUnit: item.food.servingUnit,
          ...nutrition(item.food, item.quantityG),
        })),
      })),
    } : null,
  })
}
