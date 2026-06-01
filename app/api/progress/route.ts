import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function getPeriodStart(period: string): Date {
  const now = new Date()
  switch (period) {
    case '4w': now.setDate(now.getDate() - 28); break
    case '8w': now.setDate(now.getDate() - 56); break
    case '3m': now.setMonth(now.getMonth() - 3); break
    case '1y': now.setFullYear(now.getFullYear() - 1); break
    default: now.setDate(now.getDate() - 28)
  }
  return now
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const period = request.nextUrl.searchParams.get('period') ?? '4w'
  const periodStart = getPeriodStart(period)

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return Response.json({ error: 'Not found' }, { status: 404 })

  const [weightLogs, sessions, exercises, prs] = await Promise.all([
    prisma.weightLog.findMany({
      where: { userId: dbUser.id, date: { gte: periodStart } },
      orderBy: { date: 'asc' },
    }),
    prisma.workoutSession.findMany({
      where: { userId: dbUser.id, date: { gte: periodStart } },
    }),
    prisma.exercise.findMany({
      where: {
        sessionSets: {
          some: {
            session: { userId: dbUser.id, date: { gte: periodStart } },
          },
        },
      },
      distinct: ['id'],
    }),
    prisma.sessionSet.findMany({
      where: {
        isPersonalRecord: true,
        session: { userId: dbUser.id, date: { gte: periodStart } },
      },
      include: {
        exercise: true,
        session: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  // Latest weight
  const latestWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null
  const firstWeight = weightLogs.length > 0 ? weightLogs[0] : null
  const weightDelta = latestWeight && firstWeight && latestWeight.id !== firstWeight.id
    ? latestWeight.weightKg - firstWeight.weightKg
    : null

  // Consistency: unique days with any activity in period
  const daysDiff = Math.ceil((Date.now() - periodStart.getTime()) / 86400000)
  const activeDays = new Set(sessions.map(s => s.date.toISOString().split('T')[0])).size
  const consistency = Math.round((activeDays / daysDiff) * 100)

  const trainingDays = [...new Set(sessions.map(s => s.date.toISOString().split('T')[0]))]

  return Response.json({
    currentWeight: latestWeight?.weightKg ?? null,
    weightDelta,
    totalSessions: sessions.length,
    consistency,
    weightHistory: weightLogs.map(w => ({
      date: w.date.toISOString().split('T')[0],
      weight: w.weightKg,
    })),
    exercises: exercises.map(ex => ({ id: ex.id, name: ex.name })),
    personalRecords: prs.map(pr => ({
      exercise: pr.exercise.name,
      weight: pr.weightKg ?? 0,
      reps: pr.reps ?? 0,
      date: format(pr.session.date, "d 'de' MMM", { locale: ptBR }),
    })),
    trainingDays,
  })
}
