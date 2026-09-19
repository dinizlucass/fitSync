import test from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../lib/prisma'
import { executeTool } from '../lib/coach/tools'
import { buildUserContext, formatUserContext } from '../lib/coach/context'
import { verifiedToolReply } from '../lib/coach/verified-replies'
import { runCoach } from '../lib/coach/coach'
import { getOpenAI } from '../lib/openai'

test('a free-form WhatsApp workout is saved separately from the program', async t => {
  const original = {
    sessionsFindMany: prisma.workoutSession.findMany,
    sessionsCreate: prisma.workoutSession.create,
    workoutsFindFirst: prisma.workout.findFirst,
    workoutsCreate: prisma.workout.create,
    exercisesFindFirst: prisma.exercise.findFirst,
  }
  t.after(() => {
    prisma.workoutSession.findMany = original.sessionsFindMany
    prisma.workoutSession.create = original.sessionsCreate
    prisma.workout.findFirst = original.workoutsFindFirst
    prisma.workout.create = original.workoutsCreate
    prisma.exercise.findFirst = original.exercisesFindFirst
  })

  prisma.workoutSession.findMany = (async () => []) as unknown as typeof prisma.workoutSession.findMany
  prisma.workout.findFirst = (async () => { throw new Error('Must not attach to an arbitrary program workout') }) as unknown as typeof prisma.workout.findFirst
  let createdWorkoutName = ''
  prisma.workout.create = (async ({ data }: { data: { name: string } }) => {
    createdWorkoutName = data.name
    return { id: 'avulso-1', name: data.name }
  }) as unknown as typeof prisma.workout.create
  prisma.exercise.findFirst = (async ({ where }: { where: { name: { contains: string } } }) => ({
    id: where.name.contains,
    name: where.name.contains,
  })) as unknown as typeof prisma.exercise.findFirst
  let savedWorkoutId = ''
  prisma.workoutSession.create = (async ({ data }: { data: { workoutId: string } }) => {
    savedWorkoutId = data.workoutId
    return { id: 'session-1' }
  }) as unknown as typeof prisma.workoutSession.create

  const result = JSON.parse(await executeTool('registrar_treino', {
    exercicios: [{ nome: 'Agachamento' }, { nome: 'Escada' }],
  }, 'user-1'))
  assert.equal(result.sucesso, true)
  assert.match(createdWorkoutName, /Agachamento.*Escada/)
  assert.equal(savedWorkoutId, 'avulso-1')
})

test('confirming the same workout does not create another session', async t => {
  const original = {
    sessionsFindMany: prisma.workoutSession.findMany,
    sessionsCreate: prisma.workoutSession.create,
  }
  t.after(() => {
    prisma.workoutSession.findMany = original.sessionsFindMany
    prisma.workoutSession.create = original.sessionsCreate
  })
  prisma.workoutSession.findMany = (async () => [{
    workout: { name: 'Treino avulso — Agachamento + Escada' },
    sets: [
      { exercise: { name: 'Agachamento' } },
      { exercise: { name: 'Escada' } },
    ],
  }]) as unknown as typeof prisma.workoutSession.findMany
  prisma.workoutSession.create = (async () => { throw new Error('Duplicate session') }) as unknown as typeof prisma.workoutSession.create

  const result = JSON.parse(await executeTool('registrar_treino', {
    exercicios: [{ nome: 'Agachamento' }, { nome: 'Escada' }],
  }, 'user-1'))
  assert.equal(result.sucesso, true)
  assert.equal(result.ja_registrado, true)
})

test('a requested custom workout is persisted with concrete exercises', async t => {
  const original = {
    workoutsFindMany: prisma.workout.findMany,
    workoutsCreate: prisma.workout.create,
    exercisesFindFirst: prisma.exercise.findFirst,
  }
  t.after(() => {
    prisma.workout.findMany = original.workoutsFindMany
    prisma.workout.create = original.workoutsCreate
    prisma.exercise.findFirst = original.exercisesFindFirst
  })
  prisma.workout.findMany = (async () => []) as unknown as typeof prisma.workout.findMany
  prisma.exercise.findFirst = (async ({ where }: { where: { name: { equals: string } } }) => ({
    id: where.name.equals,
    name: where.name.equals,
  })) as unknown as typeof prisma.exercise.findFirst
  let savedExerciseCount = 0
  prisma.workout.create = (async ({ data }: { data: { name: string; exercises: { create: unknown[] } } }) => {
    savedExerciseCount = data.exercises.create.length
    return { id: 'hyrox-1', name: data.name }
  }) as unknown as typeof prisma.workout.create

  const result = JSON.parse(await executeTool('salvar_treino_personalizado', {
    nome: 'Hyrox express',
    grupos_musculares: ['Funcional'],
    exercicios: [
      { nome: 'Corrida 5 minutos', grupo_muscular: 'Cardio', series: 1, repeticoes: 1 },
      { nome: 'Agachamento', grupo_muscular: 'Pernas', series: 3, repeticoes: 12 },
    ],
  }, 'user-1'))
  assert.equal(result.sucesso, true)
  assert.equal(result.salvo_no_app, true)
  assert.equal(savedExerciseCount, 2)
})

