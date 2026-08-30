import type { Metadata } from 'next'
import QuizFlow from '@/components/quiz/QuizFlow'
import { ANGLE_OBJECTIVE } from '@/lib/quiz/config'

export const metadata: Metadata = {
  title: 'Descubra seu plano — FitSync',
  description: 'Responda 2 minutos e receba um plano de treino e dieta personalizado, com coach por IA no WhatsApp.',
  robots: { index: false, follow: true }, // página de campanha: fora do índice
}

export default async function QuizPage({
  params,
}: {
  params: Promise<{ angle?: string[] }>
}) {
  const { angle } = await params
  const slug = angle?.[0]
  const presetObjective = slug ? ANGLE_OBJECTIVE[slug] : undefined

  return <QuizFlow presetObjective={presetObjective} />
}
