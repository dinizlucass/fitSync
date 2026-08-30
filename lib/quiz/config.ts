/**
 * Quiz de captação (funil de tráfego pago). Define as perguntas e o "motor" que
 * monta um resultado personalizado a partir das respostas — macros calculados
 * (mesma fórmula do app) + diagnóstico e treino que dão match com cada objetivo,
 * local e dor. Determinístico e sem custo de IA por visita.
 */
import {
  calculateTDEE, calculateMacros,
  type ActivityLevel, type GoalType,
} from '@/lib/calculations'

export type Objective = 'emagrecer' | 'massa' | 'definir' | 'saude'

export interface QuizOption {
  value: string
  label: string
  /** emoji/ícone opcional pra opções visuais */
  emoji?: string
}

export interface QuizQuestion {
  id: string
  title: string
  subtitle?: string
  type: 'single' | 'multi' | 'number'
  options?: QuizOption[]
  /** para type 'number' */
  unit?: string
  min?: number
  max?: number
  placeholder?: string
  /** esconde a pergunta quando o predicado for verdadeiro (ex.: peso meta em "saúde") */
  skipIf?: (a: QuizAnswers) => boolean
}

export type QuizAnswers = Record<string, string | string[]>

// ─── Perguntas ─────────────────────────────────────────────────────────────
export const QUESTIONS: QuizQuestion[] = [
  {
    id: 'objective',
    title: 'Qual é o seu principal objetivo?',
    subtitle: 'Escolha o que mais importa pra você agora',
    type: 'single',
    options: [
      { value: 'emagrecer', label: 'Emagrecer', emoji: '🔥' },
      { value: 'massa', label: 'Ganhar massa', emoji: '💪' },
      { value: 'definir', label: 'Definir o corpo', emoji: '✨' },
      { value: 'saude', label: 'Mais saúde e disposição', emoji: '🌱' },
    ],
  },
  {
    id: 'sex',
    title: 'Qual é o seu sexo biológico?',
    subtitle: 'Usamos para calcular suas metas com precisão',
    type: 'single',
    options: [
      { value: 'male', label: 'Masculino' },
      { value: 'female', label: 'Feminino' },
      { value: 'na', label: 'Prefiro não dizer' },
    ],
  },
  {
    id: 'age',
    title: 'Qual é a sua faixa de idade?',
    type: 'single',
    options: [
      { value: '21', label: '18 a 24 anos' },
      { value: '30', label: '25 a 34 anos' },
      { value: '40', label: '35 a 44 anos' },
      { value: '50', label: '45 anos ou mais' },
    ],
  },
  {
    id: 'height',
    title: 'Qual é a sua altura?',
    type: 'number',
    unit: 'cm',
    min: 130,
    max: 230,
    placeholder: 'Ex: 175',
  },
  {
    id: 'weight',
    title: 'Qual é o seu peso atual?',
    type: 'number',
    unit: 'kg',
    min: 35,
    max: 250,
    placeholder: 'Ex: 78',
  },
  {
    id: 'goalWeight',
    title: 'Qual peso você quer alcançar?',
    subtitle: 'Uma meta realista te ajuda a manter o foco',
    type: 'number',
    unit: 'kg',
    min: 35,
    max: 250,
    placeholder: 'Ex: 72',
    skipIf: (a) => a.objective === 'saude',
  },
  {
    id: 'place',
    title: 'Onde você treina (ou pretende treinar)?',
    type: 'single',
    options: [
      { value: 'academia', label: 'Academia', emoji: '🏋️' },
      { value: 'casa', label: 'Em casa', emoji: '🏠' },
      { value: 'arlivre', label: 'Ao ar livre', emoji: '🌳' },
      { value: 'nada', label: 'Ainda não treino', emoji: '🚀' },
    ],
  },
  {
    id: 'days',
    title: 'Quantos dias por semana você tem?',
    type: 'single',
    options: [
      { value: '2', label: '2 dias' },
      { value: '3', label: '3 dias' },
      { value: '4', label: '4 dias' },
      { value: '5', label: '5 ou mais' },
    ],
  },
  {
    id: 'restrictions',
    title: 'Você tem alguma restrição alimentar?',
    subtitle: 'Pode marcar mais de uma',
    type: 'multi',
    options: [
      { value: 'nenhuma', label: 'Nenhuma' },
      { value: 'vegetariano', label: 'Vegetariano' },
      { value: 'vegano', label: 'Vegano' },
      { value: 'lactose', label: 'Sem lactose' },
      { value: 'gluten', label: 'Sem glúten' },
    ],
  },
  {
    id: 'pain1',
    title: 'O que mais te trava hoje?',
    type: 'single',
    options: [
      { value: 'tempo', label: 'Falta de tempo' },
      { value: 'comojazer', label: 'Não sei montar treino e dieta' },
      { value: 'desisto', label: 'Começo e desisto no meio' },
      { value: 'acompanhamento', label: 'Falta de acompanhamento' },
    ],
  },
  {
    id: 'pain2',
    title: 'Já tentou antes e desistiu por quê?',
    type: 'single',
    options: [
      { value: 'complicado', label: 'Era complicado demais' },
      { value: 'semresultado', label: 'Não via resultado' },
      { value: 'semmotivacao', label: 'Perdi a motivação' },
      { value: 'nuncasegui', label: 'Nunca segui de verdade' },
    ],
  },
]

