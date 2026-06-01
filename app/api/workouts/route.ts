import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return Response.json({ error: 'Not found' }, { status: 404 })

  const workouts = await prisma.workout.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: 'desc' },
    include: {
      exercises: {
        include: { exercise: true },
      },
      sessions: {
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
  }).catch(() => [])

  return Response.json({
    workouts: workouts.map(w => ({
      id: w.id,
      name: w.name,
      muscleGroups: w.muscleGroups,
      createdAt: w.createdAt.toISOString(),
      exercises: w.exercises.map(we => ({
        name: we.exercise.name,
        muscleGroup: we.exercise.muscleGroup,
        targetSets: we.targetSets,
        targetReps: we.targetReps,
        order: we.order,
      })),
      sessions: w.sessions.map(s => ({
        date: s.date.toISOString(),
      })),
    })),
  })
}
