import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { generateWeeklyInsight } from '@/lib/openai'
import { startOfDay } from 'date-fns'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) {
    return Response.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const sevenDaysAgo = startOfDay(new Date())
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [sessions, mealLogs, weightLogs] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId: dbUser.id, date: { gte: sevenDaysAgo } },
      include: { sets: true },
    }),
    prisma.mealLog.findMany({
      where: { userId: dbUser.id, date: { gte: sevenDaysAgo } },
      include: { items: { include: { food: true } } },
    }),
    prisma.weightLog.findMany({
      where: { userId: dbUser.id, date: { gte: sevenDaysAgo } },
      orderBy: { date: 'asc' },
    }),
  ])

  // Calculate weekly stats
  const totalSessions = sessions.length

  const totalVolume = sessions.reduce((sum, session) =>
    sum + session.sets.reduce((s, set) => s + (set.weightKg ?? 0) * (set.reps ?? 0), 0), 0
  )

  const dailyCalories = mealLogs.reduce<Record<string, number>>((acc, log) => {
    const dateStr = log.date.toISOString().split('T')[0]
    const cals = log.items.reduce((s, item) => {
      const ratio = item.quantityG / item.food.servingSize
      return s + item.food.calories * ratio
    }, 0)
    acc[dateStr] = (acc[dateStr] ?? 0) + cals
    return acc
  }, {})

  const avgCalories = Object.keys(dailyCalories).length > 0
    ? Object.values(dailyCalories).reduce((a, b) => a + b, 0) / Object.keys(dailyCalories).length
    : undefined

  const weightChange = weightLogs.length >= 2
    ? weightLogs[weightLogs.length - 1].weightKg - weightLogs[0].weightKg
    : undefined

  const personalRecords = sessions.flatMap(s => s.sets).filter(s => s.isPersonalRecord).length

  const uniqueActiveDays = new Set([
    ...sessions.map(s => s.date.toISOString().split('T')[0]),
    ...mealLogs.map(l => l.date.toISOString().split('T')[0]),
  ]).size
  const consistency = Math.round((uniqueActiveDays / 7) * 100)

  try {
    const result = await generateWeeklyInsight({
      sessions: totalSessions,
      totalVolume: Math.round(totalVolume),
      avgCalories: avgCalories ? Math.round(avgCalories) : undefined,
      weightChange,
      personalRecords,
      consistency,
    })

    return Response.json({
      insight: result.insight,
      highlights: result.highlights,
      stats: {
        sessions: totalSessions,
        volume: Math.round(totalVolume),
        avgCalories: avgCalories ? Math.round(avgCalories) : null,
        weightChange,
        personalRecords,
        consistency,
      },
    })
  } catch {
    return Response.json({ error: 'Erro ao gerar insight' }, { status: 500 })
  }
}
