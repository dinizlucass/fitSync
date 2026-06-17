'use client'

import { useState, useTransition } from 'react'
import { updatePhone } from '@/app/actions/profile'

export default function WhatsAppConnect({ initialPhone }: { initialPhone: string | null }) {
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(initialPhone)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await updatePhone(phone)
      if (res.error) {
        setError(res.error)
      } else {
        setSaved(res.phone ?? phone)
        setEditing(false)
      }
    })
  }

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
            {saved ? `Vinculado: ${saved}` : 'Registre treinos e refeições por mensagem'}
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-3 py-1.5 rounded-lg border flex-shrink-0"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}
          >
            {saved ? 'Alterar' : 'Conectar'}
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3">
          <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Número com DDI + DDD (ex: 5511999999999)
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="5511999999999"
              autoFocus
              className="flex-1 text-sm px-3 py-2.5 rounded-lg border outline-none"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            />
            <button
              onClick={handleSave}
              disabled={isPending}
              className="text-sm px-4 py-2.5 rounded-lg text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => { setEditing(false); setError(null); setPhone(saved ?? '') }}
              className="text-sm px-3 py-2.5 rounded-lg border"
              style={{ borderColor: 'var(--color-border)' }}
            >
              Cancelar
            </button>
          </div>
          {error && <p className="text-xs mt-2" style={{ color: 'var(--color-alert, #E24B4A)' }}>{error}</p>}
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Depois de salvar, envie uma mensagem para o número do FitSync no WhatsApp para registrar treinos e refeições.
          </p>
        </div>
      )}
    </div>
  )
}
