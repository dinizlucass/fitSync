import test from 'node:test'
import assert from 'node:assert/strict'
import { submitQuizLead } from '../app/actions/quiz'
import { updateMealItem, searchFoods } from '../app/actions/diet'

test('quiz server action rejects malformed payloads before headers, database or tracking', async () => {
  for (const payload of [null, {}, { name: 123, whatsapp: [] }, { name: 'Teste', whatsapp: '11987654321', answers: { objective: 'invalid' } }]) {
    const result = await submitQuizLead(payload as never)
    assert.ok(result.error)
    assert.equal(result.result, undefined)
    assert.equal(result.saved, undefined)
  }
})

test('meal action rejects invalid quantities before attempting a database write', async () => {
  for (const newQuantityG of [0, -1, NaN, Infinity, 5001]) {
    assert.deepEqual(await updateMealItem({ itemId: 'not-a-real-item', newQuantityG }), { error: 'Quantidade inválida' })
  }
})

test('food search rejects empty or oversized queries without database work', async () => {
  for (const query of ['', 'a', 'a'.repeat(101)]) assert.deepEqual(await searchFoods(query), [])
})
