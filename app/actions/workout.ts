'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

interface CreateWorkoutInput {
  name: string
  muscleGroups: string[]
  exercises: Array<{
    name: string
    muscleGroup: string
    targetSets: number
    targetReps: number
    order: number
  }>
}

export async function createWorkout(data: CreateWorkoutInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  try {
    // Ensure exercises exist in the Exercise table
    const exerciseRecords = await Promise.all(
      data.exercises.map(async (ex) => {
        let exercise = await prisma.exercise.findFirst({ where: { name: ex.name } })
        if (!exercise) {
          exercise = await prisma.exercise.create({
            data: { name: ex.name, muscleGroup: ex.muscleGroup },
          })
        }
        return { ...ex, exerciseId: exercise.id }
      })
    )

    const workout = await prisma.workout.create({
      data: {
        userId: dbUser.id,
        name: data.name,
        muscleGroups: data.muscleGroups,
        exercises: {
          create: exerciseRecords.map(ex => ({
            exerciseId: ex.exerciseId,
            targetSets: ex.targetSets,
            targetReps: ex.targetReps,
            order: ex.order,
          })),
        },
      },
    })

    revalidatePath('/app/treino')
    return { success: true, workoutId: workout.id }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao criar treino' }
  }
}

interface RecordSessionInput {
  workoutId: string
  notes?: string
  duration?: number
  exercises: Array<{
    exerciseId: string
    sets: Array<{
      setNumber: number
      weightKg: number | null
      reps: number | null
      isPersonalRecord: boolean
    }>
  }>
}

export async function recordSession(data: RecordSessionInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  try {
    const session = await prisma.workoutSession.create({
      data: {
        userId: dbUser.id,
        workoutId: data.workoutId,
        notes: data.notes,
        duration: data.duration,
        sets: {
          create: data.exercises.flatMap(ex =>
            ex.sets.map(s => ({
              exerciseId: ex.exerciseId,
              setNumber: s.setNumber,
              weightKg: s.weightKg,
              reps: s.reps,
              isPersonalRecord: s.isPersonalRecord,
            }))
          ),
        },
      },
    })

    revalidatePath('/app/treino')
    revalidatePath('/app/hoje')
    revalidatePath('/app/progresso')
    return { success: true, sessionId: session.id }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao registrar sessão' }
  }
}

export async function updateWorkout(data: {
  id: string
  name: string
  muscleGroups: string[]
  exercises: Array<{
    name: string
    muscleGroup: string
    targetSets: number
    targetReps: number
    order: number
  }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  try {
    // Verify ownership
    const workout = await prisma.workout.findFirst({ where: { id: data.id, userId: dbUser.id } })
    if (!workout) return { error: 'Treino não encontrado' }

    // Ensure exercises exist
    const exerciseRecords = await Promise.all(
      data.exercises.map(async (ex) => {
        let exercise = await prisma.exercise.findFirst({ where: { name: ex.name } })
        if (!exercise) {
          exercise = await prisma.exercise.create({
            data: { name: ex.name, muscleGroup: ex.muscleGroup },
          })
        }
        return { ...ex, exerciseId: exercise.id }
      })
    )

    // Delete existing workout exercises
    await prisma.workoutExercise.deleteMany({ where: { workoutId: data.id } })

    // Update workout + recreate exercises
    await prisma.workout.update({
      where: { id: data.id },
      data: {
        name: data.name,
        muscleGroups: data.muscleGroups,
        exercises: {
          create: exerciseRecords.map(ex => ({
            exerciseId: ex.exerciseId,
            targetSets: ex.targetSets,
            targetReps: ex.targetReps,
            order: ex.order,
          })),
        },
      },
    })

    revalidatePath('/app/treino')
    return { success: true }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao atualizar treino' }
  }
}

export async function deleteWorkout(workoutId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { error: 'Usuário não encontrado' }

  try {
    const workout = await prisma.workout.findFirst({ where: { id: workoutId, userId: dbUser.id } })
    if (!workout) return { error: 'Treino não encontrado' }

    await prisma.workout.delete({ where: { id: workoutId } })

    revalidatePath('/app/treino')
    return { success: true }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao excluir treino' }
  }
}
