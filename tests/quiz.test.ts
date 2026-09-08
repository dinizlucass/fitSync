import test from 'node:test'
import assert from 'node:assert/strict'
import { QUESTIONS, buildResult } from '../lib/quiz/config'
import { normalizeQuizPhone, quizLeadSchema, validateQuizAnswers } from '../lib/quiz/validation'

const base = Object.fromEntries(QUESTIONS.map(q => [q.id, q.type === 'multi' ? ['nenhuma'] : q.type === 'number' ? String(q.min! + 10) : q.options![0].value]))

for (const objective of ['emagrecer', 'massa', 'definir', 'saude']) {
  for (const place of ['academia', 'casa', 'arlivre', 'nada']) {
    for (const days of ['2', '3', '4', '5']) {
      test(`${objective} / ${place} / ${days} days produces a complete result`, () => {
        const checked = validateQuizAnswers({ ...base, objective, place, days, weight: '78.5', height: '175' })
        assert.ok(checked.answers, checked.error)
        const result = buildResult('Teste QA', checked.answers)
        assert.equal(result.split.days.length, Number(days))
        assert.ok(result.headline.includes('Teste'))
        for (const value of [result.calories, result.proteinG, result.carbsG, result.fatG]) assert.ok(Number.isFinite(value) && value >= 0)
        if (objective === 'saude') assert.equal(checked.answers.goalWeight, undefined)
        if (place === 'arlivre') assert.match(result.split.name, /ao ar livre/)
      })
    }
  }
}

test('rejects missing, malformed and out-of-range answers', () => {
  for (const raw of [null, [], {}, { ...base, objective: '__proto__' }, { ...base, weight: '78kg' }, { ...base, weight: 'Infinity' }, { ...base, height: '500' }, { ...base, restrictions: ['nenhuma', 'vegano'] }, { ...base, restrictions: ['vegano', 'vegano'] }]) {
    assert.ok(validateQuizAnswers(raw).error)
  }
})

test('accepts decimal comma and strips unknown answers', () => {
  const { answers } = validateQuizAnswers({ ...base, weight: '78,5', unexpected: 'ignored' })
  assert.equal(answers?.weight, '78.5')
  assert.equal(answers?.unexpected, undefined)
})

test('normalizes Brazilian mobile numbers without doubling DDI', () => {
  assert.equal(normalizeQuizPhone('(11) 98765-4321'), '5511987654321')
  assert.equal(normalizeQuizPhone('+55 (11) 98765-4321'), '5511987654321')
  assert.equal(normalizeQuizPhone('(55) 98765-4321'), '5555987654321')
  for (const phone of ['123', '11111111111', '11999999999', '+1 234 567 8901', '11 3456-7890']) assert.equal(normalizeQuizPhone(phone), null)
})

test('public lead payload rejects invalid types and oversized input', () => {
  assert.equal(quizLeadSchema.safeParse(null).success, false)
  assert.equal(quizLeadSchema.safeParse({ name: 42, whatsapp: [], answers: base }).success, false)
  assert.equal(quizLeadSchema.safeParse({ name: 'T'.repeat(101), whatsapp: '11987654321', answers: base }).success, false)
})
