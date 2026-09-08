import test from 'node:test'
import assert from 'node:assert/strict'
import { subscriptionGrantsAccess } from '../lib/subscription-status'
import { getPlan } from '../lib/asaas/config'

test('only paid or unexpired trial grants access', () => {
  const now = new Date('2026-09-07T12:00:00Z')
  assert.equal(subscriptionGrantsAccess(null, now), false)
  assert.equal(subscriptionGrantsAccess({ status: 'ACTIVE', trialEndsAt: null }, now), true)
  assert.equal(subscriptionGrantsAccess({ status: 'TRIALING', trialEndsAt: new Date('2026-09-08') }, now), true)
  for (const trialEndsAt of [null, now, new Date('2026-09-06'), new Date('invalid')]) assert.equal(subscriptionGrantsAccess({ status: 'TRIALING', trialEndsAt }, now), false)
  for (const status of ['PENDING', 'CANCELED', 'PAST_DUE', 'EXPIRED']) assert.equal(subscriptionGrantsAccess({ status, trialEndsAt: new Date('2027-01-01') }, now), false)
})

test('plan IDs cannot resolve inherited object properties', () => {
  assert.equal(getPlan('monthly')?.value, 29.9)
  assert.equal(getPlan('annual')?.trialDays, 0)
  for (const id of ['__proto__', 'constructor', 'toString', 'invalid']) assert.equal(getPlan(id), null)
})
