'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveGoals } from '@/app/actions/profile'

type GoalType = 'GAIN_MUSCLE' | 'LOSE_FAT' | 'RECOMPOSITION' | 'MAINTAIN'
type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE'

const GOAL_OPTIONS: { key: GoalType; label: string; desc: string; icon: string }[] = [
  { key: 'GAIN_MUSCLE', label: 'Ganhar massa', desc: 'Aumentar massa muscular com superávit calórico', icon: '💪' },
  { key: 'LOSE_FAT', label: 'Perder gordura', desc: 'Reduzir gordura corporal com déficit calórico', icon: '🔥' },
  { key: 'RECOMPOSITION', label: 'Recomposição', desc: 'Perder gordura e ganhar músculo simultaneamente', icon: '⚡' },
  { key: 'MAINTAIN', label: 'Manter peso', desc: 'Manter composição corporal atual', icon: '⚖️' },
]

const ACTIVITY_OPTIONS: { key: ActivityLevel; label: string; desc: string }[] = [
  { key: 'SEDENTARY', label: 'Sedentário', desc: 'Pouco ou nenhum exercício' },
  { key: 'LIGHT', label: 'Levemente ativo', desc: 'Exercício 1-3 dias/semana' },
  { key: 'MODERATE', label: 'Moderadamente ativo', desc: 'Exercício 3-5 dias/semana' },
  { key: 'ACTIVE', label: 'Muito ativo', desc: 'Exercício 6-7 dias/semana' },
  { key: 'VERY_ACTIVE', label: 'Extremamente ativo', desc: 'Treino pesado 2x/dia' },
]

