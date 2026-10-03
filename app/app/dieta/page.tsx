'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import FoodSearchModal from '@/components/diet/FoodSearchModal'
import {
  applyTemplateMealToDateAction,
  applyTemplateToTodayAction,
  copyMealsFromDateAction,
  copyMealsFromYesterday,
  removeMealItem,
  saveDayAsDietTemplateAction,
  updateMealItem,
} from '@/app/actions/diet'

type Tab = 'today' | 'history' | 'plans'
type HistoryFilter = 'all' | 'goal' | 'outside'

interface MealItem {
  id: string
  foodId: string
  foodName: string
  quantityG: number
  servingUnit: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

interface MealLog { id: string; mealType: string; items: MealItem[] }
interface HistoryDay {
  date: string
  mealLogs: MealLog[]
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  mealCount: number
}
interface TemplateMeal { id: string; mealType: string; mealName: string; items: MealItem[] }
interface DietTemplate { id: string; name: string; calorieGoal: number; updatedAt: string; meals: TemplateMeal[] }
interface FrequentFood {
  id: string; name: string; calories: number; proteinG: number; carbsG: number; fatG: number; servingUnit: string; times: number
}
interface DayData {
  mealLogs: MealLog[]
  calorieGoal: number
  proteinGoal: number
  carbsGoal: number
  fatGoal: number
  scheduledWorkout: { id: string; name: string } | null
  history: HistoryDay[]
  frequentFoods: FrequentFood[]
  template: DietTemplate | null
}
interface EditItemState { id: string; foodName: string; currentQty: number }

const MEALS = [
  { key: 'BREAKFAST', label: 'Café da manhã', time: '07:00' },
  { key: 'LUNCH', label: 'Almoço', time: '12:30' },
  { key: 'SNACK', label: 'Lanche', time: '15:30' },
  { key: 'PRE_WORKOUT', label: 'Pré-treino', time: '17:00' },
  { key: 'DINNER', label: 'Jantar', time: '19:00' },
  { key: 'POST_WORKOUT', label: 'Pós-treino', time: '20:00' },
  { key: 'CEIA', label: 'Ceia', time: '22:00' },
] as const

const COLORS = { protein: '#1D9E75', carbs: '#378ADD', fat: '#EF9F27', alert: '#E24B4A' }

function number(value: number) {
  return Math.round(value).toLocaleString('pt-BR')
}

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`)
}

function mealMeta(key: string) {
  return MEALS.find(meal => meal.key === key) ?? { key, label: key, time: '' }
}

function nutrition(items: MealItem[]) {
  return items.reduce((total, item) => ({
    calories: total.calories + item.calories,
    proteinG: total.proteinG + item.proteinG,
    carbsG: total.carbsG + item.carbsG,
    fatG: total.fatG + item.fatG,
  }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 })
}

function statusFor(calories: number, goal: number) {
  const ratio = goal > 0 ? calories / goal : 0
  if (ratio < 0.9) return { key: 'low', label: 'Abaixo', color: COLORS.fat, bg: '#fff8e1' }
  if (ratio > 1.1) return { key: 'high', label: 'Acima', color: COLORS.alert, bg: '#fef2f2' }
  return { key: 'goal', label: 'Na meta', color: COLORS.protein, bg: '#e8f7f2' }
}

function SparkIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3 1.8 4.7L19 9.5l-4 3.2 1.2 5.3-4.2-2.8L7.8 18 9 12.7l-4-3.2 5.2-1.8L12 3Z" /></svg>
}

function Chevron({ open }: { open: boolean }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform" style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="m6 9 6 6 6-6" /></svg>
}

function MealIcon({ index }: { index: number }) {
  const paths = [
    <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></>,
    <path d="M3 11 22 2l-9 19-2-8-8-2Z"/>,
    <><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Z"/></>,
    <path d="m13 2-10 12h9l-1 8 10-12h-9l1-8Z"/>,
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>,
    <path d="M6.5 6.5h11M6.5 17.5h11M4 12h16"/>,
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>,
  ]
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{paths[index]}</svg>
}

export default function DietaPage() {
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [tab, setTab] = useState<Tab>('today')
  const [data, setData] = useState<DayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openMeal, setOpenMeal] = useState<string | null>(null)
  const [openHistory, setOpenHistory] = useState<string | null>(null)
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [historyLimit, setHistoryLimit] = useState(20)
  const [modalOpen, setModalOpen] = useState(false)
  const [activeMealType, setActiveMealType] = useState('LUNCH')
  const [editItem, setEditItem] = useState<EditItemState | null>(null)
  const [editQty, setEditQty] = useState('')
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [waterCups, setWaterCups] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/diet?date=${date}`)
      if (!response.ok) throw new Error('Não foi possível carregar sua dieta.')
      const payload: DayData = await response.json()
      setData(payload)
      const logged = new Set(payload.mealLogs.filter(log => log.items.length).map(log => log.mealType))
      const planned = payload.template?.meals.find(meal => !logged.has(meal.mealType))
      setOpenMeal(planned?.mealType ?? payload.mealLogs.find(log => log.items.length)?.mealType ?? null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar sua dieta.')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const saved = window.localStorage.getItem(`fitsync-water-${date}`)
    setWaterCups(saved ? Number(saved) : 0)
  }, [date])

  function updateWater(next: number) {
    const value = Math.max(0, Math.min(14, next))
    setWaterCups(value)
    window.localStorage.setItem(`fitsync-water-${date}`, String(value))
  }

  function showMessage(value: string) {
    setMessage(value)
    window.setTimeout(() => setMessage(null), 3500)
  }

  const allItems = data?.mealLogs.flatMap(log => log.items) ?? []
  const totals = nutrition(allItems)
  const goal = data?.calorieGoal ?? 0
  const caloriePct = goal > 0 ? Math.min(100, totals.calories / goal * 100) : 0
  const remaining = goal - totals.calories
  const today = format(new Date(), 'yyyy-MM-dd')
  const isToday = date === today
  const loggedTypes = useMemo(() => new Set(data?.mealLogs.filter(log => log.items.length).map(log => log.mealType) ?? []), [data?.mealLogs])
  const nextMealType = data?.template?.meals.find(meal => !loggedTypes.has(meal.mealType))?.mealType

  const macros = [
    { label: 'Proteína', short: 'Proteína', value: totals.proteinG, goal: data?.proteinGoal ?? 0, color: COLORS.protein },
    { label: 'Carboidratos', short: 'Carbos', value: totals.carbsG, goal: data?.carbsGoal ?? 0, color: COLORS.carbs },
    { label: 'Gordura', short: 'Gordura', value: totals.fatG, goal: data?.fatGoal ?? 0, color: COLORS.fat },
  ]

  const calendarDays = useMemo(() => Array.from({ length: 28 }, (_, index) => {
    const value = format(addDays(subDays(parseDate(date), 27), index), 'yyyy-MM-dd')
    const day = data?.history.find(item => item.date === value)
    const status = day ? statusFor(day.calories, data?.calorieGoal ?? 0) : null
    return { value, day, status }
  }), [data, date])

  const filteredHistory = (data?.history ?? []).filter(day => {
    const status = statusFor(day.calories, data?.calorieGoal ?? 0)
    if (historyFilter === 'goal') return status.key === 'goal'
    if (historyFilter === 'outside') return status.key !== 'goal'
    return true
  })
  const visibleHistory = filteredHistory.slice(0, historyLimit)
  const calendarLoggedDays = calendarDays.filter(day => day.day)
  const daysInGoal = calendarLoggedDays.filter(day => day.status?.key === 'goal').length

  async function saveEdit() {
    if (!editItem) return
    const quantity = Number(editQty)
    if (!Number.isFinite(quantity) || quantity <= 0) return
    setPendingAction(editItem.id)
    const result = await updateMealItem({ itemId: editItem.id, newQuantityG: quantity })
    setPendingAction(null)
    if (result.error) return showMessage(result.error)
    setEditItem(null)
    await loadData()
  }

  async function removeItem(id: string) {
    setPendingAction(id)
    const result = await removeMealItem(id)
    setPendingAction(null)
    if (result.error) return showMessage(result.error)
    await loadData()
  }

  async function copyYesterday() {
    setPendingAction('copy')
    const result = await copyMealsFromYesterday(date)
    setPendingAction(null)
    showMessage(result.success ? `${result.copied} itens copiados de ontem` : result.error ?? 'Erro ao copiar')
    if (result.success) await loadData()
  }

  async function logPlannedMeal(mealType: string) {
    setPendingAction(mealType)
    const result = await applyTemplateMealToDateAction(mealType, date)
    setPendingAction(null)
    showMessage(result.success ? 'Refeição registrada' : result.error ?? 'Erro ao registrar')
    if (result.success) await loadData()
  }

  async function applyTemplate() {
    setPendingAction('template')
    const result = await applyTemplateToTodayAction(today)
    setPendingAction(null)
    showMessage(result.success ? `${result.applied} itens aplicados` : result.error ?? 'Erro ao aplicar')
    if (result.success) { setTab('today'); await loadData() }
  }

  async function copyHistoryDay(sourceDate: string) {
    setPendingAction(sourceDate)
    const result = await copyMealsFromDateAction(sourceDate, today)
    setPendingAction(null)
    showMessage(result.success ? `${result.copied} itens copiados para hoje` : result.error ?? 'Erro ao copiar')
    if (result.success && date === today) await loadData()
  }

  async function saveHistoryAsTemplate(sourceDate: string) {
    setPendingAction(`save-${sourceDate}`)
    const result = await saveDayAsDietTemplateAction(sourceDate)
    setPendingAction(null)
    showMessage(result.success ? 'Cardápio salvo a partir deste dia' : result.error ?? 'Erro ao salvar')
    if (result.success) await loadData()
  }

  const subtitle = `${format(parseDate(date), "EEE, d 'de' MMM", { locale: ptBR }).replace('.', '')} · ${data?.scheduledWorkout ? `Dia de treino (${data.scheduledWorkout.name})` : 'Dia de descanso'}`

  return (
    <div className="mx-auto min-h-full max-w-[1080px] px-4 py-5 sm:px-6 sm:py-7">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-medium">Dieta</h1>
          <p className="mt-0.5 truncate text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {tab === 'today' ? subtitle : tab === 'history' ? `${data?.history.length ?? 0} dias registrados no histórico completo` : `${data?.template ? 1 : 0} cardápio salvo`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {tab === 'today' && <div className="flex items-center rounded-lg border px-2 py-1.5" style={{ borderColor: 'var(--color-border)' }}>
            <button onClick={() => setDate(format(subDays(parseDate(date), 1), 'yyyy-MM-dd'))} aria-label="Dia anterior" className="p-1" style={{ color: 'var(--color-text-muted)' }}>‹</button>
            <span className="min-w-12 px-1 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>{isToday ? 'Hoje' : format(parseDate(date), 'dd/MM')}</span>
            <button onClick={() => setDate(format(addDays(parseDate(date), 1), 'yyyy-MM-dd'))} aria-label="Próximo dia" className="p-1" style={{ color: 'var(--color-text-muted)' }}>›</button>
          </div>}
          <Link href="/app/ia?tab=diet" aria-label="Gerar cardápio" className="flex h-10 w-10 items-center justify-center rounded-full text-white sm:h-auto sm:w-auto sm:gap-2 sm:rounded-lg sm:px-3 sm:py-2 sm:text-xs" style={{ backgroundColor: 'var(--color-primary)' }}><SparkIcon /><span className="hidden sm:inline">Gerar cardápio</span></Link>
        </div>
      </header>

      <div className="mb-5 grid grid-cols-3 border-b sm:flex sm:gap-8" style={{ borderColor: 'var(--color-border)' }} role="tablist">
        {([['today', 'Hoje'], ['history', 'Histórico'], ['plans', 'Cardápios']] as Array<[Tab, string]>).map(([value, label]) => (
          <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className="border-b-2 px-1 py-3 text-sm sm:min-w-24" style={{ borderColor: tab === value ? 'var(--color-primary)' : 'transparent', color: tab === value ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: tab === value ? 500 : 400 }}>
            {label}<span className="ml-2 hidden rounded-full px-2 py-0.5 text-[11px] sm:inline" style={{ backgroundColor: tab === value ? 'var(--color-primary-light)' : 'var(--color-background)' }}>{value === 'today' ? format(parseDate(date), 'dd/MM') : value === 'history' ? data?.history.length ?? 0 : data?.template ? '1' : '0'}</span>
          </button>
        ))}
      </div>

      {message && <div className="mb-4 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>{message}</div>}
      {error && <div className="mb-4 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: COLORS.alert, color: COLORS.alert }}>{error}</div>}

      {loading || !data ? <div className="flex min-h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> : <>
        {tab === 'today' && <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <section className="rounded-xl border bg-white p-4 sm:p-5" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-5 sm:gap-7">
              <div className="relative h-28 w-28 shrink-0 sm:h-36 sm:w-36">
                <svg className="h-full w-full" viewBox="0 0 140 140"><circle cx="70" cy="70" r="64" fill="none" strokeWidth="12" stroke="var(--color-border)"/><circle cx="70" cy="70" r="64" fill="none" strokeWidth="12" stroke={remaining < 0 ? COLORS.alert : COLORS.protein} strokeDasharray="402.1" strokeDashoffset={402.1 - caloriePct / 100 * 402.1} strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset .4s ease' }}/></svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-medium tabular-nums sm:text-2xl">{number(totals.calories)}</span><span className="text-[11px] sm:text-xs" style={{ color: 'var(--color-text-muted)' }}>/ {number(goal)} kcal</span></div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{remaining < 0 ? 'Excedido' : 'Restam'}</p>
                <p className="mb-3 mt-0.5 text-xl font-medium" style={{ color: remaining < 0 ? COLORS.alert : COLORS.protein }}>{remaining < 0 ? '+' : ''}{number(Math.abs(remaining))} kcal</p>
                <span className="inline-block rounded-full px-2 py-1 text-[11px]" style={{ backgroundColor: data.scheduledWorkout ? 'var(--color-primary-light)' : 'var(--color-surface)', color: data.scheduledWorkout ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>{data.scheduledWorkout ? 'Meta de dia de treino' : 'Meta de descanso'}</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 sm:hidden">{macros.map(macro => <div key={macro.label}><p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{macro.short}</p><p className="my-1 text-xs tabular-nums"><span className="font-medium" style={{ color: macro.color }}>{number(macro.value)}</span><span style={{ color: 'var(--color-text-muted)' }}>/{macro.goal}g</span></p><div className="h-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--color-border)' }}><div className="h-full rounded-full" style={{ width: `${macro.goal ? Math.min(100, macro.value / macro.goal * 100) : 0}%`, backgroundColor: macro.color }}/></div></div>)}</div>
            <div className="mt-5 hidden space-y-3 sm:block">{macros.map(macro => <div key={macro.label}><div className="mb-1 flex justify-between text-xs"><span style={{ color: 'var(--color-text-muted)' }}>{macro.label}</span><span className="tabular-nums"><span className="font-medium" style={{ color: macro.color }}>{number(macro.value)}g</span><span style={{ color: 'var(--color-text-muted)' }}> / {macro.goal}g</span></span></div><div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--color-border)' }}><div className="h-full rounded-full" style={{ width: `${macro.goal ? Math.min(100, macro.value / macro.goal * 100) : 0}%`, backgroundColor: macro.color }}/></div></div>)}</div>
          </section>

          <aside className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <section className="rounded-xl border bg-white p-4" style={{ borderColor: 'var(--color-border)' }}><div className="mb-3 flex items-baseline justify-between"><h2 className="text-sm font-medium">Água</h2><span className="text-xs tabular-nums"><b style={{ color: COLORS.carbs }}>{(waterCups * .25).toLocaleString('pt-BR')} L</b><span style={{ color: 'var(--color-text-muted)' }}> / 3,5 L</span></span></div><div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1 lg:grid-cols-7 lg:gap-1.5">{Array.from({ length: 14 }, (_, index) => <button key={index} aria-label={`${index + 1} copos de água`} onClick={() => updateWater(waterCups === index + 1 ? index : index + 1)} className="h-5 rounded sm:h-6" style={{ border: `1px solid ${index < waterCups ? COLORS.carbs : 'var(--color-border)'}`, backgroundColor: index < waterCups ? COLORS.carbs : '#fff' }}/>)}</div><div className="mt-3 flex gap-2"><button onClick={() => updateWater(waterCups - 1)} className="flex-1 rounded-lg border py-2 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>−250 ml</button><button onClick={() => updateWater(waterCups + 1)} className="flex-1 rounded-lg py-2 text-xs font-medium" style={{ backgroundColor: '#eaf3fc', color: COLORS.carbs }}>+250 ml</button></div></section>
            <section className="rounded-xl border bg-white p-4" style={{ borderColor: 'var(--color-border)' }}><div className="mb-2 flex justify-between text-sm"><span className="font-medium">Aderência de hoje</span><span>{loggedTypes.size} de {MEALS.length}</span></div><div className="grid grid-cols-7 gap-1.5">{MEALS.map(meal => <span key={meal.key} className="h-2 rounded-full" style={{ backgroundColor: loggedTypes.has(meal.key) ? COLORS.protein : 'var(--color-surface)' }}/>)}</div><p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>{loggedTypes.size === MEALS.length ? 'Todas as refeições registradas.' : `${MEALS.length - loggedTypes.size} refeições ainda pendentes.`}</p></section>
            <section className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-primary-light)' }}><p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>{data.scheduledWorkout ? 'Hoje é dia de treino' : 'Hoje é dia de descanso'}</p><p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{data.scheduledWorkout ? `${data.scheduledWorkout.name}. Priorize carboidratos próximos ao treino.` : 'Sem treino programado. Mantenha a proteína e respeite sua meta do dia.'}</p></section>
          </aside>

          <section className="min-w-0 lg:col-start-1">
            <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-medium">Refeições <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>· {loggedTypes.size}/{MEALS.length}</span></h2><button onClick={copyYesterday} disabled={pendingAction === 'copy'} className="text-xs font-medium disabled:opacity-50" style={{ color: 'var(--color-primary)' }}>{pendingAction === 'copy' ? 'Copiando…' : 'Copiar de ontem'}</button></div>
            <div className="space-y-2">{MEALS.map((meal, index) => {
              const log = data.mealLogs.find(item => item.mealType === meal.key)
              const planned = data.template?.meals.find(item => item.mealType === meal.key)
              const registered = Boolean(log?.items.length)
              const items = registered ? log!.items : planned?.items ?? []
              const sum = nutrition(items)
              const open = openMeal === meal.key
              const isNext = nextMealType === meal.key
              return <article key={meal.key} className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: isNext ? 'var(--color-primary)' : 'var(--color-border)' }}>
                <div className="flex min-h-16 items-center gap-3 px-3 py-2.5 sm:px-4">
                  <button onClick={() => setOpenMeal(open ? null : meal.key)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: registered ? 'var(--color-primary-light)' : 'var(--color-surface)', color: registered ? 'var(--color-primary)' : 'var(--color-text-muted)' }}><MealIcon index={index}/></span>
                    <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><b className="text-sm font-medium">{meal.label}</b><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{meal.time}</span><span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: registered ? 'var(--color-primary-light)' : isNext ? 'var(--color-primary)' : 'var(--color-surface)', color: registered ? 'var(--color-primary)' : isNext ? '#fff' : 'var(--color-text-muted)' }}>{registered ? 'Registrado' : isNext ? 'Próxima' : planned ? 'Planejado' : 'Vazio'}</span></span><span className="mt-0.5 block truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>{items.length ? items.map(item => item.foodName).join(', ') : 'Nenhum alimento adicionado'}</span></span>
                    <span className="hidden w-28 shrink-0 text-right text-xs tabular-nums sm:block"><b>{number(registered ? sum.calories : 0)}</b><span style={{ color: 'var(--color-text-muted)' }}> / {number(sum.calories)} kcal</span></span>
                    <span style={{ color: 'var(--color-text-muted)' }}><Chevron open={open}/></span>
                  </button>
                  <button onClick={() => { setActiveMealType(meal.key); setModalOpen(true) }} aria-label={`Adicionar em ${meal.label}`} className="rounded-lg px-2.5 py-1.5 text-xs" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>+ <span className="hidden sm:inline">Adicionar</span></button>
                </div>
                {open && <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  {!registered && planned && <p className="px-4 pt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>Planejado no cardápio “{data.template?.name}”</p>}
                  {items.length ? items.map(item => <div key={item.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0" style={{ borderColor: 'var(--color-border)', opacity: registered ? 1 : .65 }}><button onClick={() => registered && (setEditItem({ id: item.id, foodName: item.foodName, currentQty: item.quantityG }), setEditQty(String(item.quantityG)))} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm">{item.foodName}</span><span className="mt-0.5 block text-xs" style={{ color: 'var(--color-text-muted)' }}>{number(item.quantityG)}{item.servingUnit} · {number(item.calories)} kcal · <i style={{ color: COLORS.protein, fontStyle: 'normal' }}>P {number(item.proteinG)}</i> · <i style={{ color: COLORS.carbs, fontStyle: 'normal' }}>C {number(item.carbsG)}</i> · <i style={{ color: COLORS.fat, fontStyle: 'normal' }}>G {number(item.fatG)}</i></span></button>{registered && <button onClick={() => removeItem(item.id)} disabled={pendingAction === item.id} aria-label={`Remover ${item.foodName}`} className="h-8 w-8 text-lg disabled:opacity-50" style={{ color: 'var(--color-text-muted)' }}>×</button>}</div>) : <p className="px-4 py-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>Adicione um alimento para começar esta refeição.</p>}
                  {!registered && planned && <div className="grid grid-cols-2 gap-2 border-t p-3" style={{ borderColor: 'var(--color-border)' }}><button onClick={() => logPlannedMeal(meal.key)} disabled={pendingAction === meal.key} className="rounded-lg py-2.5 text-xs font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>{pendingAction === meal.key ? 'Registrando…' : 'Comi conforme o plano'}</button><button onClick={() => { setActiveMealType(meal.key); setModalOpen(true) }} className="rounded-lg py-2.5 text-xs" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>Registrar diferente</button></div>}
                </div>}
              </article>
            })}</div>
          </section>
        </div>}

        {tab === 'history' && <div className="space-y-4">
          <section className="rounded-xl border bg-white p-4 sm:p-5" style={{ borderColor: 'var(--color-border)' }}><div className="mb-3 flex items-baseline justify-between"><h2 className="text-sm font-medium">Últimas 4 semanas</h2><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{daysInGoal} de {calendarLoggedDays.length} na meta</span></div><div className="grid grid-cols-7 gap-1.5"><>{calendarDays.slice(0, 7).map(day => <span key={`weekday-${day.value}`} className="text-center text-[11px] uppercase" style={{ color: 'var(--color-text-muted)' }}>{format(parseDate(day.value), 'EEEEE', { locale: ptBR })}</span>)}</>{calendarDays.map(day => <button key={day.value} onClick={() => day.day && setOpenHistory(openHistory === day.value ? null : day.value)} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border text-xs sm:aspect-auto sm:h-12" style={{ borderColor: day.value === date ? 'var(--color-primary)' : day.day ? 'var(--color-border)' : 'transparent', backgroundColor: day.value === date ? 'var(--color-primary-light)' : day.day ? '#fff' : 'transparent', color: day.value === date ? 'var(--color-primary)' : day.day ? 'var(--color-text)' : 'var(--color-border-strong)' }}><span>{format(parseDate(day.value), 'd')}</span><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: day.status?.color ?? 'transparent' }}/></button>)}</div><div className="mt-3 flex flex-wrap gap-3 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{[['Na meta', COLORS.protein], ['Abaixo', COLORS.fat], ['Acima', COLORS.alert]].map(([label,color]) => <span key={label} className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }}/>{label}</span>)}</div></section>
          <div className="flex gap-2 overflow-x-auto pb-1">{([['all','Todos'],['goal','Na meta'],['outside','Fora da meta']] as Array<[HistoryFilter,string]>).map(([value,label]) => <button key={value} onClick={() => { setHistoryFilter(value); setHistoryLimit(20) }} className="shrink-0 rounded-full border px-3.5 py-2 text-xs" style={{ borderColor: historyFilter === value ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: historyFilter === value ? 'var(--color-primary-light)' : '#fff', color: historyFilter === value ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>{label}</button>)}</div>
          {filteredHistory.length ? <section className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: 'var(--color-border)' }}>{visibleHistory.map(day => { const status = statusFor(day.calories, data.calorieGoal); const open = openHistory === day.date; return <article key={day.date} className="border-t first:border-t-0" style={{ borderColor: 'var(--color-border)' }}><button onClick={() => setOpenHistory(open ? null : day.date)} className="flex w-full items-center gap-3 px-4 py-3 text-left"><span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl" style={{ backgroundColor: status.bg, color: status.color }}><small className="text-[10px] uppercase">{format(parseDate(day.date), 'EEE', { locale: ptBR }).replace('.','')}</small><b className="text-sm">{format(parseDate(day.date), 'dd')}</b></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><b className="text-sm font-medium">{number(day.calories)} kcal</b><i className="rounded-full px-2 py-0.5 text-[10px] not-italic" style={{ backgroundColor: status.bg, color: status.color }}>{status.label}</i></span><span className="mt-1 block truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>{day.mealCount}/{MEALS.length} refeições · P {number(day.proteinG)} · C {number(day.carbsG)} · G {number(day.fatG)}</span></span><Chevron open={open}/></button>{open && <div className="px-4 pb-4 sm:pl-[4.5rem]"> <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>{day.mealLogs.map(log => { const sum = nutrition(log.items); return <div key={log.id} className="grid grid-cols-[100px_minmax(0,1fr)_70px] gap-2 border-t px-3 py-2 text-xs first:border-t-0" style={{ borderColor: 'var(--color-border)' }}><b className="font-medium">{mealMeta(log.mealType).label}</b><span className="truncate" style={{ color: 'var(--color-text-muted)' }}>{log.items.map(item => item.foodName).join(', ')}</span><span className="text-right tabular-nums">{number(sum.calories)} kcal</span></div>})}</div><div className="mt-3 flex flex-wrap gap-4 text-xs"><button onClick={() => copyHistoryDay(day.date)} disabled={pendingAction === day.date} className="font-medium disabled:opacity-50" style={{ color: 'var(--color-primary)' }}>{pendingAction === day.date ? 'Copiando…' : 'Copiar este dia para hoje'}</button><button onClick={() => saveHistoryAsTemplate(day.date)} disabled={pendingAction === `save-${day.date}`} style={{ color: 'var(--color-text-muted)' }}>{pendingAction === `save-${day.date}` ? 'Salvando…' : 'Salvar como cardápio'}</button></div></div>}</article>})}</section> : <div className="rounded-xl border p-10 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>Nenhum dia encontrado neste filtro.</div>}
          {visibleHistory.length < filteredHistory.length && <button onClick={() => setHistoryLimit(limit => limit + 20)} className="w-full rounded-xl border py-3 text-sm font-medium" style={{ borderColor: 'var(--color-primary)', backgroundColor: '#fff', color: 'var(--color-primary)' }}>Mostrar mais {Math.min(20, filteredHistory.length - visibleHistory.length)} dias</button>}
        </div>}

        {tab === 'plans' && <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.template && <article className="flex min-h-52 flex-col rounded-xl border bg-white" style={{ borderColor: 'var(--color-primary)' }}><div className="flex-1 p-5"><div className="mb-3 flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>✓</span><span className="rounded-full px-2 py-1 text-[10px]" style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>Cardápio salvo</span></div><h2 className="text-sm font-medium">{data.template.name}</h2><p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>{number(data.template.calorieGoal)} kcal · {data.template.meals.length} refeições</p>{(() => { const sum = nutrition(data.template!.meals.flatMap(meal => meal.items)); return <div className="mt-3 flex gap-3 text-xs"><span style={{ color: COLORS.protein }}>P {number(sum.proteinG)}g</span><span style={{ color: COLORS.carbs }}>C {number(sum.carbsG)}g</span><span style={{ color: COLORS.fat }}>G {number(sum.fatG)}g</span></div> })()}<p className="mt-3 line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{data.template.meals.flatMap(meal => meal.items).slice(0, 7).map(item => item.foodName).join(', ')}</p></div><div className="flex border-t" style={{ borderColor: 'var(--color-border)' }}><Link href="/app/ia?tab=diet" className="flex-1 border-r py-3 text-center text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>Editar</Link><button onClick={applyTemplate} disabled={pendingAction === 'template'} className="flex-1 py-3 text-xs font-medium disabled:opacity-50" style={{ color: 'var(--color-primary)' }}>{pendingAction === 'template' ? 'Aplicando…' : 'Aplicar para hoje'}</button></div></article>}
            <Link href="/app/ia?tab=diet" className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}><span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}><SparkIcon/></span><span><b className="block text-sm font-medium" style={{ color: 'var(--color-text)' }}>Gerar cardápio com IA</b><small className="mt-1 block text-xs">Baseado nas suas metas e alimentos frequentes</small></span></Link>
          </div>
          <section><div className="mb-2 flex items-baseline justify-between"><h2 className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Alimentos frequentes</h2><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>por 100 g/ml · histórico completo</span></div>{data.frequentFoods.length ? <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: 'var(--color-border)' }}>{data.frequentFoods.map(food => <div key={food.id} className="flex items-center gap-3 border-t px-4 py-3 first:border-t-0" style={{ borderColor: 'var(--color-border)' }}><div className="min-w-0 flex-1"><p className="truncate text-sm">{food.name}</p><p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{number(food.calories)} kcal · <span style={{ color: COLORS.protein }}>P {number(food.proteinG)}</span> · <span style={{ color: COLORS.carbs }}>C {number(food.carbsG)}</span> · <span style={{ color: COLORS.fat }}>G {number(food.fatG)}</span></p></div><span className="hidden text-xs sm:block" style={{ color: 'var(--color-text-muted)' }}>{food.times}x</span><button onClick={() => { setActiveMealType('SNACK'); setModalOpen(true) }} className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>+ <span className="hidden sm:inline">Adicionar</span></button></div>)}</div> : <div className="rounded-xl border p-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>Seus alimentos mais usados aparecerão aqui.</div>}</section>
        </div>}
      </>}

      {modalOpen && <FoodSearchModal mealType={activeMealType} date={date} onClose={() => setModalOpen(false)} onAdded={() => { setModalOpen(false); loadData() }} />}
      {editItem && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,.45)' }}><div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"><h2 className="mb-4 text-base font-medium">{editItem.foodName}</h2><label className="mb-1.5 block text-sm" style={{ color: 'var(--color-text-muted)' }}>Quantidade (g)</label><input type="number" min="1" step="5" value={editQty} onChange={event => setEditQty(event.target.value)} autoFocus className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: 'var(--color-border)' }}/><div className="mt-2 grid grid-cols-4 gap-2">{[50,100,150,200].map(value => <button key={value} onClick={() => setEditQty(String(value))} className="rounded-lg border py-1.5 text-xs" style={{ borderColor: editQty === String(value) ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: editQty === String(value) ? 'var(--color-primary-light)' : '#fff', color: editQty === String(value) ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>{value}g</button>)}</div><div className="mt-5 flex gap-2"><button onClick={() => setEditItem(null)} className="flex-1 rounded-lg border py-2.5 text-sm" style={{ borderColor: 'var(--color-border)' }}>Cancelar</button><button onClick={saveEdit} disabled={pendingAction === editItem.id} className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>{pendingAction === editItem.id ? 'Salvando…' : 'Salvar'}</button></div></div></div>}
    </div>
  )
}
