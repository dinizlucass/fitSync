import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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

  const exerciseId = request.nextUrl.searchParams.get('exerciseId')
  const period = request.nextUrl.searchParams.get('period') ?? '4w'

  if (!exerciseId) return Response.json({ error: 'exerciseId required' }, { status: 400 })

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return Response.json({ error: 'Not found' }, { status: 404 })

  const periodStart = getPeriodStart(period)

  const sets = await prisma.sessionSet.findMany({
    where: {
      exerciseId,
      session: { userId: dbUser.id, date: { gte: periodStart } },
      weightKg: { not: null },
    },
    include: { session: true },
    orderBy: { session: { date: 'asc' } },
  })

  // Group by session, take max weight per session
  const grouped = sets.reduce<Record<string, { maxWeight: number; isPR: boolean; date: Date }>>((acc, set) => {
    const sessionId = set.sessionId
    if (!acc[sessionId] || (set.weightKg ?? 0) > acc[sessionId].maxWeight) {
      acc[sessionId] = {
        maxWeight: set.weightKg ?? 0,
        isPR: set.isPersonalRecord,
        date: set.session.date,
      }
    }
    if (set.isPersonalRecord) acc[sessionId].isPR = true
    return acc
  }, {})

  const history = Object.values(grouped).map(v => ({
    date: v.date.toISOString().split('T')[0],
    weight: v.maxWeight,
    isPR: v.isPR,
  }))

  return Response.json({ history })
}
