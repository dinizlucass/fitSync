import OpenAI from 'openai'
import type { SmartDietPlan, MealVariant } from '@/lib/diet-types'
import type {
  ExerciseAlternative,
  WeekSkeleton,
  ProgramDaySkeleton,
  ProgramDayPlan,
  CardioRecommendation,
  WorkoutExerciseSlot,
} from '@/lib/workout-types'

let _openai: OpenAI | undefined

export function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

export interface ParsedWorkout {
  exercises: Array<{
    name: string
    sets: Array<{
      weight: number | null
      reps: number | null
    }>
  }>
}

export interface ParsedMeal {
  items: Array<{
    name: string
    quantityG: number
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }>
  totalCalories: number
  totalProteinG: number
  totalCarbsG: number
  totalFatG: number
}

export interface ParsedFoodImage {
  items: Array<{
    name: string
    quantityG: number
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }>
  totalCalories: number
  totalProteinG: number
  totalCarbsG: number
  totalFatG: number
}

export interface WeeklyInsight {
  insight: string
  highlights: string[]
}

export async function parseWorkoutMessage(text: string): Promise<ParsedWorkout> {
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é um assistente especializado em registro de treinos.
Analise a mensagem do usuário e extraia os exercícios, séries, pesos e repetições.
Responda APENAS com um JSON válido no seguinte formato:
{
  "exercises": [
    {
      "name": "nome do exercício em português",
      "sets": [
        { "weight": número_ou_null, "reps": número_ou_null }
      ]
    }
  ]
}
Se o peso não for mencionado, use null. Se as reps não forem mencionadas, use null.
Normalize o nome dos exercícios para português brasileiro.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No response from OpenAI')

  return JSON.parse(content) as ParsedWorkout
}

export async function parseMealMessage(text: string): Promise<ParsedMeal> {
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é um nutricionista especializado em calcular macronutrientes de refeições brasileiras.
Use a tabela TACO (Tabela Brasileira de Composição de Alimentos) como referência principal.
Analise a mensagem do usuário e estime calorias e macronutrientes dos alimentos mencionados.
Responda APENAS com um JSON válido no seguinte formato:
{
  "items": [
    {
      "name": "nome do alimento",
      "quantityG": quantidade_em_gramas,
      "calories": calorias,
      "proteinG": proteínas_em_gramas,
      "carbsG": carboidratos_em_gramas,
      "fatG": gorduras_em_gramas
    }
  ],
  "totalCalories": total_calorias,
  "totalProteinG": total_proteínas,
  "totalCarbsG": total_carboidratos,
  "totalFatG": total_gorduras
}
Seja preciso com as estimativas com base nos valores da TACO.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No response from OpenAI')

  return JSON.parse(content) as ParsedMeal
}

export async function analyzeFoodImage(imageUrl: string): Promise<ParsedFoodImage> {
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é um nutricionista especializado em identificar alimentos e estimar macronutrientes a partir de fotos.
Use a tabela TACO (Tabela Brasileira de Composição de Alimentos) como referência.
Analise a imagem e identifique todos os alimentos visíveis, estimando as quantidades e macronutrientes.
Responda APENAS com um JSON válido no seguinte formato:
{
  "items": [
    {
      "name": "nome do alimento em português",
      "quantityG": quantidade_estimada_em_gramas,
      "calories": calorias_estimadas,
      "proteinG": proteínas_em_gramas,
      "carbsG": carboidratos_em_gramas,
      "fatG": gorduras_em_gramas
    }
  ],
  "totalCalories": total_calorias,
  "totalProteinG": total_proteínas,
  "totalCarbsG": total_carboidratos,
  "totalFatG": total_gorduras
}`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageUrl },
          },
          {
            type: 'text',
            text: 'Identifique os alimentos nesta imagem e estime os macronutrientes.',
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No response from OpenAI')

  return JSON.parse(content) as ParsedFoodImage
}

export interface WeeklyData {
  sessions: number
  totalVolume?: number
  avgCalories?: number
  weightChange?: number
  personalRecords?: number
  consistency?: number
}

export async function generateWeeklyInsight(data: WeeklyData): Promise<WeeklyInsight> {
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é um coach de fitness motivacional.
Analise os dados da semana do usuário e gere uma análise motivacional em 2-3 frases em português brasileiro.
Seja encorajador, específico e baseado nos dados fornecidos.
Responda APENAS com um JSON válido no seguinte formato:
{
  "insight": "análise motivacional em 2-3 frases",
  "highlights": ["destaque 1", "destaque 2", "destaque 3"]
}`,
      },
      {
        role: 'user',
        content: `Dados da semana:
- Treinos realizados: ${data.sessions}
- Volume total: ${data.totalVolume ?? 'não informado'} kg
- Média de calorias: ${data.avgCalories ?? 'não informado'} kcal/dia
- Variação de peso: ${data.weightChange !== undefined ? `${data.weightChange > 0 ? '+' : ''}${data.weightChange} kg` : 'não informado'}
- Recordes pessoais: ${data.personalRecords ?? 0}
- Consistência: ${data.consistency !== undefined ? `${data.consistency}%` : 'não informado'}

Gere uma análise motivacional baseada nesses dados.`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No response from OpenAI')

  return JSON.parse(content) as WeeklyInsight
}