/** Rota de ângulo (/quiz/emagrecer) → objetivo pré-selecionado. */
export const ANGLE_OBJECTIVE: Record<string, Objective> = {
  emagrecer: 'emagrecer',
  'ganhar-massa': 'massa',
  massa: 'massa',
  definir: 'definir',
  saude: 'saude',
}

// ─── Motor de resultado ──────────────────────────────────────────────────
const OBJ_TO_GOAL: Record<Objective, GoalType> = {
  emagrecer: 'LOSE_FAT',
  massa: 'GAIN_MUSCLE',
  definir: 'RECOMPOSITION',
  saude: 'MAINTAIN',
}

const DAYS_TO_ACTIVITY: Record<string, ActivityLevel> = {
  '2': 'LIGHT',
  '3': 'MODERATE',
  '4': 'ACTIVE',
  '5': 'VERY_ACTIVE',
}

// Diagnóstico por objetivo (abre o resultado conectando com o desejo).
const OBJ_DIAGNOSIS: Record<Objective, string> = {
  emagrecer:
    'Seu foco é perder gordura sem passar fome. O segredo não é comer menos de tudo — é bater a proteína certa e manter um déficit calórico sustentável. Montamos suas metas exatamente pra isso.',
  massa:
    'Pra ganhar massa, treino sozinho não basta: você precisa de um leve superávit calórico e proteína suficiente todos os dias. A maioria falha aqui por comer menos do que imagina. Suas metas abaixo já corrigem isso.',
  definir:
    'Definir é o equilíbrio mais difícil: manter (ou ganhar) músculo enquanto reduz gordura. Isso exige proteína alta e um treino consistente. Ajustamos suas metas pra esse ponto ideal.',
  saude:
    'Seu objetivo é se sentir melhor no dia a dia — mais energia, mais disposição e um corpo que funciona bem. Metas equilibradas e constância valem mais que qualquer dieta radical.',
}

// Reforço por dor principal (mostra que entendemos o obstáculo).
const PAIN_LINE: Record<string, string> = {
  tempo:
    'Como falta de tempo é o seu maior obstáculo, montamos um plano enxuto — registro em segundos pelo WhatsApp, sem planilha nem app complicado.',
  comojazer:
    'Você não precisa saber montar treino nem dieta: a FitSync monta tudo pra você e ajusta conforme sua evolução.',
  desisto:
    'Quem começa e desiste geralmente falta de acompanhamento, não de força de vontade. Por isso o coach te lembra e ajusta o plano quando a rotina aperta.',
  acompanhamento:
    'O que faltava era acompanhamento de verdade. Aqui você tira dúvida a qualquer hora no WhatsApp e recebe ajustes toda semana.',
}

interface SplitDay { day: string; focus: string }
interface WorkoutSplit { name: string; days: SplitDay[] }

