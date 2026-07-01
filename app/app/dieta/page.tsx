'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import FoodSearchModal from '@/components/diet/FoodSearchModal'
import { removeMealItem, updateMealItem, copyMealsFromYesterday, getDietTemplatePreview, applyTemplateToTodayAction } from '@/app/actions/diet'
import type { TemplateMealPreview } from '@/app/actions/diet'
import { Skeleton } from '@/components/ui/Skeleton'

// ─── Meal types ────────────────────────────────────────────────────────────

const MEAL_TYPES = [
  {
    key: 'BREAKFAST',
    label: 'Café da manhã',
    time: '07:00',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
      </svg>
    ),
  },
  {
    key: 'LUNCH',
    label: 'Almoço',
    time: '12:30',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 11l19-9-9 19-2-8-8-2z"/>
      </svg>
    ),
  },
  {
    key: 'SNACK',
    label: 'Lanche',
    time: '15:30',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
        <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/>
        <line x1="14" y1="1" x2="14" y2="4"/>
      </svg>
    ),
  },
  {
    key: 'PRE_WORKOUT',
    label: 'Pré-treino',
    time: '17:00',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  },
  {
    key: 'DINNER',
    label: 'Jantar',
    time: '19:00',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    ),
  },
  {
    key: 'POST_WORKOUT',
    label: 'Pós-treino',
    time: '20:00',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6.5 6.5h11M6.5 17.5h11M4 12h16"/>
      </svg>
    ),
  },
  {
    key: 'CEIA',
    label: 'Ceia',
    time: '22:00',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>
      </svg>
    ),
  },
] as const

// ─── Types ─────────────────────────────────────────────────────────────────

interface MealItem {
  id: string
  foodName: string
  quantityG: number
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

interface MealLog {
  id: string
  mealType: string
  items: MealItem[]
}

interface DayData {
  mealLogs: MealLog[]
  calorieGoal: number
  proteinGoal: number
  carbsGoal: number
  fatGoal: number
}

interface EditItemState {
  id: string
  foodName: string
  currentQty: number
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function DietaPage() {
  const router = useRouter()
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [data, setData] = useState<DayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [activeMealType, setActiveMealType] = useState('')
  const [collapsedMeals, setCollapsedMeals] = useState<Set<string>>(() => new Set())
  const [templatePreview, setTemplatePreview] = useState<{ exists: boolean; calorieGoal?: number; meals?: TemplateMealPreview[] } | null>(null)
  const [templateExpanded, setTemplateExpanded] = useState(false)
  const [copyingYesterday, setCopyingYesterday] = useState(false)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [editItem, setEditItem] = useState<EditItemState | null>(null)
  const [editQty, setEditQty] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch(`/api/diet?date=${date}`)
      if (res.ok) {
        const d: DayData = await res.json()
        setData(d)
        // Auto-collapse empty meals
        const emptyKeys = MEAL_TYPES
          .filter(m => !d.mealLogs.find(l => l.mealType === m.key && l.items.length > 0))
          .map(m => m.key)
        setCollapsedMeals(new Set(emptyKeys))
      }
    } catch {}
    // Load template preview
    const preview = await getDietTemplatePreview()
    setTemplatePreview(preview)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [date])

  function changeDate(delta: number) {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setDate(format(d, 'yyyy-MM-dd'))
  }

