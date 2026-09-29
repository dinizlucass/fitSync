import { redirect } from 'next/navigation'
import ProfessionalShell from '@/components/professional/ProfessionalShell'
import { getProfessionalContext } from '@/lib/professional'
import { listAssignedPatients } from '@/lib/professional-data'

export const dynamic = 'force-dynamic'

export default async function ProfessionalLayout({ children }: { children: React.ReactNode }) {
  const context = await getProfessionalContext()
  if (!context) redirect('/app/hoje')
  const { items } = await listAssignedPatients({ take: 80 })
  return <ProfessionalShell patients={items} practiceName={context.practiceName} role={context.role}>{children}</ProfessionalShell>
}