// Divisões por local + nº de dias (prévia realista do que o app geraria).
function buildSplit(place: string, days: string): WorkoutSplit {
  const home = place === 'casa' || place === 'arlivre' || place === 'nada'
  const n = days === '5' ? 5 : Number(days)

  if (home) {
    const pool: SplitDay[] = [
      { day: 'A', focus: 'Pernas e glúteos (peso corporal + halteres)' },
      { day: 'B', focus: 'Peito, ombro e tríceps' },
      { day: 'C', focus: 'Costas, bíceps e core' },
      { day: 'D', focus: 'Full body funcional' },
      { day: 'E', focus: 'Cardio + core' },
    ]
    return { name: `Treino em casa · ${n}x por semana`, days: pool.slice(0, n) }
  }

  const pool: SplitDay[] = [
    { day: 'A', focus: 'Peito e tríceps' },
    { day: 'B', focus: 'Costas e bíceps' },
    { day: 'C', focus: 'Pernas e glúteos' },
    { day: 'D', focus: 'Ombro e core' },
    { day: 'E', focus: 'Pernas (posterior) e panturrilha' },
  ]
  const name =
    n === 2 ? 'Full body AB · 2x por semana'
    : n === 3 ? 'Divisão ABC · 3x por semana'
    : n === 4 ? 'Divisão ABCD · 4x por semana'
    : 'Divisão ABCDE · 5x por semana'
  if (n === 2) {
    return { name, days: [
      { day: 'A', focus: 'Superiores (peito, costas, ombro, braços)' },
      { day: 'B', focus: 'Inferiores (pernas, glúteos, core)' },
    ] }
  }
  return { name, days: pool.slice(0, n) }
}

// Projeção de tempo honesta a partir do ritmo saudável de cada objetivo.
function buildTimeline(obj: Objective, weight?: number, goalWeight?: number): string | null {
  if (!weight || !goalWeight || obj === 'saude') return null
  const diff = Math.abs(weight - goalWeight)
  if (diff < 1) return null
  // ritmo saudável: ~0,5 kg/sem emagrecendo, ~0,25 kg/sem ganhando massa
  const perWeek = obj === 'massa' ? 0.25 : 0.5
  const weeks = Math.round(diff / perWeek)
  const lo = Math.max(4, weeks - 2)
  const hi = weeks + 3
  const verb = weight > goalWeight ? 'chegar aos' : 'alcançar os'
  return `No seu ritmo e de forma saudável, dá pra ${verb} ${goalWeight} kg em cerca de ${lo} a ${hi} semanas.`
}

export interface QuizResult {
  name: string
  headline: string
  diagnosis: string
  painLine: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  split: WorkoutSplit
  timeline: string | null
  restrictionNote: string | null
}

const num = (v: unknown, fallback: number) => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : fallback
}

/** Monta o resultado personalizado a partir das respostas. */
export function buildResult(name: string, a: QuizAnswers): QuizResult {
  const objective = (a.objective as Objective) ?? 'saude'
  const goal = OBJ_TO_GOAL[objective]
  const sexRaw = a.sex as string
  const sex: 'male' | 'female' = sexRaw === 'female' ? 'female' : 'male'
  const age = num(a.age, 30)
  const height = num(a.height, 170)
  const weight = num(a.weight, 75)
  const goalWeight = a.goalWeight ? num(a.goalWeight, weight) : undefined
  const activity = DAYS_TO_ACTIVITY[(a.days as string) ?? '3'] ?? 'MODERATE'

  const tdee = calculateTDEE(weight, height, age, activity, sex)
  const macros = calculateMacros(tdee, goal, weight)

  const restrictions = Array.isArray(a.restrictions) ? a.restrictions : []
  const activeRestr = restrictions.filter((r) => r !== 'nenhuma')
  const restrLabel: Record<string, string> = {
    vegetariano: 'vegetariana', vegano: 'vegana', lactose: 'sem lactose', gluten: 'sem glúten',
  }
  const restrictionNote = activeRestr.length
    ? `Sua dieta será montada ${activeRestr.map((r) => restrLabel[r] ?? r).join(', ')} — sem abrir mão das suas metas.`
    : null

  const firstName = name.trim().split(/\s+/)[0] || 'você'
  const objLabel: Record<Objective, string> = {
    emagrecer: 'emagrecer', massa: 'ganhar massa', definir: 'definir o corpo', saude: 'ter mais saúde',
  }

  return {
    name: firstName,
    headline: `${firstName}, seu plano pra ${objLabel[objective]} está pronto`,
    diagnosis: OBJ_DIAGNOSIS[objective],
    painLine: PAIN_LINE[(a.pain1 as string)] ?? PAIN_LINE.acompanhamento,
    calories: macros.calories,
    proteinG: macros.proteinG,
    carbsG: macros.carbsG,
    fatG: macros.fatG,
    split: buildSplit((a.place as string) ?? 'academia', (a.days as string) ?? '3'),
    timeline: buildTimeline(objective, weight, goalWeight),
    restrictionNote,
  }
}