  function toggleCollapse(key: string) {
    setCollapsedMeals(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleRemoveItem(itemId: string) {
    await removeMealItem(itemId)
    loadData()
  }

  function openEditItem(item: MealItem) {
    setEditItem({ id: item.id, foodName: item.foodName, currentQty: item.quantityG })
    setEditQty(item.quantityG.toString())
  }

  async function handleSaveEdit() {
    if (!editItem) return
    const qty = parseFloat(editQty)
    if (!qty || qty <= 0) return
    setSavingEdit(true)
    await updateMealItem({ itemId: editItem.id, newQuantityG: qty })
    setSavingEdit(false)
    setEditItem(null)
    loadData()
  }

  async function handleApplyTemplate() {
    setApplyingTemplate(true)
    const res = await applyTemplateToTodayAction(date)
    setApplyingTemplate(false)
    if (res.success) {
      setTemplateExpanded(false)
      loadData()
    }
  }

  async function handleCopyFromYesterday() {
    setCopyingYesterday(true)
    const res = await copyMealsFromYesterday(date)
    setCopyingYesterday(false)
    setCopyMsg(res.success
      ? `${res.copied} item${res.copied !== 1 ? 's' : ''} copiado${res.copied !== 1 ? 's' : ''} de ontem`
      : (res.error ?? 'Erro ao copiar'))
    if (res.success) loadData()
    setTimeout(() => setCopyMsg(null), 3000)
  }

  function getMealItems(mealType: string): MealItem[] {
    return data?.mealLogs.find(l => l.mealType === mealType)?.items ?? []
  }

  function getMealCalories(mealType: string) {
    return getMealItems(mealType).reduce<number>((s, i) => s + i.calories, 0)
  }

  const allItems = data?.mealLogs.flatMap(l => l.items) ?? []
  const totalCalories = allItems.reduce<number>((s, i) => s + i.calories, 0)
  const totalProtein  = allItems.reduce<number>((s, i) => s + i.proteinG, 0)
  const totalCarbs    = allItems.reduce<number>((s, i) => s + i.carbsG, 0)
  const totalFat      = allItems.reduce<number>((s, i) => s + i.fatG, 0)

  const calorieGoal = data?.calorieGoal ?? 0
  const caloriePct  = calorieGoal > 0 ? (totalCalories / calorieGoal) * 100 : 0
  const exceeded    = calorieGoal > 0 && totalCalories > calorieGoal
  const isToday     = date === format(new Date(), 'yyyy-MM-dd')

  const macros = [
    { label: 'Proteína', val: totalProtein, goal: data?.proteinGoal ?? 0, color: 'var(--color-primary)' },
    { label: 'Carbos',   val: totalCarbs,   goal: data?.carbsGoal ?? 0,   color: '#378ADD' },
    { label: 'Gordura',  val: totalFat,     goal: data?.fatGoal ?? 0,     color: '#EF9F27' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto pb-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-medium">Dieta</h1>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          >
            <button onClick={() => changeDate(-1)} className="p-0.5" style={{ color: 'var(--color-text-muted)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
              {isToday ? 'Hoje' : format(new Date(date + 'T12:00:00'), 'dd/MM')}
            </span>
            <button onClick={() => changeDate(1)} className="p-0.5" style={{ color: 'var(--color-text-muted)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
          <button
            onClick={() => router.push('/app/ia?tab=diet')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-medium"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Gerar cardápio
          </button>
        </div>
      </div>

      {/* Summary card — BUG 1 FIX: use --color-surface not --color-background */}
      <div
        className="rounded-xl p-5 mb-4 border"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-card)' }}
      >
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Consumido</div>
            <div className="text-2xl font-medium">
              {Math.round(totalCalories)}
              <span className="text-sm font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>kcal</span>
            </div>
          </div>
          <div className="text-right">
            {/* BUG 4 FIX: show — while data is null */}
            {data ? (
              <>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {exceeded ? 'Excedido' : 'Restam'}
                </div>
                <div className="text-base font-medium" style={{ color: exceeded ? 'var(--color-alert, #E24B4A)' : 'var(--color-primary)' }}>
                  {exceeded
                    ? `+${Math.round(totalCalories - calorieGoal)} kcal`
                    : `${Math.round(calorieGoal - totalCalories)} kcal`}
                </div>
              </>
            ) : (
              <div className="text-base font-medium" style={{ color: 'var(--color-text-muted)' }}>—</div>
            )}
          </div>
        </div>

        {/* Calorie bar */}
        <div className="h-2 rounded-full overflow-hidden mb-4" style={{ backgroundColor: 'var(--color-border)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, caloriePct)}%`,
              backgroundColor: exceeded ? 'var(--color-alert, #E24B4A)' : 'var(--color-primary)',
            }}
          />
        </div>

        {/* Macros */}
        <div className="grid grid-cols-3 gap-3">
          {macros.map(m => (
            <div key={m.label} className="text-center">
              <div className="text-sm font-medium" style={{ color: m.color }}>{Math.round(m.val)}g</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{m.label}</div>
              {/* Melhoria 2: mini progress bar */}
              <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${m.goal > 0 ? Math.min(100, (m.val / m.goal) * 100) : 0}%`,
                    backgroundColor: m.color,
                  }}
                />
              </div>
              {/* BUG 4 FIX: show — while data is null */}
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                / {data ? `${m.goal}g` : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleCopyFromYesterday}
          disabled={copyingYesterday}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors disabled:opacity-50"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          {copyingYesterday ? 'Copiando...' : 'Copiar de ontem'}
        </button>
        {copyMsg && (
          <span
            className="text-xs"
            style={{ color: copyMsg.startsWith('Erro') || copyMsg.startsWith('Nenhuma') ? 'var(--color-alert, #E24B4A)' : 'var(--color-primary)' }}
          >
            {copyMsg}
          </span>
        )}
      </div>

      {/* Template card — expandable preview, shown only when today has no food */}
      {templatePreview?.exists && allItems.length === 0 && (
        <div
          className="rounded-xl mb-4 border overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-card)' }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#E1F5EE' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium">Cardápio padrão salvo</div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {templatePreview.calorieGoal ? `${templatePreview.calorieGoal} kcal` : ''} · {templatePreview.meals?.length ?? 0} refeições
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleApplyTemplate}
                disabled={applyingTemplate}
                className="text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {applyingTemplate ? 'Aplicando...' : 'Aplicar para hoje'}
              </button>
              <button
                onClick={() => setTemplateExpanded(e => !e)}
                className="w-7 h-7 flex items-center justify-center rounded-lg"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ transform: templateExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Expandable meal preview */}
          {templateExpanded && templatePreview.meals && templatePreview.meals.length > 0 && (
            <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
              {templatePreview.meals.map((meal, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between px-4 py-2.5 border-b last:border-b-0"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{meal.mealName}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {meal.itemNames.join(', ')}{meal.itemCount > 3 ? ` +${meal.itemCount - 3}` : ''}
                    </div>
                    <div className="flex gap-2 mt-1 text-xs">
                      <span style={{ color: 'var(--color-primary)' }}>P {meal.proteinG}g</span>
                      <span style={{ color: '#378ADD' }}>C {meal.carbsG}g</span>
                      <span style={{ color: '#EF9F27' }}>G {meal.fatG}g</span>
                    </div>
                  </div>
                  <div className="text-sm font-medium ml-4 flex-shrink-0">{meal.calories} kcal</div>
                </div>
              ))}
              <div className="px-4 py-3">
                <button
                  onClick={handleApplyTemplate}
                  disabled={applyingTemplate}
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {applyingTemplate ? 'Aplicando...' : 'Aplicar todas as refeições para hoje'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Meal sections */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {MEAL_TYPES.map(({ key, label, icon, time }) => {
            const items = getMealItems(key)
            const mealCal = getMealCalories(key)
            const collapsed = collapsedMeals.has(key)
            const hasItems = items.length > 0

            return (
              <div
                key={key}
                className="rounded-xl border overflow-hidden"
                /* BUG 1 FIX: --color-surface for meal cards */
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-card)' }}
              >
                {/* Meal header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-primary)' }}
                  >
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{time}</span>
                    </div>
                    {/* Melhoria 2: kcal por refeição */}
                    {mealCal > 0 && (
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {Math.round(mealCal)} kcal · {items.length} item{items.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setActiveMealType(key); setModalOpen(true) }}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
                      style={{ color: 'var(--color-primary)', backgroundColor: '#E1F5EE' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Adicionar
                    </button>
                    {hasItems && (
                      <button
                        onClick={() => toggleCollapse(key)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <svg
                          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}
                        >
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Items */}
                {!collapsed && hasItems && (
                  <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    {items.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => openEditItem(item)}
                            className="text-sm text-left w-full hover:underline truncate block"
                          >
                            {item.foodName}
                          </button>
                          {/* Melhoria 2: macro inline */}
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {Math.round(item.quantityG)}g
                            <span className="mx-1">·</span>
                            {Math.round(item.calories)} kcal
                            <span className="mx-1">·</span>
                            <span style={{ color: 'var(--color-primary)' }}>P {Math.round(item.proteinG)}g</span>
                            <span className="mx-1">·</span>
                            <span style={{ color: '#378ADD' }}>C {Math.round(item.carbsG)}g</span>
                            <span className="mx-1">·</span>
                            <span style={{ color: '#EF9F27' }}>G {Math.round(item.fatG)}g</span>
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {modalOpen && (
        <FoodSearchModal
          mealType={activeMealType}
          date={date}
          onClose={() => setModalOpen(false)}
          onAdded={() => { setModalOpen(false); loadData() }}
        />
      )}

      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-xl p-6 shadow-xl" style={{ backgroundColor: 'var(--color-surface)' }}>
            <h2 className="text-base font-medium mb-4">{editItem.foodName}</h2>
            <div className="mb-4">
              <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Quantidade (g)</label>
              <input
                type="number" min="1" step="5"
                value={editQty}
                onChange={e => setEditQty(e.target.value)}
                autoFocus
                className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
              />
              <div className="flex gap-2 mt-2">
                {[50, 100, 150, 200].map(q => (
                  <button
                    key={q}
                    onClick={() => setEditQty(q.toString())}
                    className="flex-1 text-xs py-1.5 rounded-lg border"
                    style={{
                      borderColor: editQty === q.toString() ? 'var(--color-primary)' : 'var(--color-border)',
                      backgroundColor: editQty === q.toString() ? '#E1F5EE' : 'transparent',
                      color: editQty === q.toString() ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    }}
                  >
                    {q}g
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditItem(null)}
                className="flex-1 text-sm py-2.5 rounded-lg border"
                style={{ borderColor: 'var(--color-border)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 text-sm py-2.5 rounded-lg text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {savingEdit ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
