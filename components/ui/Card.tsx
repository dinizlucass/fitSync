import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
  hover?: boolean
  onClick?: () => void
}

export default function Card({ children, className, padding = true, hover = false, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={twMerge(
        clsx(
          'rounded-xl border',
          padding && 'p-5',
          hover && 'transition-shadow hover:shadow-md cursor-pointer',
          className
        )
      )}
      style={{
        backgroundColor: 'var(--color-background)',
        borderColor: 'var(--color-border)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      {children}
    </div>
  )
}
