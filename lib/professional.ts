import { cache } from 'react'
import { AssignmentScope, Prisma, ProfessionalRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const PROFESSIONAL_PORTAL_ENABLED = process.env.PROFESSIONAL_PORTAL_ENABLED === 'true'

export type ProfessionalContext = {
  user: { id: string; supabaseId: string; email: string; name: string | null }
  practiceId: string
  practiceName: string
  role: ProfessionalRole
}

function ownerEmails() {
  return (process.env.PROFESSIONAL_OWNER_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

async function currentDbUser() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser?.email) return null

  return prisma.user.upsert({
    where: { supabaseId: authUser.id },
    update: { email: authUser.email },
    create: { supabaseId: authUser.id, email: authUser.email, name: typeof authUser.user_metadata?.name === 'string' ? authUser.user_metadata.name : null },
    select: { id: true, supabaseId: true, email: true, name: true },
  })
}

export const getProfessionalContext = cache(async (): Promise<ProfessionalContext | null> => {
  if (!PROFESSIONAL_PORTAL_ENABLED) return null
  const user = await currentDbUser()
  if (!user) return null

  let membership = await prisma.practiceMember.findFirst({
    where: { userId: user.id, active: true },
    include: { practice: true },
    orderBy: { createdAt: 'asc' },
  })

  // Bootstrap explícito somente para os e-mails configurados no ambiente.
  if (!membership && ownerEmails().includes(user.email.toLowerCase())) {
    membership = await prisma.$transaction(async (tx) => {
      const practice = await tx.practice.create({ data: { name: 'FitSync' } })
      return tx.practiceMember.create({
        data: { practiceId: practice.id, userId: user.id, role: 'OWNER' },
        include: { practice: true },
      })
    })
  }

  if (!membership) return null
  return {
    user,
    practiceId: membership.practiceId,
    practiceName: membership.practice.name,
    role: membership.role,
  }
})

export async function requireProfessionalAccess(patientId?: string, scope?: AssignmentScope) {
  const context = await getProfessionalContext()
  if (!context) throw new Error('Acesso profissional não autorizado.')
  if (!patientId) return context

  const assignment = await prisma.patientAssignment.findFirst({
    where: {
      practiceId: context.practiceId,
      patientId,
      active: true,
      ...(context.role === 'OWNER' ? {} : {
        professionalId: context.user.id,
        ...(scope ? { scopes: { has: scope } } : {}),
      }),
    },
    select: { id: true, scopes: true },
  })

  if (!assignment) throw new Error('Paciente não atribuído a este profissional.')
  if (context.role !== 'OWNER' && scope && !assignment.scopes.includes(scope)) {
    throw new Error('Seu vínculo não permite esta ação.')
  }
  return { ...context, assignment }
}

export async function writeClinicalAudit(input: {
  context: ProfessionalContext
  patientId: string
  action: string
  entityType: string
  entityId?: string
  metadata?: Record<string, unknown>
}) {
  await prisma.clinicalAuditLog.create({
    data: {
      practiceId: input.context.practiceId,
      actorId: input.context.user.id,
      patientId: input.patientId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  })
}

export function defaultScopesForRole(role: ProfessionalRole): AssignmentScope[] {
  if (role === 'TRAINER') return ['TRAINING', 'CLINICAL', 'MESSAGING', 'NOTES']
  return ['NUTRITION', 'CLINICAL', 'MESSAGING', 'NOTES']
}
