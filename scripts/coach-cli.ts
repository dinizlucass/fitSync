/**
 * Test rig do Coach Sync — roda o coach REAL contra o banco real, fora do WhatsApp.
 *
 * Uso:
 *   npx tsx scripts/coach-cli.ts "qual o treino de hoje?"
 *   npx tsx scripts/coach-cli.ts --scenarios          # roda a bateria read-only
 *   COACH_TEST_USER_ID=<id> npx tsx scripts/coach-cli.ts "..."   # força um usuário
 *
 * Pré-requisitos: npm i -D tsx  (dotenv já está no projeto).
 *
 * ⚠️ AVISOS
 * - Isto chama OpenAI de verdade (custa tokens) e lê/escreve no Supabase de produção.
 * - A bateria --scenarios é READ-ONLY de propósito (não registra refeição/treino).
 *   Mensagens livres que você passar podem disparar tools de ESCRITA (registrar_*).
 * - runCoach persiste o turno em chat_messages (memória). Use um usuário de teste
 *   via COACH_TEST_USER_ID se não quiser sujar a conta real.
 */
import 'dotenv/config'
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' }) // sobrepõe com .env.local se existir
loadEnv({ path: '.env' })

import { prisma } from '@/lib/prisma'
import { runCoach } from '@/lib/coach/coach'

const READONLY_SCENARIOS = [
  'qual o treino de hoje?',
  'quais treinos eu tenho disponível',
  'hoje comi pouco, como faço pra bater minha proteína?',
  'não tô a fim de treinar hoje',
  'quanto de proteína eu já comi hoje?',
  'tô desanimado, tá valendo a pena?',
  'me explica como funciona o app', // testa quando NÃO há tool
]

async function resolveUserId(): Promise<string | null> {
  if (process.env.COACH_TEST_USER_ID) return process.env.COACH_TEST_USER_ID
  // pega o primeiro usuário com telefone cadastrado (o caso real de WhatsApp)
  const u = await prisma.user.findFirst({
    where: { phone: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, phone: true },
  })
  if (u) {
    console.log(`\n[usuário de teste] ${u.name ?? 'sem nome'} | phone=${u.phone} | id=${u.id}`)
    return u.id
  }
  const any = await prisma.user.findFirst({ select: { id: true, name: true } })
  if (any) console.log(`\n[usuário de teste — sem phone] ${any.name ?? 'sem nome'} | id=${any.id}`)
  return any?.id ?? null
}

async function ask(userId: string, message: string) {
  console.log('\n──────────────────────────────────────────────')
  console.log(`👤 ${message}`)
  const t0 = Date.now()
  try {
    const reply = await runCoach({ userId, message, channel: 'app' })
    console.log(`🤖 ${reply}`)
    console.log(`   ⏱  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  } catch (e) {
    console.error('   ❌ ERRO:', e instanceof Error ? e.message : e)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const userId = await resolveUserId()
  if (!userId) {
    console.error('Nenhum usuário encontrado no banco. Crie um ou passe COACH_TEST_USER_ID.')
    process.exit(1)
  }

  if (args[0] === '--scenarios' || args.length === 0) {
    console.log('\n=== BATERIA READ-ONLY (cada mensagem é uma conversa nova, sem memória entre elas) ===')
    for (const s of READONLY_SCENARIOS) {
      await ask(userId, s)
    }
  } else {
    await ask(userId, args.join(' '))
  }

  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
