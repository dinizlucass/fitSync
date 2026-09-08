/** Trial expiry is checked locally even if a payment webhook is delayed. */
export function subscriptionGrantsAccess(sub: { status: string; trialEndsAt: Date | null } | null, now = new Date()): boolean {
  if (!sub) return false
  if (sub.status === 'ACTIVE') return true
  return sub.status === 'TRIALING' && sub.trialEndsAt !== null && sub.trialEndsAt.getTime() > now.getTime()
}
