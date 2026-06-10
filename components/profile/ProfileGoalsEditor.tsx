'use client'

import { useState, useTransition } from 'react'
import { updateProfileAction } from '@/app/actions/profile'

const GOAL_OPTIONS = [
  { value: 'GAIN_MUSCLE', label: 'Ganhar massa' },
  { value: 'LOSE_FAT',    label: 'Perder gordura' },
  { value: 'RECOMPOSITION', label: 'Recomposição' },
  { value: 'MAINTAIN',   label: 'Manter peso' },
]

interface Props {
  name: string | null
  goalType: string
  calorieGoal: number | null
  proteinGoalG: number | null
  weightKg: number | null
}

export default function ProfileGoalsEditor({ name, goalType, calorieGoal, proteinGoalG, weightKg }: Props) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [formName, setFormName]           = useState(name ?? '')
  const [formGoal, setFormGoal]           = useState(goalType)
  const [formCalories, setFormCalories]   = useState(calorieGoal?.toString() ?? '')
  const [formProtein, setFormProtein]     = useState(proteinGoalG?.toString() ?? '')
  const [formWeight, setFormWeight]       = useState(weightKg?.toString() ?? '')

  const goalLabel = GOAL_OPTIONS.find(g => g.value === goalType)?.label ?? goalType

  function handleCancel() {
    setFormName(name ?? '')
    setFormGoal(goalType)
    setFormCalories(calorieGoal?.toString() ?? '')
    setFormProtein(proteinGoalG?.toString() ?? '')
    setFormWeight(weightKg?.toString() ?? '')
    setError(null)
    setEditing(false)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await updateProfileAction({
        name: formName || undefined,
        goalType: formGoal as 'GAIN_MUSCLE' | 'LOSE_FAT' | 'RECOMPOSITION' | 'MAINTAIN',
        calorieGoal: formCalories ? parseFloat(formCalories) : undefined,
        proteinGoalG: formProtein ? parseFloat(formProtein) : undefined,
        weightKg: formWeight ? parseFloat(formWeight) : undefined,
      })
      if (res.error) {
        setError(res.error)
      } else {
        setEditing(false)
      }
    })
  }

  return (
    <div className="rounded-xl p-5 mb-4 border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">Metas e objetivos</h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}
          >
            Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="text-xs px-3 py-1.5 rounded-lg border"
              style={{ borderColor: 'var(--color-border)' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs mb-3 p-2 rounded-lg" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>{error}</p>
      )}

      <div className="space-y-3">
        {/* Name */}
        <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nome</span>
          {editing ? (
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              className="text-sm text-right px-2 py-1 rounded-lg border outline-none w-40"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
            />
          ) : (
            <span className="text-sm">{name ?? '—'}</span>
          )}
        </div>

        {/* Goal */}
        <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Objetivo</span>
          {editing ? (
            <select
              value={formGoal}
              onChange={e => setFormGoal(e.target.value)}
              className="text-sm px-2 py-1 rounded-lg border outline-none"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
            >
              {GOAL_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <span className="text-sm">{goalLabel}</span>
          )}
        </div>

        {/* Calorie goal */}
        <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Meta calórica</span>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={formCalories}
                onChange={e => setFormCalories(e.target.value)}
                className="text-sm text-right px-2 py-1 rounded-lg border outline-none w-24"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
              />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>kcal</span>
            </div>
          ) : (
            <span className="text-sm">{calorieGoal ? `${Math.round(calorieGoal)} kcal` : '—'}</span>
          )}
        </div>

        {/* Protein goal */}
        <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Meta de proteína</span>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={formProtein}
                onChange={e => setFormProtein(e.target.value)}
                className="text-sm text-right px-2 py-1 rounded-lg border outline-none w-24"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
              />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>g</span>
            </div>
          ) : (
            <span className="text-sm">{proteinGoalG ? `${Math.round(proteinGoalG)}g` : '—'}</span>
          )}
        </div>

        {/* Weight */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Peso atual</span>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                value={formWeight}
                onChange={e => setFormWeight(e.target.value)}
                className="text-sm text-right px-2 py-1 rounded-lg border outline-none w-24"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
              />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>kg</span>
            </div>
          ) : (
            <span className="text-sm">{weightKg ? `${weightKg} kg` : '—'}</span>
          )}
        </div>
      </div>
    </div>
  )
}
