'use client'

import { useState, useTransition } from 'react'
import { startPhoneVerification, getLinkedPhone, unlinkPhone } from '@/app/actions/profile'

function formatPhone(digits: string): string {
  // 5511963122174 → +55 (11) 96312-2174 (best-effort)
  const m = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/)
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${digits}`
}

export default function WhatsAppConnect({ initialPhone }: { initialPhone: string | null }) {
  const [linked, setLinked] = useState<string | null>(initialPhone)
  const [code, setCode] = useState<string | null>(null)
  const [botNumber, setBotNumber] = useState<string | null>(null)
  const [expiresInMin, setExpiresInMin] = useState<number>(15)
  const [error, setError] = useState<string | null>(null)
  const [checkMsg, setCheckMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleStart() {
    setError(null)
    setCheckMsg(null)
    startTransition(async () => {
      const res = await startPhoneVerification()
      if (res.error) { setError(res.error); return }
      setCode(res.code ?? null)
      setBotNumber(res.botNumber ?? null)
      setExpiresInMin(res.expiresInMin ?? 15)
    })
  }

  function handleCheck() {
    setError(null)
    startTransition(async () => {
      const res = await getLinkedPhone()
      if (res.phone) {
        setLinked(res.phone)
        setCode(null)
        setCheckMsg(null)
      } else {
        setCheckMsg('Ainda não recebi seu código. Envie a mensagem no WhatsApp e tente de novo.')
      }
    })
  }

  function handleUnlink() {
    if (!confirm('Desvincular seu número do WhatsApp?')) return
    setError(null)
    startTransition(async () => {
      const res = await unlinkPhone()
      if (res.error) { setError(res.error); return }
      setLinked(null)
      setCode(null)
    })
  }

  const waLink = code && botNumber
    ? `https://wa.me/${botNumber}?text=${encodeURIComponent(code)}`
    : null

  return (
    <div className="p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f0fdf4' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">WhatsApp</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {linked ? `Vinculado: ${formatPhone(linked)}` : 'Registre treinos e refeições por mensagem'}
          </p>
        </div>
        {linked && !code && (
          <button
            onClick={handleUnlink}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-lg border flex-shrink-0 disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            Desvincular
          </button>
        )}
        {!linked && !code && (
          <button
            onClick={handleStart}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0 text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {isPending ? '...' : 'Conectar'}
          </button>
        )}
      </div>

      {/* Passo a passo com o código gerado */}
      {code && (
        <div className="mt-3 rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Envie este código pelo <span className="font-medium">seu WhatsApp</span> para o número do FitSync
            {botNumber ? ` (${formatPhone(botNumber)})` : ''}. Vale por {expiresInMin} min.
          </p>
          <div
            className="text-center text-xl font-medium tracking-widest py-2.5 rounded-lg mb-3 select-all"
            style={{ backgroundColor: 'var(--color-background)', border: '1px dashed var(--color-border)' }}
          >
            {code}
          </div>
          <div className="flex gap-2">
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="flex-1 text-center text-sm py-2.5 rounded-lg text-white font-medium"
                style={{ backgroundColor: '#22c55e' }}
              >
                Abrir WhatsApp
              </a>
            )}
            <button
              onClick={handleCheck}
              disabled={isPending}
              className="flex-1 text-sm py-2.5 rounded-lg border font-medium disabled:opacity-50"
              style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
            >
              {isPending ? 'Verificando...' : 'Já enviei'}
            </button>
          </div>
          {checkMsg && <p className="text-xs mt-2" style={{ color: 'var(--color-fat, #EF9F27)' }}>{checkMsg}</p>}
          <button
            onClick={() => { setCode(null); setCheckMsg(null) }}
            className="text-xs mt-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Cancelar
          </button>
        </div>
      )}

      {error && <p className="text-xs mt-2" style={{ color: 'var(--color-alert, #E24B4A)' }}>{error}</p>}
    </div>
  )
}
