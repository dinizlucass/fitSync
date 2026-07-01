import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProfileGoalsEditor from '@/components/profile/ProfileGoalsEditor'
import WhatsAppConnect from '@/components/profile/WhatsAppConnect'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { profile: true },
  }).catch(() => null)

  if (!dbUser) redirect('/app/dieta')

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

      {/* Goals — inline editable client component */}
      <ProfileGoalsEditor
        name={dbUser.name}
        goalType={dbUser.profile?.goalType ?? 'MAINTAIN'}
        calorieGoal={dbUser.profile?.calorieGoal ?? null}
        proteinGoalG={dbUser.profile?.proteinGoalG ?? null}
        weightKg={dbUser.profile?.weightKg ?? null}
      />

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
        <Link href="/app/assinatura" className="flex items-center justify-between p-4 border-b transition-colors hover:bg-gray-50 dark:hover:bg-gray-900" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </div>
            <span className="text-sm">Assinatura</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-muted)' }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>
        <WhatsAppConnect initialPhone={dbUser.phone} />
      </div>
    </div>
  )
}
