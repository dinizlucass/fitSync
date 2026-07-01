import { getMySubscription } from '@/app/actions/subscription'
import { PLANS } from '@/lib/asaas/config'
import AssinaturaClient from '@/components/subscription/AssinaturaClient'

/** Tela de bloqueio exibida quando SUBSCRIPTION_ENFORCED e o usuário não tem assinatura ativa. */
export default async function SubscriptionGate() {
  const current = await getMySubscription()
  const plans = Object.values(PLANS)
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-medium mb-4">Assinatura</h1>
      <AssinaturaClient plans={plans} current={current} gated />
    </div>
  )
}
