import assert from 'node:assert/strict'

const base = process.env.SMOKE_BASE_URL || 'http://localhost:3100'
const checks = [
  ['/', 200], ['/login?tab=signup', 200], ['/quiz', 200],
  ['/quiz/emagrecer', 200], ['/quiz/ganhar-massa', 200], ['/quiz/definir', 200], ['/quiz/saude', 200],
  ['/privacidade', 200], ['/termos', 200], ['/redefinir-senha', 200], ['/manifest.webmanifest', 200],
  ['/app/hoje', 307], ['/app/admin', 307], ['/app/assinatura', 307],
  ['/api/workouts', 401], ['/api/diet', 401], ['/api/progress', 401], ['/api/ai/insights', 401],
]
for (const [path, status] of checks) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(30000) })
  assert.equal(response.status, status, path)
  if (status === 307) assert.equal(new URL(response.headers.get('location'), base).pathname, '/login')
  console.log(`PASS ${status} ${path}`)
}
console.log(`${checks.length} smoke checks passed (no login, writes, payments or messages).`)
