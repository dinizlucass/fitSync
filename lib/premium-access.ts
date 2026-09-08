import { prisma } from '@/lib/prisma'
import { SUBSCRIPTION_ENFORCED } from '@/lib/asaas/config'
import { isAdminEmail } from '@/lib/admin'
import { subscriptionGrantsAccess } from '@/lib/subscription-status'

export const PREMIUM_REQUIRED = 'Ative sua assinatura em Configurações → Assinatura para continuar.'

/** Enforce at the operation boundary; hiding a page does not protect server actions. */
export async function canUsePremium(userId: string): Promise<boolean> {
  if (!SUBSCRIPTION_ENFORCED) return true
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { subscription: true } })
  return Boolean(user && (isAdminEmail(user.email) || subscriptionGrantsAccess(user.subscription)))
}

export async function canUsePremiumByAuthId(supabaseId: string): Promise<boolean> {
  if (!SUBSCRIPTION_ENFORCED) return true
  const user = await prisma.user.findUnique({ where: { supabaseId }, select: { id: true } })
  return Boolean(user && await canUsePremium(user.id))
}