export default function MetasPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [goalType, setGoalType] = useState<GoalType>('MAINTAIN')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState<'male' | 'female'>('male')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('MODERATE')
  const [calculatedCalories, setCalculatedCalories] = useState<number | null>(null)
  const [calculatedProtein, setCalculatedProtein] = useState<number | null>(null)
  const [calculatedCarbs, setCalculatedCarbs] = useState<number | null>(null)
  const [calculatedFat, setCalculatedFat] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function goToStep(n: number) {
    if (n === 4) {
      // Calculate preview
      const w = parseFloat(weight)
      const h = parseFloat(height)
      if (!w || !h || !birthDate) return
      const age = new Date().getFullYear() - new Date(birthDate).getFullYear()
      const multipliers = { SEDENTARY: 1.2, LIGHT: 1.375, MODERATE: 1.55, ACTIVE: 1.725, VERY_ACTIVE: 1.9 }
      const bmr = sex === 'male'
        ? 10 * w + 6.25 * h - 5 * age + 5
        : 10 * w + 6.25 * h - 5 * age - 161
      const tdee = Math.round(bmr * multipliers[activityLevel])

      let calories = tdee
      let protein = Math.round(w * 1.8)
      if (goalType === 'LOSE_FAT') { calories = tdee - 400; protein = Math.round(w * 2.0) }
      else if (goalType === 'GAIN_MUSCLE') { calories = tdee + 250; protein = Math.round(w * 2.2) }
      else if (goalType === 'RECOMPOSITION') { protein = Math.round(w * 2.0) }

      const fat = Math.round((calories * 0.27) / 9)
      const carbs = Math.round((calories - protein * 4 - fat * 9) / 4)

      setCalculatedCalories(calories)
      setCalculatedProtein(protein)
      setCalculatedCarbs(Math.max(0, carbs))
      setCalculatedFat(fat)
    }
    setStep(n)
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      const result = await saveGoals({
        goalType,
        activityLevel,
        weightKg: parseFloat(weight),
        heightCm: parseFloat(height),
        birthDate,
        sex,
      })
      if (result.error) { setError(result.error); return }
      router.push('/app/hoje')
    } catch {
      setError('Erro ao salvar metas. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const steps = ['Objetivo', 'Dados', 'Atividade', 'Revisão']

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-medium mb-2">Configurar metas</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Vamos calcular suas metas personalizadas
      </p>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full h-1 rounded-full transition-colors"
              style={{ backgroundColor: i + 1 <= step ? 'var(--color-primary)' : 'var(--color-border)' }}
            />
            <span className="text-xs" style={{ color: i + 1 === step ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
              {s}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Goal type */}
      {step === 1 && (
        <div className="space-y-3">
          <h2 className="text-base font-medium mb-4">Qual é o seu objetivo?</h2>
          {GOAL_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setGoalType(opt.key)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all"
              style={{
                borderColor: goalType === opt.key ? 'var(--color-primary)' : 'var(--color-border)',
                backgroundColor: goalType === opt.key ? 'var(--color-primary-light)' : 'var(--color-background)',
              }}
            >
              <span className="text-2xl">{opt.icon}</span>
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{opt.desc}</p>
              </div>
            </button>
          ))}
          <button
            onClick={() => setStep(2)}
            className="w-full mt-4 text-sm py-3 px-4 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Continuar
          </button>
        </div>
      )}

      {/* Step 2: Body data */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-base font-medium mb-4">Seus dados corporais</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Sexo</label>
            <div className="flex gap-2">
              {['male', 'female'].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSex(s as 'male' | 'female')}
                  className="flex-1 py-2.5 text-sm rounded-lg border-2 transition-all font-medium"
                  style={{
                    borderColor: sex === s ? 'var(--color-primary)' : 'var(--color-border)',
                    backgroundColor: sex === s ? 'var(--color-primary-light)' : 'transparent',
                    color: sex === s ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  {s === 'male' ? 'Masculino' : 'Feminino'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Peso atual (kg)</label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="Ex: 75.5"
              className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Altura (cm)</label>
            <input
              type="number"
              value={height}
              onChange={e => setHeight(e.target.value)}
              placeholder="Ex: 175"
              className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Data de nascimento</label>
            <input
              type="date"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
              className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setStep(1)} className="flex-1 text-sm py-3 px-4 rounded-lg border transition-colors" style={{ borderColor: 'var(--color-border)' }}>
              Voltar
            </button>
            <button
              onClick={() => { if (weight && height && birthDate) setStep(3) }}
              disabled={!weight || !height || !birthDate}
              className="flex-1 text-sm py-3 px-4 rounded-lg text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Activity level */}
      {step === 3 && (
        <div>
          <h2 className="text-base font-medium mb-4">Nível de atividade física</h2>
          <div className="space-y-2 mb-6">
            {ACTIVITY_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setActivityLevel(opt.key)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all"
                style={{
                  borderColor: activityLevel === opt.key ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor: activityLevel === opt.key ? 'var(--color-primary-light)' : 'var(--color-background)',
                }}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{opt.desc}</p>
                </div>
                {activityLevel === opt.key && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 text-sm py-3 px-4 rounded-lg border transition-colors" style={{ borderColor: 'var(--color-border)' }}>
              Voltar
            </button>
            <button
              onClick={() => goToStep(4)}
              className="flex-1 text-sm py-3 px-4 rounded-lg text-white font-medium"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Revisar
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div>
          <h2 className="text-base font-medium mb-4">Suas metas calculadas</h2>
          <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Calorias/dia', value: calculatedCalories ? `${calculatedCalories} kcal` : '—' },
                { label: 'Proteína', value: calculatedProtein ? `${calculatedProtein}g` : '—' },
                { label: 'Carboidratos', value: calculatedCarbs ? `${calculatedCarbs}g` : '—' },
                { label: 'Gordura', value: calculatedFat ? `${calculatedFat}g` : '—' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{item.label}</p>
                  <p className="text-lg font-medium">{item.value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
              Calculado com a equação de Mifflin-St Jeor
            </p>
          </div>

          {error && (
            <p className="text-sm p-3 rounded-lg mb-4" style={{ backgroundColor: '#fef2f2', color: 'var(--color-alert)' }}>
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="flex-1 text-sm py-3 px-4 rounded-lg border transition-colors" style={{ borderColor: 'var(--color-border)' }}>
              Voltar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 text-sm py-3 px-4 rounded-lg text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {loading ? 'Salvando...' : 'Salvar metas'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
