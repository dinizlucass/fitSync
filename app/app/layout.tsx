'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const navItems = [
  {
    href: '/app/hoje',
    label: 'Início',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/app/treino',
    label: 'Treino',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 20V10M12 20V4M6 20v-6"/>
      </svg>
    ),
  },
  {
    href: '/app/dieta',
    label: 'Dieta',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a3 3 0 0 0-3 3v4H6a3 3 0 0 0 0 6h1v4a3 3 0 0 0 6 0v-4h1a3 3 0 0 0 0-6h-3V5a3 3 0 0 0-3-3z"/>
      </svg>
    ),
  },
  {
    href: '/app/progresso',
    label: 'Progresso',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    href: '/app/ia',
    label: 'IA',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1a7 7 0 0 1-7 7H9a7 7 0 0 1-7-7H1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
      </svg>
    ),
  },
  {
    href: '/app/configuracoes',
    label: 'Config.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      </svg>
    ),
  },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden" style={{ backgroundColor: 'var(--color-surface)' }}>
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col w-56 border-r flex-shrink-0" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-lg font-medium tracking-tight">
            <span className="text-black dark:text-white">Fit</span>
            <span style={{ color: 'var(--color-primary)' }}>Sync</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/app/hoje' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--color-primary-light)' : 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User + logout */}
        <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
              {(user?.user_metadata?.name?.[0] ?? user?.email?.[0])?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.user_metadata?.name || 'Usuário'}</p>
              <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t z-50 flex items-center pb-[env(safe-area-inset-bottom)]" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/app/hoje' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
              style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
            >
              {item.icon}
              <span className="text-xs">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
