import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  padding?: boolean
  hover?: boolean
}

export default function Card({ children, className, padding = true, hover = false, onClick, style, ...props }: CardProps) {
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
        ...style,
        backgroundColor: 'var(--color-background)',
        borderColor: 'var(--color-border)',
        borderRadius: 'var(--radius-card)',
      }}
      {...props}
    >
      {children}
    </div>
  )
}
