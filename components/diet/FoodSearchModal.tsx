'use client'

import { useState, useEffect, useRef } from 'react'
import { addMealItem, searchFoods } from '@/app/actions/diet'
import { Skeleton } from '@/components/ui/Skeleton'

interface Food {
  id?: string
  name: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  servingSize: number
  servingUnit: string
}

interface FoodSearchModalProps {
  mealType: string
  date: string
  onClose: () => void
  onAdded: () => void
}

const RECENT_KEY = 'fitsync_recent_foods'
const MAX_RECENT = 8

function getRecentFoods(): Food[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Food[]
  } catch {
    return []
  }
}

function saveRecentFood(food: Food) {
  try {
    const current = getRecentFoods()
    const updated = [food, ...current.filter(f => f.name !== food.name)].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  } catch {}
}

export default function FoodSearchModal({ mealType, date, onClose, onAdded }: FoodSearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Feature 6 — Recent foods
  const [recentFoods, setRecentFoods] = useState<Food[]>([])

  useEffect(() => {
    setRecentFoods(getRecentFoods())
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const foods = await searchFoods(query)
        setResults(foods as Food[])
      } catch {}
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  function selectFood(food: Food) {
    setSelectedFood(food)
    setQuantity(food.servingSize.toString())
  }

  function calcNutrient(base: number, qty: number, serving: number) {
    return Math.round((base / serving) * qty * 10) / 10
  }

  async function handleAdd() {
    if (!selectedFood) return
    setAdding(true)
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) { setAdding(false); return }

    await addMealItem({
      foodId: selectedFood.id,
      foodName: selectedFood.name,
      mealType,
      date,
      quantityG: qty,
      calories: calcNutrient(selectedFood.calories, qty, selectedFood.servingSize),
      proteinG: calcNutrient(selectedFood.proteinG, qty, selectedFood.servingSize),
      carbsG: calcNutrient(selectedFood.carbsG, qty, selectedFood.servingSize),
      fatG: calcNutrient(selectedFood.fatG, qty, selectedFood.servingSize),
    })

    // Feature 6 — Update recent foods in localStorage
    saveRecentFood(selectedFood)

    setAdding(false)
    onAdded()
  }

  const qty = parseFloat(quantity) || 0
  const computedCalories = selectedFood ? calcNutrient(selectedFood.calories, qty, selectedFood.servingSize) : 0

  function FoodItem({ food, onSelect }: { food: Food; onSelect: () => void }) {
    return (
      <button
        onClick={onSelect}
        className="w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-900"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{food.name}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {food.calories} kcal / {food.servingSize}{food.servingUnit} · P {food.proteinG}g · C {food.carbsG}g · G {food.fatG}g
          </p>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-muted)' }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--color-background)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-sm font-medium">Adicionar alimento</h2>
          <button onClick={onClose} aria-label="Fechar" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto" style={{ minHeight: '340px', maxHeight: 'calc(90vh - 60px)' }}>
          {!selectedFood ? (
            <>
              {/* Search input */}
              <div className="relative mb-4">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-muted)' }}>
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar alimento..."
                  className="w-full text-sm pl-9 pr-3 py-2.5 rounded-lg border outline-none"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                />
              </div>

              {/* Feature 9 — Skeleton while searching */}
              {searching && (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              )}

              {/* Search results */}
              {!searching && results.length > 0 && (
                <div className="space-y-1">
                  {results.map((food, i) => (
                    <FoodItem key={i} food={food} onSelect={() => selectFood(food)} />
                  ))}
                </div>
              )}

              {!searching && query.length >= 2 && results.length === 0 && (
                <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
                  Nenhum alimento encontrado
                </p>
              )}

              {/* Feature 6 — Recent foods when query is empty */}
              {query.length < 2 && !searching && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Recentes</p>
                  {recentFoods.length === 0 ? (
                    <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
                      Nenhum alimento recente
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {recentFoods.map((food, i) => (
                        <FoodItem key={i} food={food} onSelect={() => selectFood(food)} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Food detail + quantity */}
              <button
                onClick={() => setSelectedFood(null)}
                className="flex items-center gap-2 text-sm mb-4"
                style={{ color: 'var(--color-primary)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Voltar
              </button>

              <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-inner)' }}>
                <h3 className="text-sm font-medium mb-3">{selectedFood.name}</h3>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div>
                    <div className="font-medium">{computedCalories}</div>
                    <div style={{ color: 'var(--color-text-muted)' }}>kcal</div>
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--color-primary)' }}>
                      {calcNutrient(selectedFood.proteinG, qty, selectedFood.servingSize)}g
                    </div>
                    <div style={{ color: 'var(--color-text-muted)' }}>Prot.</div>
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--color-carbs)' }}>
                      {calcNutrient(selectedFood.carbsG, qty, selectedFood.servingSize)}g
                    </div>
                    <div style={{ color: 'var(--color-text-muted)' }}>Carb.</div>
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--color-fat)' }}>
                      {calcNutrient(selectedFood.fatG, qty, selectedFood.servingSize)}g
                    </div>
                    <div style={{ color: 'var(--color-text-muted)' }}>Gord.</div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium mb-1.5">Quantidade (g)</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  min="1"
                  step="5"
                  className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                />
                <div className="flex gap-2 mt-2">
                  {[50, 100, 150, 200].map(q => (
                    <button
                      key={q}
                      onClick={() => setQuantity(q.toString())}
                      className="flex-1 text-xs py-1.5 rounded-lg border transition-colors"
                      style={{
                        borderColor: quantity === q.toString() ? 'var(--color-primary)' : 'var(--color-border)',
                        backgroundColor: quantity === q.toString() ? 'var(--color-primary-light)' : 'transparent',
                        color: quantity === q.toString() ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      {q}g
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleAdd}
                disabled={adding || !qty}
                className="w-full text-sm py-3 px-4 rounded-lg text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {adding ? 'Adicionando...' : `Adicionar ${qty ? `${qty}g` : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
