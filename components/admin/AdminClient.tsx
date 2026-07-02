'use client'

import { useState, useTransition } from 'react'
import {
  listUsers,
  setPremium,
  adminUnlinkPhone,
  adminCreateUser,
  adminDeleteUser,
  type AdminUserRow,
  type AdminStats,
} from '@/app/actions/admin'

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  TRIALING: { label: 'Trial', color: '#1D9E75', bg: '#E1F5EE' },
  ACTIVE: { label: 'Premium', color: '#1D9E75', bg: '#E1F5EE' },
  PAST_DUE: { label: 'Vencida', color: '#EF9F27', bg: '#FFF8E1' },
  PENDING: { label: 'Pendente', color: '#EF9F27', bg: '#FFF8E1' },
  CANCELED: { label: 'Cancelada', color: '#E24B4A', bg: '#FDECEC' },
  EXPIRED: { label: 'Expirada', color: '#E24B4A', bg: '#FDECEC' },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function AdminClient({
  initialStats,
  initialUsers,
}: {
  initialStats: AdminStats | null
  initialUsers: AdminUserRow[]
}) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function refresh(q?: string) {
    startTransition(async () => {
      const res = await listUsers(q ?? search)
      if (Array.isArray(res)) setUsers(res)
    })
  }

  function flash(text: string, isError = false) {
    if (isError) { setError(text); setMsg(null) } else { setMsg(text); setError(null) }
    setTimeout(() => { setMsg(null); setError(null) }, 4000)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    refresh()
  }

  function handleSetPremium(userId: string, grant: boolean) {
    startTransition(async () => {
      const res = await setPremium(userId, grant)
      if (res.error) return flash(res.error, true)
      flash(grant ? 'Premium concedido' : 'Premium revogado')
      refresh()
    })
  }

  function handleUnlink(userId: string) {
    startTransition(async () => {
      const res = await adminUnlinkPhone(userId)
      if (res.error) return flash(res.error, true)
      flash('WhatsApp desvinculado')
      refresh()
    })
  }

  function handleDelete(userId: string, email: string) {
    if (!confirm(`Excluir DEFINITIVAMENTE ${email}? Todos os dados (treinos, dieta, conversas) serão apagados.`)) return
    startTransition(async () => {
      const res = await adminDeleteUser(userId)
      if (res.error) return flash(res.error, true)
      flash('Usuário excluído')
      setExpanded(null)
      refresh()
    })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await adminCreateUser({ email: newEmail, password: newPassword, name: newName || undefined })
      if (res.error) return flash(res.error, true)
      flash(`Usuário ${newEmail} criado`)
      setShowCreate(false)
      setNewEmail(''); setNewPassword(''); setNewName('')
      refresh()
    })
  }

  const stats = initialStats

  return (
    <div>
      {/* Métricas */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Usuários', value: stats.totalUsers },
            { label: 'Novos (7d)', value: stats.newUsers7d },
            { label: 'WhatsApp ativo', value: stats.phoneLinked },
            { label: 'Premium ativos', value: stats.subsActive },
            { label: 'Em trial', value: stats.subsTrialing },
            { label: 'Vencidas', value: stats.subsPastDue },
            { label: 'Refeições hoje', value: stats.mealsToday },
            { label: 'Msgs coach hoje', value: stats.coachMsgsToday },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-card)' }}>
              <div className="text-xl font-medium">{s.value}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Busca + criar */}
      <div className="flex gap-2 mb-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por e-mail, nome ou telefone..."
            className="flex-1 text-sm px-3 py-2.5 rounded-lg border outline-none"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          />
          <button
            type="submit"
            disabled={isPending}
            className="text-sm px-4 py-2.5 rounded-lg border disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Buscar
          </button>
        </form>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="text-sm px-4 py-2.5 rounded-lg text-white font-medium"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          + Usuário
        </button>
      </div>

      {/* Form criar usuário */}
      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border p-4 mb-4 space-y-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)' }}>
          <p className="text-sm font-medium mb-1">Criar usuário</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="E-mail"
              className="text-sm px-3 py-2.5 rounded-lg border outline-none" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }} />
            <input type="text" required minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Senha (mín. 6)"
              className="text-sm px-3 py-2.5 rounded-lg border outline-none" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }} />
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome (opcional)"
              className="text-sm px-3 py-2.5 rounded-lg border outline-none" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }} />
          </div>
          <button type="submit" disabled={isPending} className="text-sm px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
            {isPending ? 'Criando...' : 'Criar (e-mail já confirmado)'}
          </button>
        </form>
      )}

      {/* Feedback */}
      {msg && <p className="text-sm mb-3" style={{ color: 'var(--color-primary)' }}>✓ {msg}</p>}
      {error && <p className="text-sm mb-3" style={{ color: 'var(--color-alert, #E24B4A)' }}>✗ {error}</p>}

      {/* Lista de usuários */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius-card)' }}>
        {users.length === 0 && (
          <p className="p-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhum usuário encontrado.</p>
        )}
        {users.map(u => {
          const badge = u.subStatus ? STATUS_BADGE[u.subStatus] : null
          const isOpen = expanded === u.id
          const isPremiumish = u.subStatus === 'ACTIVE' || u.subStatus === 'TRIALING'
          return (
            <div key={u.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
              <button
                onClick={() => setExpanded(isOpen ? null : u.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                  {(u.name ?? u.email)[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{u.name ?? '—'}</span>
                    {badge && (
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: badge.color, backgroundColor: badge.bg }}>
                        {badge.label}{u.subPlan === 'annual' ? ' · Anual' : ''}
                      </span>
                    )}
                    {u.phone && <span className="text-xs flex-shrink-0" title="WhatsApp vinculado">📱</span>}
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {u.email} · desde {fmtDate(u.createdAt)}
                  </p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ color: 'var(--color-text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {isOpen && (
                <div className="px-4 pb-3 flex flex-wrap gap-2" style={{ backgroundColor: 'var(--color-surface)' }}>
                  <div className="w-full text-xs pt-2 pb-1" style={{ color: 'var(--color-text-muted)' }}>
                    WhatsApp: {u.phone ?? 'não vinculado'} · Assinatura: {u.subStatus ?? 'nenhuma'}
                  </div>
                  {isPremiumish ? (
                    <button onClick={() => handleSetPremium(u.id, false)} disabled={isPending}
                      className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-fat, #EF9F27)' }}>
                      Revogar premium
                    </button>
                  ) : (
                    <button onClick={() => handleSetPremium(u.id, true)} disabled={isPending}
                      className="text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-50"
                      style={{ backgroundColor: 'var(--color-primary)' }}>
                      Dar premium (cortesia)
                    </button>
                  )}
                  {u.phone && (
                    <button onClick={() => handleUnlink(u.id)} disabled={isPending}
                      className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                      Desvincular WhatsApp
                    </button>
                  )}
                  <button onClick={() => handleDelete(u.id, u.email)} disabled={isPending}
                    className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50"
                    style={{ borderColor: 'var(--color-alert, #E24B4A)', color: 'var(--color-alert, #E24B4A)' }}>
                    Excluir usuário
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
        Mostrando até 50 usuários. Use a busca para encontrar contas específicas.
      </p>
    </div>
  )
}
