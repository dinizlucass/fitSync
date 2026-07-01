import { getMySubscription } from '@/app/actions/subscription'
import { PLANS } from '@/lib/asaas/config'
import AssinaturaClient from '@/components/subscription/AssinaturaClient'

export default async function AssinaturaPage() {
  const current = await getMySubscription()
  const plans = Object.values(PLANS)

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-medium mb-1">Assinatura</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Gerencie seu plano FitSync Premium.
      </p>
      <AssinaturaClient plans={plans} current={current} />
    </div>
  )
}