test('after a leg session, the coach sees it as done and upper body only as next suggestion', async t => {
  const original = {
    userFindUnique: prisma.user.findUnique,
    mealsFindMany: prisma.mealLog.findMany,
    workoutsFindMany: prisma.workout.findMany,
    sessionsFindMany: prisma.workoutSession.findMany,
    sessionsCount: prisma.workoutSession.count,
  }
  t.after(() => {
    prisma.user.findUnique = original.userFindUnique
    prisma.mealLog.findMany = original.mealsFindMany
    prisma.workout.findMany = original.workoutsFindMany
    prisma.workoutSession.findMany = original.sessionsFindMany
    prisma.workoutSession.count = original.sessionsCount
  })
  prisma.user.findUnique = (async () => ({ name: 'Aluno', profile: null })) as unknown as typeof prisma.user.findUnique
  prisma.mealLog.findMany = (async () => []) as unknown as typeof prisma.mealLog.findMany
  prisma.workout.findMany = (async () => [{
    id: 'upper-1', name: 'Treino A — Upper Body', muscleGroups: ['Peito'], createdAt: new Date(0),
    sessions: [], exercises: [{ order: 0, targetSets: 3, targetReps: 8,
      exercise: { name: 'Supino reto', muscleGroup: 'Peito', equipment: 'Barra' } }],
  }]) as unknown as typeof prisma.workout.findMany
  prisma.workoutSession.findMany = (async () => [{
    workoutId: 'free-1', workout: { name: 'Treino avulso — Agachamento + Escada' },
    sets: [{ exercise: { name: 'Agachamento' } }, { exercise: { name: 'Escada' } }],
  }]) as unknown as typeof prisma.workoutSession.findMany
  prisma.workoutSession.count = (async () => 1) as unknown as typeof prisma.workoutSession.count

  const ctx = await buildUserContext('user-1')
  assert.deepEqual(ctx.hoje.treinos_concluidos[0].exercicios, ['Agachamento', 'Escada'])
  assert.equal(ctx.hoje.treino_do_dia?.nome, 'Treino A — Upper Body')
  const briefing = formatUserContext(ctx)
  assert.match(briefing, /Treinos já concluídos hoje: Treino avulso/)
  assert.match(briefing, /Próximo treino sugerido pelo programa.*Treino A/)

  const reply = JSON.parse(await executeTool('get_treino_do_dia', {}, 'user-1'))
  assert.equal(reply.treinos_concluidos_hoje[0].nome, 'Treino avulso — Agachamento + Escada')
  assert.equal(reply.proximo_treino.nome, 'Treino A — Upper Body')
})

test('WhatsApp confirmation contains only the workout actually saved', () => {
  const reply = verifiedToolReply('salvar_treino_personalizado', JSON.stringify({
    sucesso: true,
    nome: 'Hyrox express',
    salvo_no_app: true,
    exercicios: [
      { nome: 'Corrida 5 minutos', series: 1, repeticoes: 1 },
      { nome: 'Agachamento', series: 3, repeticoes: 12 },
    ],
  }))
  assert.match(reply ?? '', /Hyrox express/)
  assert.match(reply ?? '', /Corrida 5 minutos/)
  assert.match(reply ?? '', /Agachamento/)
  assert.doesNotMatch(reply ?? '', /Burpee|Remada|Prancha|agendado para amanhã/)
})

test('WhatsApp workout lookup reports completed work, not the next suggestion', () => {
  const reply = verifiedToolReply('get_treino_do_dia', JSON.stringify({
    treinos_concluidos_hoje: [{ nome: 'Treino avulso — Agachamento + Escada', exercicios: ['Agachamento', 'Escada'] }],
    proximo_treino: { nome: 'Treino A — Upper Body' },
  }))
  assert.match(reply ?? '', /Agachamento.*Escada/)
  assert.doesNotMatch(reply ?? '', /Upper Body/)
})

