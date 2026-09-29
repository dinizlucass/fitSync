import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'

export default function Alert({ title, children, tone = 'info' }: { title: string; children?: React.ReactNode; tone?: 'info' | 'warning' | 'danger' | 'success' }) {
  const colors = tone === 'danger' ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100' : tone === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100' : tone === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100' : 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100'
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertTriangle
  return <div role="alert" className={`flex gap-3 rounded-xl border p-4 ${colors}`}><Icon className="mt-0.5 h-4 w-4 shrink-0"/><div><p className="text-sm font-semibold">{title}</p>{children && <div className="mt-1 text-sm opacity-85">{children}</div>}</div></div>
}
