import OpenAI from 'openai'

let _openai: OpenAI | undefined

function getOpenAI(): OpenAI {
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

export async function generateWorkoutPlan(params: {
  method: string
  methodName: string
  daysPerWeek: number
  goal: string
  level: string
  splits: string[]
}): Promise<GeneratedWorkoutPlan> {
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é um personal trainer experiente especializado em montagem de treinos.
Monte um plano de treino completo em português brasileiro.
Responda APENAS com JSON válido no formato especificado.
Seja específico: inclua exercícios reais com cargas progressivas adaptadas ao nível do aluno.
Para iniciantes: exercícios básicos, séries 3x, reps 10-15.
Para intermediários: variações compostas, séries 4x, reps 8-12.
Para avançados: técnicas avançadas, séries 4-5x, reps 6-12 com variação.`,
      },
      {
        role: 'user',
        content: `Monte um plano de treino com as seguintes especificações:
- Método: ${params.methodName}
- Dias por semana: ${params.daysPerWeek}
- Objetivo: ${params.goal}
- Nível: ${params.level}
- Divisões: ${params.splits.join(', ')}

Retorne um JSON no formato:
{
  "method": "${params.methodName}",
  "days": [
    {
      "name": "nome da divisão (ex: Treino A - Peito e Tríceps)",
      "muscleGroups": ["peito", "triceps"],
      "exercises": [
        {
          "name": "nome do exercício",
          "muscleGroup": "grupo muscular principal",
          "targetSets": 4,
          "targetReps": 10,
          "restSeconds": 90,
          "notes": "dica de execução (opcional)"
        }
      ]
    }
  ],
  "tips": ["dica geral 1", "dica geral 2", "dica geral 3"]
}

Monte ${params.daysPerWeek} dias de treino. Cada dia deve ter 4-6 exercícios.`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No response from OpenAI')
  return JSON.parse(content) as GeneratedWorkoutPlan
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

export async function generateDietPlan(params: {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  goal: string
  preferences: string[]
  mealsPerDay: number
}): Promise<GeneratedDietPlan> {
  const prefText = params.preferences.length > 0
    ? `Restrições/preferências: ${params.preferences.join(', ')}.`
    : 'Sem restrições alimentares.'

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é um nutricionista esportivo especializado em dietas para praticantes de musculação.
Monte cardápios usando alimentos comuns no Brasil, baseado na tabela TACO.
Use alimentos acessíveis e práticos. Varie os alimentos entre os dias.
Responda APENAS com JSON válido no formato especificado.`,
      },
      {
        role: 'user',
        content: `Monte um plano alimentar de 7 dias com as seguintes metas diárias:
- Calorias: ${params.calories} kcal
- Proteína: ${params.proteinG}g
- Carboidratos: ${params.carbsG}g
- Gordura: ${params.fatG}g
- Objetivo: ${params.goal}
- Refeições por dia: ${params.mealsPerDay}
- ${prefText}

Retorne um JSON no formato:
{
  "days": [
    {
      "totalCalories": número,
      "totalProteinG": número,
      "totalCarbsG": número,
      "totalFatG": número,
      "meals": [
        {
          "name": "Café da manhã",
          "time": "07:00",
          "items": [
            {
              "food": "Ovo mexido",
              "quantity": "3 unidades (150g)",
              "calories": 210,
              "proteinG": 18,
              "carbsG": 2,
              "fatG": 15
            }
          ],
          "totalCalories": número,
          "totalProteinG": número,
          "totalCarbsG": número,
          "totalFatG": número
        }
      ]
    }
  ],
  "tips": ["dica nutricional 1", "dica 2", "dica 3"],
  "substitutions": ["frango pode ser substituído por atum", "arroz pode ser substituído por batata doce"]
}

Monte exatamente 7 dias variados. Cada dia deve ter ${params.mealsPerDay} refeições.`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.8,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No response from OpenAI')
  return JSON.parse(content) as GeneratedDietPlan
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
