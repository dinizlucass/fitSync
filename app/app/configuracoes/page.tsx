import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { profile: true },
  }).catch(() => null)

  if (!dbUser) redirect('/app/hoje')

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-medium mb-6">Configurações</h1>

      {/* Profile info */}
      <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
        <h2 className="text-sm font-medium mb-4">Perfil</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
            {(dbUser.name ?? dbUser.email)?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{dbUser.name ?? 'Usuário'}</p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{dbUser.email}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nome</span>
            <span className="text-sm">{dbUser.name ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Email</span>
            <span className="text-sm">{dbUser.email}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>WhatsApp</span>
            <span className="text-sm">{dbUser.phone ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Goals summary */}
      {dbUser.profile && (
        <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">Metas e objetivos</h2>
            <Link href="/app/configuracoes/metas" className="text-xs" style={{ color: 'var(--color-primary)' }}>
              Editar
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Objetivo', value: {
                GAIN_MUSCLE: 'Ganhar massa',
                LOSE_FAT: 'Perder gordura',
                RECOMPOSITION: 'Recomposição',
                MAINTAIN: 'Manter peso',
              }[dbUser.profile.goalType] ?? dbUser.profile.goalType },
              { label: 'Meta calórica', value: dbUser.profile.calorieGoal ? `${Math.round(dbUser.profile.calorieGoal)} kcal` : '—' },
              { label: 'Proteína', value: dbUser.profile.proteinGoalG ? `${Math.round(dbUser.profile.proteinGoalG)}g` : '—' },
              { label: 'Peso atual', value: dbUser.profile.weightKg ? `${dbUser.profile.weightKg} kg` : '—' },
            ].map(item => (
              <div key={item.label} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{item.label}</p>
                <p className="text-sm font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Links */}
      <div className="rounded-xl border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-card)' }}>
        <Link href="/app/configuracoes/metas" className="flex items-center justify-between p-4 border-b transition-colors hover:bg-gray-50 dark:hover:bg-gray-900" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
              </svg>
            </div>
            <span className="text-sm">Metas e objetivos</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-muted)' }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>
        <div className="flex items-center justify-between p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f0fdf4' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <span className="text-sm">Conectar WhatsApp</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-muted)' }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </div>
  )
}
