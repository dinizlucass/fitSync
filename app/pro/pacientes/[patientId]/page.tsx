import { redirect } from 'next/navigation'
export default async function PatientIndex({ params }: { params: Promise<{ patientId: string }> }) { const { patientId } = await params; redirect(`/pro/pacientes/${patientId}/evolucao`) }
