import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

    const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
    if (!dbUser) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const workout = await prisma.workout.findFirst({
      where: { id, userId: dbUser.id },
      include: {
        exercises: {
          orderBy: { order: 'asc' },
          include: { exercise: true },
        },
      },
    })

    if (!workout) {
      console.error(`[api/workouts/${id}] workout not found for user ${dbUser.id}`)
      return Response.json({ error: 'Treino não encontrado' }, { status: 404 })
    }

    // For each exercise, get the last session's sets for pre-filling
    const exercisesWithHistory = await Promise.all(
      workout.exercises.map(async (we) => {
        const lastSets = await prisma.sessionSet.findMany({
          where: {
            exerciseId: we.exerciseId,
            session: { userId: dbUser.id },
          },
          orderBy: { createdAt: 'desc' },
          take: we.targetSets,
        })

        return {
          id: we.exerciseId,
          name: we.exercise.name,
          muscleGroup: we.exercise.muscleGroup,
          targetSets: we.targetSets,
          targetReps: we.targetReps,
          order: we.order,
          lastSets: lastSets.map(s => ({ weightKg: s.weightKg, reps: s.reps })),
        }
      })
    )

    return Response.json({
      workout: { id: workout.id, name: workout.name, muscleGroups: workout.muscleGroups },
      exercises: exercisesWithHistory,
    })
  } catch (e) {
    console.error('[api/workouts/[id]] unhandled error:', e)
    return Response.json({ error: 'Erro interno ao carregar treino' }, { status: 500 })
  }
}
