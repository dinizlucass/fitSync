import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import SubmitButton from '@/components/professional/SubmitButton'
import { assignPatientAction, inviteProfessionalAction } from '@/app/actions/professional'
import { prisma } from '@/lib/prisma'
import { requireProfessionalAccess } from '@/lib/professional'

const field = 'w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-emerald-500'
const formAction = (action: (data: FormData) => Promise<unknown>) => action as unknown as (data: FormData) => Promise<void>

export default async function TeamPage() {
  const context = await requireProfessionalAccess()
  const members = await prisma.practiceMember.findMany({
    where: { practiceId: context.practiceId },
    include: { user: { include: { _count: { select: { professionalAssignments: true } } } } },
    orderBy: { createdAt: 'asc' },
  })
  return <main className="mx-auto max-w-5xl space-y-5 p-4 lg:p-8">
    <div><h1 className="text-2xl font-bold">Equipe e acessos</h1><p className="mt-1 text-sm text-zinc-500">Convites e vínculos da {context.practiceName}.</p></div>
    <Card><h2 className="font-semibold">Profissionais</h2><div className="mt-4 divide-y">{members.map((member) => <div key={member.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold">{member.user.name ?? member.user.email}</p><p className="text-xs text-zinc-500">{member.user.email} · {member.user._count.professionalAssignments} pacientes</p></div><Badge tone={member.active ? 'success' : 'neutral'}>{member.role}</Badge></div>)}</div></Card>
    {context.role === 'OWNER' && <div className="grid gap-5 lg:grid-cols-2">
      <Card><h2 className="font-semibold">Convidar profissional</h2><form action={formAction(inviteProfessionalAction)} className="mt-4 space-y-3"><input className={field} type="email" name="email" required placeholder="profissional@email.com"/><select className={field} name="role"><option value="NUTRITIONIST">Nutricionista</option><option value="TRAINER">Treinador</option></select><SubmitButton>Enviar convite</SubmitButton></form></Card>
      <Card><h2 className="font-semibold">Atribuir paciente</h2><form action={formAction(assignPatientAction)} className="mt-4 space-y-3"><input className={field} type="email" name="patientEmail" required placeholder="E-mail do paciente"/><input className={field} type="email" name="professionalEmail" required placeholder="E-mail do profissional"/><SubmitButton>Atribuir paciente</SubmitButton></form></Card>
    </div>}
  </main>
}
