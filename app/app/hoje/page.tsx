import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { dayRange } from '@/lib/coach/shared'
import { sendWelcomeEmail } from '@/lib/email'

export default async function HojePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const now = new Date()
  // "Hoje" no fuso do usuário (America/Sao_Paulo) — evita o dia "virar" à meia-noite UTC
  const { start: todayStart, end: todayEnd } = dayRange()
  const spHour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(now)
  ) % 24

  // Fetch user from DB
  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { profile: true },
  }).catch(() => null)

  if (!dbUser) {
    // Auto-create user on first visit
    try {
      await prisma.user.create({
        data: {
          supabaseId: user.id,
          email: user.email ?? '',
          name: user.user_metadata?.name ?? null,
        },
      })
      // Boas-vindas no 1º acesso (fire-and-forget; no-op sem RESEND_API_KEY)
      if (user.email) void sendWelcomeEmail(user.email, user.user_metadata?.name)
    } catch {}
    redirect('/app/configuracoes/metas')
  }

  if (!dbUser.profile) {
    redirect('/app/configuracoes/metas')
  }

  const profile = dbUser.profile

  // Fetch today's meal logs
  const mealLogs = await prisma.mealLog.findMany({
    where: {
      userId: dbUser.id,
      date: { gte: todayStart, lte: todayEnd },
    },
    include: {
      items: {
        include: { food: true },
      },
    },
  }).catch(() => [])

  // Calculate totals from meals
  let consumedCalories = 0
  let consumedProtein = 0
  let consumedCarbs = 0
  let consumedFat = 0

  for (const log of mealLogs) {
    for (const item of log.items) {
      const ratio = item.quantityG / item.food.servingSize
      consumedCalories += item.food.calories * ratio
      consumedProtein += item.food.proteinG * ratio
      consumedCarbs += item.food.carbsG * ratio
      consumedFat += item.food.fatG * ratio
    }
  }

  // Fetch today's workout sessions
  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId: dbUser.id,
      date: { gte: todayStart, lte: todayEnd },
    },
    include: { workout: true },
  }).catch(() => [])

  // Fetch latest weight log
  const latestWeight = await prisma.weightLog.findFirst({
    where: { userId: dbUser.id },
    orderBy: { date: 'desc' },
  }).catch(() => null)

  // Fetch weight 7 days ago for comparison
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const oldWeight = await prisma.weightLog.findFirst({
    where: { userId: dbUser.id, date: { lte: sevenDaysAgo } },
    orderBy: { date: 'desc' },
  }).catch(() => null)

  const weightDelta = latestWeight && oldWeight
    ? latestWeight.weightKg - oldWeight.weightKg
    : null

  // Feature 8 — Smart workout suggestion (só treinos ativos com exercícios)
  const workouts = await prisma.workout.findMany({
    where: { userId: dbUser.id, archived: false, exercises: { some: {} } },
    include: {
      exercises: { take: 3, include: { exercise: true } },
      sessions: { orderBy: { date: 'desc' }, take: 1 },
    },
  }).catch(() => [])

  // Sort: no sessions first, then by oldest last session
  const sortedWorkouts = [...workouts].sort((a, b) => {
    const aDate = a.sessions[0]?.date ?? new Date(0)
    const bDate = b.sessions[0]?.date ?? new Date(0)
    return aDate.getTime() - bDate.getTime()
  })

  // Exclude done today
  const suggestedWorkout = sortedWorkouts.find(w => {
    const lastSession = w.sessions[0]
    return !lastSession || lastSession.date < todayStart
  }) ?? null

  const allDoneToday = workouts.length > 0 && !suggestedWorkout

  // Days since last session for suggested workout
  function daysSince(date: Date | undefined): string {
    if (!date) return 'Nunca realizado'
    const diff = Math.floor((now.getTime() - date.getTime()) / 86400000)
    if (diff === 0) return 'Hoje'
    if (diff === 1) return 'Ontem'
    return `${diff} dias atrás`
  }

  const calorieGoal = profile.calorieGoal ?? 2000
  const proteinGoal = profile.proteinGoalG ?? 150
  const carbsGoal = profile.carbsGoalG ?? 200
  const fatGoal = profile.fatGoalG ?? 65

  const caloriePercent = Math.min(100, (consumedCalories / calorieGoal) * 100)
  const ringCircumference = 2 * Math.PI * 52
  const ringOffset = ringCircumference - (caloriePercent / 100) * ringCircumference

  const greeting = () => {
    if (spHour < 12) return 'Bom dia'
    if (spHour < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long',
  }).format(now)
  const formattedDateCap = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-medium">
          {greeting()}, {dbUser.name?.split(' ')[0] ?? 'atleta'}!
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{formattedDateCap}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Calorie ring card */}
        <div className="rounded-xl p-5 flex flex-col items-center" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)', gridColumn: 'span 1' }}>
          <h2 className="text-sm font-medium mb-4 self-start">Calorias hoje</h2>
          <div className="relative mb-4">
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r="52" fill="none" strokeWidth="10" stroke="var(--color-border)" />
              <circle
                cx="65"
                cy="65"
                r="52"
                fill="none"
                strokeWidth="10"
                stroke="var(--color-primary)"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                strokeLinecap="round"
                style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-medium">{Math.round(consumedCalories)}</span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>de {Math.round(calorieGoal)}</span>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {Math.round(calorieGoal - consumedCalories)} kcal restantes
          </p>
        </div>

        {/* Macros card */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
          <h2 className="text-sm font-medium mb-4">Macros</h2>
          <div className="space-y-3">
            {[
              { label: 'Proteína', consumed: consumedProtein, goal: proteinGoal, color: 'var(--color-primary)' },
              { label: 'Carboidratos', consumed: consumedCarbs, goal: carbsGoal, color: 'var(--color-carbs)' },
              { label: 'Gordura', consumed: consumedFat, goal: fatGoal, color: 'var(--color-fat)' },
            ].map((macro) => {
              const pct = Math.min(100, (macro.consumed / macro.goal) * 100)
              return (
                <div key={macro.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--color-text-muted)' }}>{macro.label}</span>
                    <span className="font-medium">{Math.round(macro.consumed)}g <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>/ {Math.round(macro.goal)}g</span></span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: macro.color }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Weight card — Feature 1 */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
          <h2 className="text-sm font-medium mb-4">Peso</h2>
          {latestWeight ? (
            <div>
              <div className="text-3xl font-medium mb-1">
                {latestWeight.weightKg.toFixed(1)}
                <span className="text-base font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>kg</span>
              </div>
              {weightDelta !== null && (
                <p className="text-sm" style={{ color: weightDelta > 0 ? 'var(--color-fat)' : weightDelta < 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                  {weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} kg esta semana
                </p>
              )}
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                Registrado em {format(latestWeight.date, "d/MM", { locale: ptBR })}
              </p>
              <Link
                href="/app/progresso"
                className="inline-block mt-2 text-xs font-medium"
                style={{ color: 'var(--color-primary)' }}
              >
                ＋ hoje
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>Nenhum peso registrado</p>
              <Link
                href="/app/progresso"
                className="text-sm font-medium"
                style={{ color: 'var(--color-primary)' }}
              >
                Registrar peso →
              </Link>
            </div>
          )}
        </div>

        {/* Today's workout — Feature 8 */}
        <div className="rounded-xl p-5 sm:col-span-2" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
          <h2 className="text-sm font-medium mb-4">Treino sugerido</h2>
          {allDoneToday ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p className="text-sm font-medium">Todos os treinos concluídos hoje! 🎉</p>
            </div>
          ) : suggestedWorkout ? (
            <Link href={`/app/treino/${suggestedWorkout.id}`} className="flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                  <path d="M18 20V10M12 20V4M6 20v-6"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium group-hover:underline">{suggestedWorkout.name}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {suggestedWorkout.exercises.length} {suggestedWorkout.exercises.length === 1 ? 'exercício' : 'exercícios'}
                  {suggestedWorkout.muscleGroups.length > 0 && ` • ${suggestedWorkout.muscleGroups.slice(0, 2).join(', ')}`}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Último: {daysSince(suggestedWorkout.sessions[0]?.date)}
                </p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-muted)' }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhum treino criado ainda</p>
              <Link href="/app/treino/novo" className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                Criar treino
              </Link>
            </div>
          )}
          {sessions.length > 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-xs" style={{ color: 'var(--color-primary)' }}>
                ✓ {sessions.length} {sessions.length === 1 ? 'treino concluído' : 'treinos concluídos'} hoje
              </p>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
          <h2 className="text-sm font-medium mb-4">Ações rápidas</h2>
          <div className="space-y-2">
            <Link href="/app/treino" className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 text-sm">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                  <path d="M18 20V10M12 20V4M6 20v-6"/>
                </svg>
              </div>
              Registrar treino
            </Link>
            <Link href="/app/dieta" className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 text-sm">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#eff6ff' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-carbs)" strokeWidth="2">
                  <path d="M12 2a3 3 0 0 0-3 3v4H6a3 3 0 0 0 0 6h1v4a3 3 0 0 0 6 0v-4h1a3 3 0 0 0 0-6h-3V5a3 3 0 0 0-3-3z"/>
                </svg>
              </div>
              Adicionar refeição
            </Link>
            <Link href="/app/progresso" className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 text-sm">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#fffbeb' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-fat)" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              Ver progresso
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