// ─── Workout Plan Generation ───────────────────────────────────────────────

export interface GeneratedExercise {
  name: string
  muscleGroup: string
  targetSets: number
  targetReps: number
  restSeconds: number
  notes?: string
}

export interface GeneratedWorkoutDay {
  name: string
  muscleGroups: string[]
  exercises: GeneratedExercise[]
}

export interface GeneratedWorkoutPlan {
  method: string
  days: GeneratedWorkoutDay[]
  tips: string[]
}

// Contexto comum do aluno, injetado nas duas etapas da geração
export interface ProgramContext {
  methodName: string
  daysPerWeek: number
  goal: string
  level: string
  sex?: string | null            // 'male' | 'female'
  emphasis: string               // descrição legível da ênfase escolhida
  equipment: string              // descrição legível do equipamento disponível
  limitations?: string           // lesões, restrições e preferências em texto livre
  sessionDuration: number
  volumeLabel: string
  setsRange: string
  includeCardio: boolean
  dailyCalorieGoal?: number
}

function alunoBrief(p: ProgramContext): string {
  return `PERFIL DO ALUNO:
- Sexo: ${p.sex === 'female' ? 'feminino' : p.sex === 'male' ? 'masculino' : 'não informado'}
- Objetivo: ${p.goal}
- Nível: ${p.level}
- Ênfase muscular escolhida: ${p.emphasis}
- Equipamento disponível: ${p.equipment}
- Limitações/preferências: ${p.limitations?.trim() || 'nenhuma informada'}
- Sessões de ${p.sessionDuration} min, volume ${p.volumeLabel} (${p.setsRange} séries por exercício)`
}

/**
 * Etapa 1 — Esqueleto da semana: monta a DIVISÃO real em função da ênfase.
 * É aqui que "ABC com 2x perna" vira A: Quadríceps+Glúteos / B: Superior / C: Posterior+Glúteos.
 */
