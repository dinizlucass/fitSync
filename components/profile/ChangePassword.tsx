'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ChangePassword() {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    if (password.length < 6) { setError('A senha deve ter no mínimo 6 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(
        error.message.toLowerCase().includes('should be different')
          ? 'A nova senha precisa ser diferente da atual.'
          : 'Erro ao alterar a senha. Tente novamente.'
      )
      return
    }
    setSuccess(true)
    setPassword('')
    setConfirm('')
    setTimeout(() => { setSuccess(false); setOpen(false) }, 2500)
  }

  return (
    <div className="p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-primary-light)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Senha</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {success ? 'Senha alterada com sucesso ✓' : 'Altere a senha da sua conta'}
          </p>
        </div>
        <button
          onClick={() => { setOpen(v => !v); setError(null) }}
          className="text-xs px-3 py-1.5 rounded-lg border flex-shrink-0"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}
        >
          {open ? 'Fechar' : 'Alterar'}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2">
          <div className="grid sm:grid-cols-2 gap-2">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Nova senha (mín. 6)"
              required
              minLength={6}
              autoFocus
              className="text-sm px-3 py-2.5 rounded-lg border outline-none"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            />
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirmar nova senha"
              required
              minLength={6}
              className="text-sm px-3 py-2.5 rounded-lg border outline-none"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            />
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--color-alert, #E24B4A)' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="text-sm px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      )}
    </div>
  )
}
