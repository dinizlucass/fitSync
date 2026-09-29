import { redirect } from 'next/navigation'
import Alert from '@/components/ui/Alert'
import { listAssignedPatients } from '@/lib/professional-data'

export const dynamic = 'force-dynamic'

export default async function ProfessionalHome() {
  const { items } = await listAssignedPatients({ take: 1 })
  if (items[0]) redirect(`/pro/pacientes/${items[0].id}/evolucao`)
  return <main className="mx-auto max-w-3xl p-8"><Alert title="Nenhum paciente atribuído">Use “Equipe e acessos” para vincular um paciente a um profissional.</Alert></main>
}