export async function generateWeekSkeleton(p: ProgramContext): Promise<WeekSkeleton> {
  const cardioInstruction = p.includeCardio
    ? `Inclua 1-2 recomendações de cardio no campo "cardio" (meta calórica diária: ${p.dailyCalorieGoal ?? 'não informada'} kcal; objetivo: ${p.goal}). Perda de gordura → HIIT 2-3x/sem + LISS opcional; Ganho de massa → cardio leve 1-2x/sem; Recomposição/Manutenção → LISS moderado 2-3x/sem. Estime "caloriesBurn" realista por sessão.`
    : `Retorne "cardio": [] (o aluno não quer cardio).`

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é um treinador experiente que monta divisões de treino semanais personalizadas (português brasileiro).
Sua tarefa é APENAS definir a estrutura da semana: quantos dias, o foco muscular de cada dia e o racional — os exercícios virão depois.
Responda SOMENTE com JSON válido.

REGRAS DE DIVISÃO:
- A ênfase do aluno MANDA na divisão. "Ênfase em pernas/glúteos" num ABC = 2 dias de inferior (ex.: A quadríceps+glúteos, C posterior+glúteos) e 1 dia de superior completo. Ênfase em um grupo = esse grupo aparece 2x na semana e/ou abre o treino.
- Respeite o formato do método (${p.methodName}), mas ADAPTE os focos à ênfase — as divisões clássicas são ponto de partida, não camisa de força.
- Distribua o volume semanal com recuperação adequada: não coloque o mesmo grupo em dias consecutivos.
- Grupos prioritários devem receber ~2x mais volume semanal que os demais.
- Se o sexo for feminino e a ênfase não contradisser, tende a mais volume de inferiores/glúteos; se masculino, equilíbrio clássico — mas a ênfase ESCOLHIDA sempre vence.
- Considere as limitações: se há lesão num segmento, reduza a exposição dele na semana.`,
      },
      {
        role: 'user',
        content: `${alunoBrief(p)}

Método: ${p.methodName} — EXATAMENTE ${p.daysPerWeek} dias de treino.
${cardioInstruction}

Retorne JSON EXATO:
{
  "programName": "nome curto do programa (ex: ABC — Ênfase em Glúteos)",
  "weeklyRationale": "1-2 frases explicando a lógica da semana para o aluno",
  "days": [
    { "label": "Treino A", "focus": "Quadríceps e Glúteos", "muscleGroups": ["Quadríceps", "Glúteos", "Panturrilhas"] }
  ],
  "cardio": []
}

O array "days" deve ter EXATAMENTE ${p.daysPerWeek} itens, com labels "Treino A", "Treino B", ... em sequência.`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No response from OpenAI')
  const skeleton = JSON.parse(content) as WeekSkeleton
  if (!Array.isArray(skeleton.days) || skeleton.days.length !== p.daysPerWeek) {
    throw new Error(`Esqueleto inválido: esperava ${p.daysPerWeek} dias, veio ${skeleton.days?.length ?? 0}`)
  }
  return skeleton
}

/**
 * Etapa 2 — Um dia por chamada (roda em paralelo). JSON pequeno = qualidade
 * alta e nenhum dia faltando. Recebe o esqueleto inteiro como contexto para
 * não repetir exercícios entre dias.
 */
export async function generateProgramDay(
  p: ProgramContext,
  skeleton: WeekSkeleton,
  day: ProgramDaySkeleton,
): Promise<ProgramDayPlan> {
  const exerciseCount =
    p.sessionDuration <= 30 ? '3-4 exercícios'
    : p.sessionDuration <= 45 ? '4-5 exercícios'
    : p.sessionDuration <= 60 ? '5-6 exercícios'
    : '6-8 exercícios'

  const weekOverview = skeleton.days
    .map(d => `${d.label}: ${d.focus}${d.label === day.label ? '  ← VOCÊ ESTÁ MONTANDO ESTE' : ''}`)
    .join('\n')

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é um personal trainer experiente montando UM dia de um programa semanal (português brasileiro).
Responda SOMENTE com JSON válido.

REGRAS DE MONTAGEM:
- Ordem: compostos/multiarticulares primeiro, isoladores depois. O primeiro exercício deve ser o mais importante para o foco do dia.
- Faixas de repetição pelo objetivo: hipertrofia 6-12 (compostos podem 6-8, isoladores 10-15); perda de gordura 8-15 com descansos menores; iniciantes sempre 10-15 com técnica.
- Descanso: 90-120s em compostos pesados, 60-90s intermediários, 45-60s isoladores.
- TODOS os exercícios com ${p.setsRange} séries (volume ${p.volumeLabel}).
- TODOS os exercícios (principal E alternativas) devem ser executáveis com: ${p.equipment}. Se o equipamento é limitado, use as melhores variações possíveis (halteres, elásticos, peso corporal) — nunca prescreva máquina para quem treina em casa.
- Alternativas: 1-2 por exercício, mesmo padrão de movimento, incluindo quando possível uma opção com menos equipamento.
- LIMITAÇÕES SÃO SAGRADAS: se o aluno relatou dor/lesão (ex.: joelho, ombro, lombar), evite exercícios de alto estresse nessa articulação e anote a adaptação em "notes". Se citou exercícios que ama, inclua; que odeia, exclua.
- Sexo ${p.sex === 'female' ? 'feminino: quando o foco do dia incluir inferiores, priorize padrões dominantes de quadril (hip thrust, RDL, búlgaro, abdução) junto aos de joelho' : 'masculino: priorize os básicos compostos com progressão de carga'} — sempre a serviço do foco do dia.
- Não repita exercícios que claramente pertencem a outros dias da semana (veja a visão geral).
- "notes" do exercício = dica de execução curta e útil (pegada, amplitude, cadência), não frase genérica.

CAMPO "methodology" — 3-4 dicas 100% sobre COMO executar ESTE treino (RIR, falha, descanso, cadência, técnicas):
- Volume "Baixo": OBRIGATÓRIO incluir levar as 2 últimas séries à falha/1 RIR + dica de descanso.
- Volume "Alto" + massa: primeiras séries 2-3 RIR, só a última série de cada exercício em 0-1 RIR.
- Volume "Alto" + perda de gordura: descanso 45-60s + supersets nos isoladores.
- Volume "Moderado": meio-termo das regras acima.`,
      },
      {
        role: 'user',
        content: `${alunoBrief(p)}

SEMANA COMPLETA (para contexto — não repita exercícios entre dias):
${weekOverview}

MONTE APENAS: ${day.label} — ${day.focus}
Grupos deste dia: ${day.muscleGroups.join(', ')}
Quantidade: ${exerciseCount} (para caber em ${p.sessionDuration} min com ${p.setsRange} séries e descansos).

Retorne JSON EXATO:
{
  "exercises": [
    {
      "muscleGroup": "Glúteos",
      "primary": { "name": "Hip thrust com barra", "sets": 4, "reps": "8-12", "rest": "90s", "equipment": "Barra e banco", "notes": "pausa de 1s no topo, queixo recolhido" },
      "alternatives": [
        { "name": "Elevação pélvica com halter", "sets": 4, "reps": "10-15", "rest": "75s", "equipment": "Halter" }
      ]
    }
  ],
  "methodology": ["dica 1", "dica 2", "dica 3"]
}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No response from OpenAI')
  const parsed = JSON.parse(content) as { exercises: WorkoutExerciseSlot[]; methodology: string[]; cardio?: CardioRecommendation[] }
  if (!Array.isArray(parsed.exercises) || parsed.exercises.length < 3) {
    throw new Error(`Dia ${day.label} veio com poucos exercícios (${parsed.exercises?.length ?? 0})`)
  }
  return { ...day, exercises: parsed.exercises, methodology: parsed.methodology ?? [] }
}

export async function refineExercise(params: {
  exerciseName: string
  sets: number
  reps: string
  muscleGroup: string
  userMessage: string
}): Promise<ExerciseAlternative & { explanation: string }> {
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Você é um personal trainer. Sugira um exercício substituto conforme o pedido. Mantenha volume similar. Responda SOMENTE com JSON válido.',
      },
      {
        role: 'user',
        content: `Exercício atual: ${params.exerciseName}
Grupo muscular: ${params.muscleGroup}
Séries: ${params.sets} | Repetições: ${params.reps}
Pedido do usuário: ${params.userMessage}

Retorne JSON EXATO:
{
  "name": "nome do exercício substituto",
  "sets": ${params.sets},
  "reps": "${params.reps}",
  "rest": "90s",
  "equipment": "equipamento necessário",
  "notes": "dica opcional",
  "explanation": "motivo da substituição (máx 70 chars)"
}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No response from OpenAI')
  return JSON.parse(content) as ExerciseAlternative & { explanation: string }
}

