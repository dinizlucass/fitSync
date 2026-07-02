import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { getAdminStats, listUsers } from '@/app/actions/admin'
import AdminClient from '@/components/admin/AdminClient'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdminEmail(user.email)) redirect('/app/hoje')

  const [stats, users] = await Promise.all([getAdminStats(), listUsers()])

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-medium mb-1">Admin</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Gestão de usuários e assinaturas · logado como {user.email}
      </p>
      <AdminClient
        initialStats={'error' in stats ? null : stats}
        initialUsers={'error' in users ? [] : users}
      />
    </div>
  )
}
