'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ChevronLeft, Menu, Search, ShieldCheck, Users, X } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import type { PatientListItem } from '@/lib/professional-data'

const priorityTone = { CRITICAL: 'danger', WARNING: 'warning', INFO: 'info', REGULAR: 'success' } as const
const priorityLabel = { CRITICAL: 'Crítico', WARNING: 'Atenção', INFO: 'Informação', REGULAR: 'Regular' } as const

export default function ProfessionalShell({ children, patients, practiceName, role }: {
  children: React.ReactNode
  patients: PatientListItem[]
  practiceName: string
  role: string
}) {
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState('ALL')
  const [open, setOpen] = useState(false)
  const visible = useMemo(() => patients.filter((patient) => {
    const match = `${patient.name} ${patient.email} ${patient.phone ?? ''}`.toLowerCase().includes(query.toLowerCase())
    return match && (priority === 'ALL' || patient.priority === priority)
  }), [patients, priority, query])

  const sidebar = <>
    <div className="border-b p-5" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between gap-3">
        <Link href="/pro" className="text-xl font-bold tracking-tight">Fit<span style={{ color: 'var(--color-primary)' }}>Sync</span> <span className="text-xs font-semibold text-zinc-500">PRO</span></Link>
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar pacientes"><X className="h-5 w-5"/></button>
      </div>
      <p className="mt-1 truncate text-xs text-zinc-500">{practiceName} · {role}</p>
      <div className="relative mt-4"><Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar paciente" className="w-full rounded-lg border bg-transparent py-2 pl-9 pr-3 text-sm outline-none" style={{ borderColor: 'var(--color-border)' }}/></div>
      <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-xs" style={{ borderColor: 'var(--color-border)' }}>
        <option value="ALL">Todas as prioridades</option><option value="CRITICAL">Crítico</option><option value="WARNING">Atenção</option><option value="INFO">Informação</option><option value="REGULAR">Regular</option>
      </select>
    </div>
    <div className="flex-1 overflow-y-auto p-3">
      {visible.length === 0 && <div className="p-5 text-center text-sm text-zinc-500"><Users className="mx-auto mb-2 h-6 w-6"/>Nenhum paciente encontrado.</div>}
      {visible.map((patient) => {
        const active = pathname.includes(`/pacientes/${patient.id}`)
        return <Link key={patient.id} href={`/pro/pacientes/${patient.id}/evolucao`} onClick={() => setOpen(false)} className={`mb-2 block rounded-xl border p-3 transition ${active ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'}`} style={active ? undefined : { borderColor: 'var(--color-border)' }}>
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{patient.name}</p><p className="truncate text-xs text-zinc-500">{patient.goal}</p></div><Badge tone={priorityTone[patient.priority]}>{priorityLabel[patient.priority]}</Badge></div>
          <p className="mt-2 text-[11px] text-zinc-500">{patient.priorityReason}</p>
        </Link>
      })}
    </div>
    <div className="border-t p-3" style={{ borderColor: 'var(--color-border)' }}>
      <Link href="/pro/equipe" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"><ShieldCheck className="h-4 w-4"/>Equipe e acessos</Link>
      <Link href="/app/hoje" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"><ChevronLeft className="h-4 w-4"/>Área do paciente</Link>
    </div>
  </>

  return <div className="min-h-screen bg-zinc-50 dark:bg-black">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[340px] flex-col border-r bg-white dark:bg-zinc-950 lg:flex" style={{ borderColor: 'var(--color-border)' }}>{sidebar}</aside>
    {open && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Fechar" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)}/><aside className="relative flex h-full w-[min(340px,90vw)] flex-col bg-white dark:bg-zinc-950">{sidebar}</aside></div>}
    <div className="lg:pl-[340px]">
      <div className="sticky top-0 z-20 flex h-14 items-center border-b bg-white/95 px-4 backdrop-blur dark:bg-zinc-950/95 lg:hidden" style={{ borderColor: 'var(--color-border)' }}><button onClick={() => setOpen(true)} className="mr-3 rounded-lg border p-2" aria-label="Abrir pacientes"><Menu className="h-5 w-5"/></button><span className="font-semibold">Painel profissional</span></div>
      {children}
    </div>
  </div>
}
