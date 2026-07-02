'use client'

/**
 * Destino do link de redefinição de senha (e-mail do Supabase).
 * O createBrowserClient troca automaticamente o ?code= da URL por uma sessão
 * (detectSessionInUrl). Aqui só esperamos a sessão aparecer e trocamos a senha.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const supabase = createClient()

  const [ready, setReady] = useState(false)      // sessão de recovery estabelecida
  const [invalid, setInvalid] = useState(false)  // link inválido/expirado
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // A troca do code por sessão é assíncrona — tenta algumas vezes antes de
    // declarar o link inválido.
    let attempts = 0
    const timer = setInterval(async () => {
      attempts++
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setReady(true)
        clearInterval(timer)
      } else if (attempts >= 6) {
        setInvalid(true)
        clearInterval(timer)
      }
    }, 500)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) { setError('A senha deve ter no mínimo 6 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(
        error.message.toLowerCase().includes('should be different')
          ? 'A nova senha precisa ser diferente da atual.'
          : 'Erro ao redefinir a senha. Tente novamente ou peça um novo link.'
      )
      return
    }
    setDone(true)
    setTimeout(() => { router.push('/app/hoje'); router.refresh() }, 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-medium tracking-tight">
            <span className="text-black dark:text-white">Fit</span>
            <span style={{ color: 'var(--color-primary)' }}>Sync</span>
          </span>
          <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>Redefinir senha</p>
        </div>

        <div className="rounded-xl p-6 shadow-sm border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-card)' }}>
          {invalid ? (
            <div className="text-center">
              <p className="text-sm mb-4" style={{ color: 'var(--color-alert, #E24B4A)' }}>
                Link inválido ou expirado.
              </p>
              <a href="/login" className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
                Pedir um novo link →
              </a>
            </div>
          ) : done ? (
            <div className="text-center">
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-primary)' }}>✓ Senha alterada!</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Entrando no app...</p>
            </div>
          ) : !ready ? (
            <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>Validando link...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5">Nova senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  autoFocus
                  className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Confirmar nova senha</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repita a senha"
                  required
                  minLength={6}
                  className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
                />
              </div>
              {error && (
                <p className="text-xs p-3 rounded-lg" style={{ backgroundColor: '#fef2f2', color: 'var(--color-alert, #E24B4A)' }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full text-sm py-2.5 px-4 rounded-lg text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
