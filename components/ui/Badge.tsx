import { clsx } from 'clsx'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  danger: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
}

export default function Badge({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold', toneClasses[tone], className)}>{children}</span>
}
