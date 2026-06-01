import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const dateStr = request.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  const date = new Date(dateStr)

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { profile: true },
  })
  if (!dbUser) return Response.json({ error: 'Not found' }, { status: 404 })

  const mealLogs = await prisma.mealLog.findMany({
    where: {
      userId: dbUser.id,
      date: { gte: startOfDay(date), lte: endOfDay(date) },
    },
    include: {
      items: { include: { food: true } },
    },
  })

  const result = {
    mealLogs: mealLogs.map(log => ({
      id: log.id,
      mealType: log.mealType,
      items: log.items.map(item => {
        const ratio = item.quantityG / item.food.servingSize
        return {
          id: item.id,
          foodName: item.food.name,
          quantityG: item.quantityG,
          calories: item.food.calories * ratio,
          proteinG: item.food.proteinG * ratio,
          carbsG: item.food.carbsG * ratio,
          fatG: item.food.fatG * ratio,
        }
      }),
    })),
    calorieGoal: dbUser.profile?.calorieGoal ?? 2000,
    proteinGoal: dbUser.profile?.proteinGoalG ?? 150,
    carbsGoal: dbUser.profile?.carbsGoalG ?? 200,
    fatGoal: dbUser.profile?.fatGoalG ?? 65,
  }

  return Response.json(result)
}
