import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return Response.json({ error: 'Not found' }, { status: 404 })

  const twelveWeeksAgo = new Date()
  twelveWeeksAgo.setHours(0, 0, 0, 0)
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)

  const [workouts, recentSessions] = await Promise.all([
    prisma.workout.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: 'asc' },
      include: {
        exercises: {
          orderBy: { order: 'asc' },
          include: { exercise: true },
        },
        sessions: {
          orderBy: { date: 'desc' },
          take: 1,
        },
        _count: { select: { sessions: true } },
      },
    }).catch(() => []),
    prisma.workoutSession.findMany({
      where: { userId: dbUser.id, date: { gte: twelveWeeksAgo } },
      orderBy: { date: 'desc' },
      take: 100,
      include: {
        workout: { select: { id: true, name: true, archived: true } },
        sets: {
          orderBy: [{ exerciseId: 'asc' }, { setNumber: 'asc' }],
          include: { exercise: { select: { id: true, name: true } } },
        },
      },
    }).catch(() => []),
  ])

  const mappedWorkouts = workouts.map(workout => ({
    id: workout.id,
    name: workout.name,
    muscleGroups: workout.muscleGroups,
    archived: workout.archived,
    scheduledWeekdays: workout.scheduledWeekdays,
    createdAt: workout.createdAt.toISOString(),
    sessionCount: workout._count.sessions,
    exercises: workout.exercises.map(item => ({
      id: item.exerciseId,
      name: item.exercise.name,
      muscleGroup: item.exercise.muscleGroup,
      targetSets: item.targetSets,
      targetReps: item.targetReps,
      order: item.order,
    })),
    sessions: workout.sessions.map(session => ({
      id: session.id,
      date: session.date.toISOString(),
      duration: session.duration,
    })),
  }))

  return Response.json({
    workouts: mappedWorkouts.filter(workout => !workout.archived),
    archivedWorkouts: mappedWorkouts.filter(workout => workout.archived),
    recentSessions: recentSessions.map(session => ({
      id: session.id,
      workoutId: session.workoutId,
      workoutName: session.workout.name,
      workoutArchived: session.workout.archived,
      date: session.date.toISOString(),
      duration: session.duration,
      notes: session.notes,
      sets: session.sets.map(set => ({
        id: set.id,
        exerciseId: set.exerciseId,
        exerciseName: set.exercise.name,
        setNumber: set.setNumber,
        weightKg: set.weightKg,
        reps: set.reps,
        isPersonalRecord: set.isPersonalRecord,
      })),
    })),
  })
}
