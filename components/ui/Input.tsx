import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={twMerge(
            clsx(
              'w-full text-sm px-3 py-2.5 rounded-lg border outline-none transition-colors',
              error && 'border-red-400',
              className
            )
          )}
          style={{
            borderColor: error ? 'var(--color-alert)' : 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
          {...props}
        />
        {error && (
          <p className="text-xs" style={{ color: 'var(--color-alert)' }}>{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
