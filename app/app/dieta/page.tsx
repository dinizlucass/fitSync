'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import FoodSearchModal from '@/components/diet/FoodSearchModal'
import { removeMealItem, updateMealItem } from '@/app/actions/diet'
import { Skeleton } from '@/components/ui/Skeleton'

const MEAL_TYPES = [
  { key: 'BREAKFAST', label: 'Café da manhã' },
  { key: 'LUNCH', label: 'Almoço' },
  { key: 'DINNER', label: 'Jantar' },
  { key: 'SNACK', label: 'Lanche' },
  { key: 'PRE_WORKOUT', label: 'Pré-treino' },
  { key: 'POST_WORKOUT', label: 'Pós-treino' },
] as const

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

export default function DietaPage() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [data, setData] = useState<DayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [activeMealType, setActiveMealType] = useState<string>('')

  // Feature 5 — Edit meal item
  const [editItem, setEditItem] = useState<EditItemState | null>(null)
  const [editQty, setEditQty] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch(`/api/diet?date=${date}`)
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadData() }, [date])

  function openModal(mealType: string) {
    setActiveMealType(mealType)
    setModalOpen(true)
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

  function getMealItems(mealType: string): MealItem[] {
    if (!data) return []
    const log = data.mealLogs.find(l => l.mealType === mealType)
    return log?.items ?? []
  }

  function getMealCalories(mealType: string) {
    return getMealItems(mealType).reduce((s, i) => s + i.calories, 0)
  }

  const totalCalories = data?.mealLogs.flatMap(l => l.items).reduce((s, i) => s + i.calories, 0) ?? 0
  const totalProtein = data?.mealLogs.flatMap(l => l.items).reduce((s, i) => s + i.proteinG, 0) ?? 0
  const totalCarbs = data?.mealLogs.flatMap(l => l.items).reduce((s, i) => s + i.carbsG, 0) ?? 0
  const totalFat = data?.mealLogs.flatMap(l => l.items).reduce((s, i) => s + i.fatG, 0) ?? 0

  const calorieGoal = data?.calorieGoal ?? 2000
  const caloriePct = Math.min(100, (totalCalories / calorieGoal) * 100)

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Dieta</h1>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
        />
      </div>

      {/* Calorie progress */}
      <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Calorias</span>
          <span>
            <span className="font-medium">{Math.round(totalCalories)}</span>
            <span style={{ color: 'var(--color-text-muted)' }}> / {Math.round(calorieGoal)} kcal</span>
          </span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${caloriePct}%`, backgroundColor: caloriePct > 100 ? 'var(--color-alert)' : 'var(--color-primary)' }}
          ></div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Proteína', val: totalProtein, goal: data?.proteinGoal ?? 150, color: 'var(--color-primary)' },
            { label: 'Carboidratos', val: totalCarbs, goal: data?.carbsGoal ?? 200, color: 'var(--color-carbs)' },
            { label: 'Gordura', val: totalFat, goal: data?.fatGoal ?? 65, color: 'var(--color-fat)' },
          ].map(m => (
            <div key={m.label} className="text-center">
              <div className="text-sm font-medium" style={{ color: m.color }}>{Math.round(m.val)}g</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{m.label}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/ {m.goal}g</div>
            </div>
          ))}
        </div>
      </div>

      {/* Meal sections */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {MEAL_TYPES.map(({ key, label }) => {
            const items = getMealItems(key)
            const mealCalories = getMealCalories(key)
            return (
              <div key={key} className="rounded-xl border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-card)' }}>
                <div className="flex items-center justify-between p-4">
                  <div>
                    <h3 className="text-sm font-medium">{label}</h3>
                    {mealCalories > 0 && (
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{Math.round(mealCalories)} kcal</p>
                    )}
                  </div>
                  <button
                    onClick={() => openModal(key)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Adicionar
                  </button>
                </div>
                {items.length > 0 && (
                  <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    {items.map(item => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex-1 min-w-0">
                          {/* Feature 5: click food name to edit quantity */}
                          <button
                            onClick={() => openEditItem(item)}
                            className="text-sm truncate text-left w-full hover:underline transition-colors"
                            style={{ color: 'inherit' }}
                          >
                            {item.foodName}
                          </button>
                          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {item.quantityG}g · {Math.round(item.calories)} kcal · P {Math.round(item.proteinG)}g · C {Math.round(item.carbsG)}g · G {Math.round(item.fatG)}g
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center ml-2 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                          style={{ color: 'var(--color-alert)' }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
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

      {/* Food search modal */}
      {modalOpen && (
        <FoodSearchModal
          mealType={activeMealType}
          date={date}
          onClose={() => setModalOpen(false)}
          onAdded={() => { setModalOpen(false); loadData() }}
        />
      )}

      {/* Feature 5 — Edit quantity modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-xl p-6 shadow-xl" style={{ backgroundColor: 'var(--color-background)' }}>
            <h2 className="text-base font-medium mb-4">{editItem.foodName}</h2>
            <div className="mb-4">
              <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Quantidade (g)</label>
              <input
                type="number"
                min="1"
                step="5"
                value={editQty}
                onChange={e => setEditQty(e.target.value)}
                autoFocus
                className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              />
              <div className="flex gap-2 mt-2">
                {[50, 100, 150, 200].map(q => (
                  <button
                    key={q}
                    onClick={() => setEditQty(q.toString())}
                    className="flex-1 text-xs py-1.5 rounded-lg border transition-colors"
                    style={{
                      borderColor: editQty === q.toString() ? 'var(--color-primary)' : 'var(--color-border)',
                      backgroundColor: editQty === q.toString() ? 'var(--color-primary-light)' : 'transparent',
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
