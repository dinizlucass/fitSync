'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { isAdminEmail } from '@/lib/admin'
import { dayRange } from '@/lib/coach/shared'
import { reportError } from '@/lib/monitoring'

/** Garante que quem chama é admin. Retorna null se não for. */
async function requireAdmin(): Promise<{ email: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return null
  return { email: user.email! }
}

// ─── Métricas do dashboard ─────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number
  newUsers7d: number
  phoneLinked: number
  subsTrialing: number
  subsActive: number
  subsPastDue: number
  mealsToday: number
  coachMsgsToday: number
}

export async function getAdminStats(): Promise<AdminStats | { error: string }> {
  if (!(await requireAdmin())) return { error: 'Acesso negado' }

  try {
    const { start, end } = dayRange()
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000)

    const [
      totalUsers, newUsers7d, phoneLinked,
      subsTrialing, subsActive, subsPastDue,
      mealsToday, coachMsgsToday,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { phone: { not: null } } }),
      prisma.subscription.count({ where: { status: 'TRIALING' } }).catch(() => 0),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
      prisma.subscription.count({ where: { status: 'PAST_DUE' } }).catch(() => 0),
      prisma.mealLog.count({ where: { date: { gte: start, lte: end } } }),
      prisma.chatMessage.count({ where: { role: 'user', createdAt: { gte: start, lte: end } } }).catch(() => 0),
    ])

    return {
      totalUsers, newUsers7d, phoneLinked,
      subsTrialing, subsActive, subsPastDue,
      mealsToday, coachMsgsToday,
    }
  } catch (e) {
    reportError('admin:getAdminStats', e)
    return { error: 'Erro ao carregar métricas. Verifique se as migrações SQL foram aplicadas.' }
  }
}

// ─── Listagem/busca de usuários ────────────────────────────────────────

export interface AdminUserRow {
  id: string
  name: string | null
  email: string
  phone: string | null
  createdAt: string
  subStatus: string | null
  subPlan: string | null
}

export async function listUsers(search?: string): Promise<AdminUserRow[] | { error: string }> {
  if (!(await requireAdmin())) return { error: 'Acesso negado' }

  try {
    const q = search?.trim()
    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q.replace(/\D/g, '') || q } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { subscription: true },
    })

    return users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      createdAt: u.createdAt.toISOString(),
      subStatus: u.subscription?.status ?? null,
      subPlan: u.subscription?.plan ?? null,
    }))
  } catch (e) {
    reportError('admin:listUsers', e)
    return { error: 'Erro ao carregar usuários. Verifique se as migrações SQL foram aplicadas.' }
  }
}

// ─── Premium manual (cortesia / revogar) ───────────────────────────────

export async function setPremium(userId: string, grant: boolean): Promise<{ success?: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Acesso negado' }

  try {
    if (grant) {
      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: 'monthly',
          status: 'ACTIVE',
          billingType: 'ADMIN',
          value: 0,
          cycle: 'MONTHLY',
          lastEvent: `ADMIN_GRANT:${admin.email}`,
        },
        update: { status: 'ACTIVE', lastEvent: `ADMIN_GRANT:${admin.email}` },
      })
    } else {
      await prisma.subscription.update({
        where: { userId },
        data: { status: 'CANCELED', lastEvent: `ADMIN_REVOKE:${admin.email}` },
      })
    }
    revalidatePath('/app/admin')
    return { success: true }
  } catch (e) {
    reportError('admin:setPremium', e, { userId, grant })
    return { error: 'Erro ao alterar assinatura' }
  }
}

// ─── Desvincular WhatsApp ──────────────────────────────────────────────

export async function adminUnlinkPhone(userId: string): Promise<{ success?: boolean; error?: string }> {
  if (!(await requireAdmin())) return { error: 'Acesso negado' }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { phone: null, phoneVerifyCode: null, phoneVerifyExpiresAt: null },
    })
    revalidatePath('/app/admin')
    return { success: true }
  } catch (e) {
    reportError('admin:unlinkPhone', e, { userId })
    return { error: 'Erro ao desvincular' }
  }
}

// ─── Criar usuário ─────────────────────────────────────────────────────

export async function adminCreateUser(params: {
  email: string
  password: string
  name?: string
}): Promise<{ success?: boolean; error?: string }> {
  if (!(await requireAdmin())) return { error: 'Acesso negado' }

  const email = params.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'E-mail inválido' }
  if (params.password.length < 6) return { error: 'Senha precisa de ao menos 6 caracteres' }

  try {
    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: params.password,
      email_confirm: true,
      user_metadata: params.name ? { name: params.name } : undefined,
    })
    if (error || !data.user) {
      return { error: error?.message ?? 'Erro no Supabase Auth' }
    }

    await prisma.user.create({
      data: { supabaseId: data.user.id, email, name: params.name ?? null },
    })

    revalidatePath('/app/admin')
    return { success: true }
  } catch (e) {
    reportError('admin:createUser', e, { email })
    return { error: e instanceof Error ? e.message : 'Erro ao criar usuário' }
  }
}

// ─── Excluir usuário (dados + conta de login) ──────────────────────────

export async function adminDeleteUser(userId: string): Promise<{ success?: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Acesso negado' }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return { error: 'Usuário não encontrado' }

    // Proteção: admin não se auto-exclui
    if (user.email.toLowerCase() === admin.email.toLowerCase()) {
      return { error: 'Você não pode excluir a própria conta de admin.' }
    }

    // 1. Dados do app (relations têm onDelete: Cascade)
    await prisma.user.delete({ where: { id: userId } })

    // 2. Conta de login no Supabase Auth (best-effort)
    try {
      const supabaseAdmin = createAdminClient()
      await supabaseAdmin.auth.admin.deleteUser(user.supabaseId)
    } catch (e) {
      reportError('admin:deleteAuthUser', e, { supabaseId: user.supabaseId })
      // dados já removidos; conta auth órfã será recriada vazia se logar de novo
    }

    revalidatePath('/app/admin')
    return { success: true }
  } catch (e) {
    reportError('admin:deleteUser', e, { userId })
    return { error: 'Erro ao excluir usuário' }
  }
}
