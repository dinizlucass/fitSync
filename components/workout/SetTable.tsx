'use client'

interface Set {
  setNumber: number
  weightKg: string
  reps: string
  isPR: boolean
}

interface SetTableProps {
  sets: Set[]
  targetReps: number
  lastSets: { weightKg: number | null; reps: number | null }[]
  onChange: (setIndex: number, field: 'weightKg' | 'reps', value: string) => void
  onAddSet: () => void
}

export default function SetTable({ sets, targetReps, lastSets, onChange, onAddSet }: SetTableProps) {
  return (
    <div>
      {/* Table header */}
      <div className="grid grid-cols-12 gap-2 text-xs mb-2 px-1" style={{ color: 'var(--color-text-muted)' }}>
        <span className="col-span-1">#</span>
        <span className="col-span-4">Peso (kg)</span>
        <span className="col-span-4">Reps</span>
        <span className="col-span-3 text-center">PR</span>
      </div>

      {sets.map((set, si) => (
        <div key={si} className="grid grid-cols-12 gap-2 items-center py-1.5">
          <span className="col-span-1 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {set.setNumber}
          </span>
          <div className="col-span-4">
            <input
              type="number"
              step="0.5"
              min="0"
              value={set.weightKg}
              onChange={e => onChange(si, 'weightKg', e.target.value)}
              placeholder={lastSets[si]?.weightKg?.toString() ?? '—'}
              className="w-full text-center text-sm py-1.5 rounded-lg border outline-none"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            />
          </div>
          <div className="col-span-4">
            <input
              type="number"
              min="0"
              value={set.reps}
              onChange={e => onChange(si, 'reps', e.target.value)}
              placeholder={targetReps.toString()}
              className="w-full text-center text-sm py-1.5 rounded-lg border outline-none"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            />
          </div>
          <div className="col-span-3 flex justify-center">
            {set.isPR ? (
              <span
                className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: '#fff8e1', color: 'var(--color-fat)' }}
              >
                PR!
              </span>
            ) : (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={onAddSet}
        className="mt-2 text-xs flex items-center gap-1 transition-colors"
        style={{ color: 'var(--color-primary)' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Adicionar série
      </button>
    </div>
  )
}