// ─── Diet Plan Generation ──────────────────────────────────────────────────

export interface GeneratedMeal {
  name: string
  time: string
  items: Array<{
    food: string
    quantity: string
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }>
  totalCalories: number
  totalProteinG: number
  totalCarbsG: number
  totalFatG: number
}

export interface GeneratedDietDay {
  totalCalories: number
  totalProteinG: number
  totalCarbsG: number
  totalFatG: number
  meals: GeneratedMeal[]
}

export interface GeneratedDietPlan {
  days: GeneratedDietDay[]
  tips: string[]
  substitutions: string[]
}

export async function generateSmartDietPlan(params: {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  goal: string
  preferences: string[]
  mealsPerDay: number
  weight?: number
  height?: number
}): Promise<SmartDietPlan> {
  // Pre-calculate per-meal calorie targets so the AI has concrete numbers to hit
  const mealDistributions: Record<number, number[]> = {
    3: [30, 40, 30],
    4: [25, 35, 25, 15],
    5: [20, 10, 35, 15, 20],
    6: [20, 10, 30, 10, 20, 10],
  }
  const mealNames: Record<number, string[]> = {
    3: ['Café da manhã', 'Almoço', 'Jantar'],
    4: ['Café da manhã', 'Almoço', 'Lanche da tarde', 'Jantar'],
    5: ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar'],
    6: ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'],
  }
  const mealTimes: Record<number, string[]> = {
    3: ['07:00', '12:30', '19:00'],
    4: ['07:00', '12:30', '15:30', '19:00'],
    5: ['07:00', '10:00', '12:30', '15:30', '19:00'],
    6: ['07:00', '10:00', '12:30', '15:30', '19:00', '21:30'],
  }

  const n = params.mealsPerDay
  const distributions = mealDistributions[n] ?? mealDistributions[5]
  const names = mealNames[n] ?? mealNames[5]
  const times = mealTimes[n] ?? mealTimes[5]

  const mealTargets = distributions.map((pct, i) => ({
    name: names[i],
    time: times[i],
    targetCalories: Math.round(params.calories * pct / 100),
    targetProteinG: Math.round(params.proteinG * pct / 100),
    targetCarbsG: Math.round(params.carbsG * pct / 100),
    targetFatG: Math.round(params.fatG * pct / 100),
  }))

  const mealTargetLines = mealTargets
    .map(m => `  - ${m.name} (${m.time}): ${m.targetCalories} kcal | P:${m.targetProteinG}g C:${m.targetCarbsG}g G:${m.targetFatG}g`)
    .join('\n')

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é um nutricionista esportivo brasileiro. Gere um cardápio diário personalizado.
Responda SOMENTE com JSON válido, sem markdown, sem explicações fora do JSON.
REGRA ABSOLUTA: cada refeição DEVE bater exatamente o alvo calórico indicado (±5%). Calcule os itens e porções para atingir o número exato antes de retornar.`,
      },
      {
        role: 'user',
        content: `Crie um cardápio diário com base no perfil:

META CALÓRICA DIÁRIA: ${params.calories} kcal (objetivo: ${params.goal})
MACROS: Proteína ${params.proteinG}g | Carboidratos ${params.carbsG}g | Gordura ${params.fatG}g
${params.weight ? `Peso: ${params.weight}kg` : ''}${params.height ? ` | Altura: ${params.height}cm` : ''}
Restrições: ${params.preferences.length > 0 ? params.preferences.join(', ') : 'nenhuma'}

ALVOS OBRIGATÓRIOS POR REFEIÇÃO (você DEVE bater esses valores ±5%):
${mealTargetLines}

Para cada refeição, gere 3 variantes (Opção A, B, C) que batem o mesmo alvo calórico com alimentos diferentes.

Retorne JSON:
{
  "meals": [
    {
      "name": "${names[0]}",
      "time": "${times[0]}",
      "variants": [
        {
          "label": "Opção A",
          "tagline": "tagline curta",
          "items": [
            { "food": "nome", "quantity": "quantidade", "calories": N, "proteinG": N, "carbsG": N, "fatG": N }
          ],
          "totalCalories": ${mealTargets[0]?.targetCalories ?? 0},
          "totalProteinG": N, "totalCarbsG": N, "totalFatG": N
        },
        { "label": "Opção B", ... },
        { "label": "Opção C", ... }
      ]
    }
  ],
  "tips": ["dica 1", "dica 2", "dica 3"]
}

REGRAS:
- Gere exatamente ${n} refeições na ordem dos alvos acima
- Sempre 3 variantes completas por refeição — nunca arrays vazios
- Cada variante deve bater o mesmo alvo calórico da refeição (±5%)
- Use alimentos comuns no Brasil (tabela TACO)
- Taglines curtas (máx 3 palavras)
- Nunca repita o mesmo alimento principal entre variantes da mesma refeição`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No response from OpenAI')
  return JSON.parse(content) as SmartDietPlan
}

export async function refineMealVariant(params: {
  mealName: string
  currentVariant: MealVariant
  userMessage: string
}): Promise<MealVariant & { explanation: string }> {
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Você é um nutricionista esportivo. Ajuste uma variante de refeição conforme o pedido do usuário.
REGRA ABSOLUTA: a nova variante DEVE ter exatamente o mesmo total calórico da variante original (±5%). Ajuste as porções para bater o número exato.
Use alimentos comuns no Brasil (tabela TACO). Responda SOMENTE com JSON válido.`,
      },
      {
        role: 'user',
        content: `Refeição: ${params.mealName}
Variante atual: ${params.currentVariant.label} — "${params.currentVariant.tagline}"

Itens atuais:
${params.currentVariant.items.map(i => `- ${i.food} (${i.quantity}): ${i.calories} kcal | P:${i.proteinG}g C:${i.carbsG}g G:${i.fatG}g`).join('\n')}

ALVO OBRIGATÓRIO: ${params.currentVariant.totalCalories} kcal ±5% (ou seja, entre ${Math.round(params.currentVariant.totalCalories * 0.95)} e ${Math.round(params.currentVariant.totalCalories * 1.05)} kcal)
Proteína atual: ${params.currentVariant.totalProteinG}g — mantenha próximo desse valor.

Pedido do usuário: "${params.userMessage}"

Ajuste os alimentos conforme o pedido e calibre as porções para bater ${params.currentVariant.totalCalories} kcal.

Retorne JSON:
{
  "label": "${params.currentVariant.label}",
  "tagline": "nova tagline (máx 3 palavras)",
  "items": [
    { "food": "nome", "quantity": "quantidade", "calories": N, "proteinG": N, "carbsG": N, "fatG": N }
  ],
  "totalCalories": ${params.currentVariant.totalCalories},
  "totalProteinG": N,
  "totalCarbsG": N,
  "totalFatG": N,
  "explanation": "motivo do ajuste (máx 70 chars)"
}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No response from OpenAI')
  return JSON.parse(content) as MealVariant & { explanation: string }
}

// ─── AI Coach Chat ─────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function chatWithCoach(params: {
  message: string
  history: ChatMessage[]
  userContext: {
    goal: string
    level: string
    weight?: number
    height?: number
    calorieGoal?: number
    proteinGoal?: number
  }
}): Promise<string> {
  const contextText = `
Perfil do usuário:
- Objetivo: ${params.userContext.goal}
- Nível: ${params.userContext.level}
${params.userContext.weight ? `- Peso: ${params.userContext.weight}kg` : ''}
${params.userContext.height ? `- Altura: ${params.userContext.height}cm` : ''}
${params.userContext.calorieGoal ? `- Meta calórica: ${params.userContext.calorieGoal} kcal/dia` : ''}
${params.userContext.proteinGoal ? `- Meta de proteína: ${params.userContext.proteinGoal}g/dia` : ''}
`.trim()

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é o FitSync Coach, um personal trainer e nutricionista virtual especializado.
Responda sempre em português brasileiro de forma direta, prática e motivadora.
Baseie suas respostas no perfil do usuário abaixo.
Seja conciso: respostas de 2-4 parágrafos no máximo.
Quando relevante, cite números e recomendações específicas.

${contextText}`,
      },
      ...params.history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: params.message },
    ],
    temperature: 0.7,
  })

  return response.choices[0].message.content ?? 'Não consegui processar sua mensagem.'
}
