import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

type Variant = 'primary' | 'outline' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: React.ReactNode
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: { backgroundColor: 'var(--color-primary)', color: 'white' },
  outline: { backgroundColor: 'transparent', border: '1px solid var(--color-border)' },
  ghost: { backgroundColor: 'transparent' },
}

const sizeClasses: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 rounded-lg',
  md: 'text-sm px-4 py-2.5 rounded-lg',
  lg: 'text-sm px-6 py-3 rounded-lg',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed',
          sizeClasses[size],
          className
        )
      )}
      style={variantStyles[variant]}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  )
}
