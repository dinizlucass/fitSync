import Link from 'next/link'
import type { ReactNode } from 'react'

export interface OnboardingStep {
  id: string
  title: string
  description: string
  href: string
  cta: string
  done: boolean
  icon: ReactNode
}

/**
 * Card "Primeiros passos" — checklist de onboarding na home.
 * Renderiza só enquanto houver passo pendente (a home decide quando mostrar);
 * cada passo se marca sozinho a partir do estado real do usuário.
 */
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const doneCount = steps.filter((s) => s.done).length
  const total = steps.length
  const pct = Math.round((doneCount / total) * 100)

  // Destaca o próximo passo pendente (chamada pra ação principal).
  const nextPendingId = steps.find((s) => !s.done)?.id

  return (
    <div
      className="rounded-xl p-5 mb-4"
      style={{
        backgroundColor: 'var(--color-background)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Header + progresso */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-base font-medium">Primeiros passos 🚀</h2>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Configure o essencial pra tirar o FitSync do papel
          </p>
        </div>
        <span
          className="text-xs font-medium whitespace-nowrap mt-0.5"
          style={{ color: 'var(--color-primary)' }}
        >
          {doneCount} de {total}
        </span>
      </div>

      <div
        className="h-1.5 rounded-full overflow-hidden mb-2"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: 'var(--color-primary)' }}
        />
      </div>

      {/* Passos */}
      <div>
        {steps.map((step, i) => {
          const isNext = step.id === nextPendingId
          return (
            <div
              key={step.id}
              className="flex items-center gap-3 py-3"
              style={i > 0 ? { borderTop: '1px solid var(--color-border)' } : undefined}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: step.done
                    ? 'var(--color-primary)'
                    : 'var(--color-primary-light)',
                }}
              >
                {step.done ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span style={{ color: 'var(--color-primary)', display: 'flex' }}>{step.icon}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium"
                  style={{
                    textDecoration: step.done ? 'line-through' : 'none',
                    color: step.done ? 'var(--color-text-muted)' : undefined,
                  }}
                >
                  {step.title}
                </p>
                {!step.done && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {step.description}
                  </p>
                )}
              </div>

              {step.done ? (
                <span
                  className="text-xs font-medium shrink-0"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Feito
                </span>
              ) : (
                <Link
                  href={step.href}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg shrink-0 transition-opacity hover:opacity-90"
                  style={
                    isNext
                      ? { backgroundColor: 'var(--color-primary)', color: '#fff' }
                      : {
                          backgroundColor: 'var(--color-surface)',
                          color: 'var(--color-primary)',
                          border: '1px solid var(--color-border)',
                        }
                  }
                >
                  {step.cta}
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
