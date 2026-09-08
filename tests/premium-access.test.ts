import test from 'node:test'
import assert from 'node:assert/strict'

test('premium boundary checks subscription and server-side admin identity', async (t) => {
  process.env.SUBSCRIPTION_ENFORCED = 'true'
  process.env.ADMIN_EMAILS = 'admin@example.test'
  const { prisma } = await import('../lib/prisma')
  const { canUsePremium, canUsePremiumByAuthId } = await import('../lib/premium-access')
  let row: unknown = null
  const original = prisma.user.findUnique
  prisma.user.findUnique = (async () => row) as unknown as typeof original
  t.after(() => { prisma.user.findUnique = original })
  assert.equal(await canUsePremium('missing'), false)
  assert.equal(await canUsePremiumByAuthId('missing'), false)
  row = { id: 'test', email: 'customer@example.test', subscription: null }
  assert.equal(await canUsePremium('test'), false)
  row = { id: 'test', email: 'customer@example.test', subscription: { status: 'TRIALING', trialEndsAt: new Date(0) } }
  assert.equal(await canUsePremium('test'), false)
  row = { id: 'test', email: 'customer@example.test', subscription: { status: 'ACTIVE', trialEndsAt: null } }
  assert.equal(await canUsePremiumByAuthId('test'), true)
  row = { id: 'test', email: 'admin@example.test', subscription: null }
  assert.equal(await canUsePremium('test'), true)
  prisma.user.findUnique = (async () => { throw new Error('DB offline') }) as unknown as typeof original
  await assert.rejects(canUsePremium('test'), /DB offline/)
})
