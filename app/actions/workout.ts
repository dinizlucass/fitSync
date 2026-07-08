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

export async function saveGeneratedWorkout(params: {
  name: string
  muscleGroups: string[]
  exercises: Array<{
    name: string
    muscleGroup: string
    sets: number
    reps: string
  }>
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { success: false, error: 'Usuário não encontrado' }

  try {
    const exerciseRecords = await Promise.all(
      params.exercises.map(async (ex) => {
        let exercise = await prisma.exercise.findFirst({ where: { name: ex.name } })
        if (!exercise) {
          exercise = await prisma.exercise.create({
            data: { name: ex.name, muscleGroup: ex.muscleGroup },
          })
        }
        return { ...ex, exerciseId: exercise.id }
      })
    )

    await prisma.workout.create({
      data: {
        userId: dbUser.id,
        name: params.name,
        muscleGroups: params.muscleGroups,
        exercises: {
          create: exerciseRecords.map((ex, i) => ({
            exerciseId: ex.exerciseId,
            targetSets: ex.sets,
            targetReps: parseInt(ex.reps.split('-')[0], 10) || 10,
            order: i,
          })),
        },
      },
    })

    revalidatePath('/app/treino')
    return { success: true }
  } catch (e) {
    console.error(e)
    return { success: false, error: 'Erro ao salvar treino' }
  }
}

// ─── Salvar programa completo (todos os dias da divisão) ──────────────────

export async function saveProgramAction(params: {
  days: Array<{
    name: string
    muscleGroups: string[]
    exercises: Array<{ name: string; muscleGroup: string; sets: number; reps: string }>
  }>
  replaceExisting: boolean
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) return { success: false, error: 'Usuário não encontrado' }

  if (!params.days.length) return { success: false, error: 'Programa vazio' }

  try {
    // Arquiva (não apaga!) os treinos atuais — histórico de sessões/PRs preservado
    if (params.replaceExisting) {
      await prisma.workout.updateMany({
        where: { userId: dbUser.id, archived: false },
        data: { archived: true },
      })
    }

    // Cria os dias EM ORDEM (A, B, C...) — a rotação do treino do dia usa createdAt
    for (const day of params.days) {
      const exerciseRecords = await Promise.all(
        day.exercises.map(async (ex) => {
          let exercise = await prisma.exercise.findFirst({ where: { name: ex.name } })
          if (!exercise) {
            exercise = await prisma.exercise.create({
              data: { name: ex.name, muscleGroup: ex.muscleGroup },
            })
          }
          return { ...ex, exerciseId: exercise.id }
        })
      )

      await prisma.workout.create({
        data: {
          userId: dbUser.id,
          name: day.name,
          muscleGroups: day.muscleGroups,
          exercises: {
            create: exerciseRecords.map((ex, i) => ({
              exerciseId: ex.exerciseId,
              targetSets: ex.sets,
              targetReps: parseInt(ex.reps.split('-')[0], 10) || 10,
              order: i,
            })),
          },
        },
      })
    }

    revalidatePath('/app/treino')
    revalidatePath('/app/hoje')
    return { success: true }
  } catch (e) {
    console.error(e)
    return { success: false, error: 'Erro ao salvar o programa' }
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

    // WorkoutSession não tem cascade no schema — apaga as sessões (SessionSet cascateia)
    // antes de remover o treino, senão a FK bloqueia o delete de treinos já realizados.
    await prisma.$transaction([
      prisma.workoutSession.deleteMany({ where: { workoutId } }),
      prisma.workout.delete({ where: { id: workoutId } }),
    ])

    revalidatePath('/app/treino')
    revalidatePath('/app/hoje')
    return { success: true }
  } catch (e) {
    console.error(e)
    return { error: 'Erro ao excluir treino' }
  }
}
