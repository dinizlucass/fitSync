import AppShell from '@/components/app/AppShell'
import SubscriptionGate from '@/components/subscription/SubscriptionGate'
import { SUBSCRIPTION_ENFORCED } from '@/lib/asaas/config'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { hasActiveSubscription } from '@/app/actions/subscription'
import { isAdminEmail } from '@/lib/admin'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Gate de assinatura — só roda quando explicitamente ligado (flag desligada por padrão)
  if (SUBSCRIPTION_ENFORCED) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    // Admin nunca é bloqueado pelo gate
    if (user && !isAdminEmail(user.email)) {
      const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } }).catch(() => null)
      if (dbUser && !(await hasActiveSubscription(dbUser.id))) {
        return (
          <AppShell>
            <SubscriptionGate />
          </AppShell>
        )
      }
    }
  }

  return <AppShell>{children}</AppShell>
}