test('asking about tomorrow distinguishes next suggestion from a scheduled workout', () => {
  const reply = verifiedToolReply('get_treino_do_dia', JSON.stringify({
    treinos_concluidos_hoje: [{ nome: 'Treino avulso — Agachamento + Escada', exercicios: ['Agachamento', 'Escada'] }],
    proximo_treino: { nome: 'Treino A — Upper Body', exercicios: [{ nome: 'Supino reto', series: 3, reps: 8 }] },
  }), 'Qual meu treino de amanhã?')
  assert.match(reply ?? '', /Não há treino agendado/)
  assert.match(reply ?? '', /Treino A — Upper Body/)
  assert.match(reply ?? '', /Supino reto — 3x8/)
})

test('runCoach ignores invented exercises in the model final answer', async t => {
  process.env.OPENAI_API_KEY ||= 'test-key'
  const client = getOpenAI()
  const original = {
    completion: client.chat.completions.create,
    userFindUnique: prisma.user.findUnique,
    mealsFindMany: prisma.mealLog.findMany,
    workoutsFindMany: prisma.workout.findMany,
    workoutsCreate: prisma.workout.create,
    sessionsFindMany: prisma.workoutSession.findMany,
    sessionsCount: prisma.workoutSession.count,
    exercisesFindFirst: prisma.exercise.findFirst,
    chatCount: prisma.chatMessage.count,
    chatFindMany: prisma.chatMessage.findMany,
    chatCreateMany: prisma.chatMessage.createMany,
  }
  t.after(() => {
    client.chat.completions.create = original.completion
    prisma.user.findUnique = original.userFindUnique
    prisma.mealLog.findMany = original.mealsFindMany
    prisma.workout.findMany = original.workoutsFindMany
    prisma.workout.create = original.workoutsCreate
    prisma.workoutSession.findMany = original.sessionsFindMany
    prisma.workoutSession.count = original.sessionsCount
    prisma.exercise.findFirst = original.exercisesFindFirst
    prisma.chatMessage.count = original.chatCount
    prisma.chatMessage.findMany = original.chatFindMany
    prisma.chatMessage.createMany = original.chatCreateMany
  })
  prisma.user.findUnique = (async () => ({ name: 'Aluno', profile: null })) as unknown as typeof prisma.user.findUnique
  prisma.mealLog.findMany = (async () => []) as unknown as typeof prisma.mealLog.findMany
  prisma.workout.findMany = (async () => []) as unknown as typeof prisma.workout.findMany
  prisma.workout.create = (async () => ({ id: 'hyrox-1', name: 'Hyrox express' })) as unknown as typeof prisma.workout.create
  prisma.workoutSession.findMany = (async () => []) as unknown as typeof prisma.workoutSession.findMany
  prisma.workoutSession.count = (async () => 0) as unknown as typeof prisma.workoutSession.count
  prisma.exercise.findFirst = (async ({ where }: { where: { name: { equals: string } } }) => ({
    id: where.name.equals, name: where.name.equals,
  })) as unknown as typeof prisma.exercise.findFirst
  prisma.chatMessage.count = (async () => 0) as unknown as typeof prisma.chatMessage.count
  prisma.chatMessage.findMany = (async () => []) as unknown as typeof prisma.chatMessage.findMany
  prisma.chatMessage.createMany = (async () => ({ count: 2 })) as unknown as typeof prisma.chatMessage.createMany

  let calls = 0
  client.chat.completions.create = (async () => {
    calls++
    return { choices: [{ message: calls === 1 ? {
      role: 'assistant', content: null, tool_calls: [{ id: 'call-1', type: 'function', function: {
        name: 'salvar_treino_personalizado',
        arguments: JSON.stringify({ nome: 'Hyrox express', grupos_musculares: ['Funcional'], exercicios: [
          { nome: 'Corrida 5 minutos', grupo_muscular: 'Cardio', series: 1, repeticoes: 1 },
          { nome: 'Agachamento', grupo_muscular: 'Pernas', series: 3, repeticoes: 12 },
        ] }),
      } }],
    } : { role: 'assistant', content: 'Salvei Hyrox 30 com burpees, remada e prancha.' } }] }
  }) as unknown as typeof client.chat.completions.create

  const reply = await runCoach({ userId: 'user-1', message: 'Crie um Hyrox express', channel: 'whatsapp' })
  assert.equal(calls, 2)
  assert.match(reply, /Hyrox express/)
  assert.doesNotMatch(reply, /burpees|remada|prancha|Hyrox 30/i)
})
