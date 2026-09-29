import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateAttention } from '../lib/professional-data'

const now = Date.now()
test('prioriza exame alterado sobre outros sinais', () => {
  assert.equal(calculateAttention({ abnormalExam: true, lastActivity: new Date(now), adherence: 1, nextAppointment: null }).priority, 'CRITICAL')
})

test('marca ausência de registro por sete dias como crítica', () => {
  const result = calculateAttention({ abnormalExam: false, lastActivity: new Date(now - 8 * 86400000), adherence: 1, nextAppointment: null })
  assert.deepEqual(result, { priority: 'CRITICAL', reason: 'Sem registros há 7 dias' })
})

test('marca baixa aderência e tendência oposta como atenção', () => {
  assert.equal(calculateAttention({ abnormalExam: false, lastActivity: new Date(now), adherence: 0.4, nextAppointment: null }).priority, 'WARNING')
  assert.equal(calculateAttention({ abnormalExam: false, lastActivity: new Date(now), adherence: 1, nextAppointment: null, trend: 'OPPOSITE' }).priority, 'WARNING')
})

test('marca consulta próxima como informação', () => {
  assert.equal(calculateAttention({ abnormalExam: false, lastActivity: new Date(now), adherence: 1, nextAppointment: new Date(now + 86400000) }).priority, 'INFO')
})
