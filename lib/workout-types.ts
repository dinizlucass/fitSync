export interface ExerciseAlternative {
  name: string
  sets: number
  reps: string
  rest: string
  equipment: string
  notes?: string
}

export interface WorkoutExerciseSlot {
  muscleGroup: string
  primary: ExerciseAlternative
  alternatives: ExerciseAlternative[]
}

export interface CardioRecommendation {
  type: string          // ex: "HIIT", "LISS", "Caminhada inclinada"
  description: string   // ex: "30s sprint / 30s descanso, 8 rounds"
  durationMin: number
  frequency: string     // ex: "2x por semana"
  caloriesBurn: number  // kcal estimadas por sessão
  bestFor: string       // ex: "Queima de gordura sem perder massa"
}

export interface SmartWorkoutPlan {
  name: string
  duration: string
  exercises: WorkoutExerciseSlot[]
  tips: string[]
  cardio?: CardioRecommendation[]   // ausente em planos salvos antes da feature
  methodology?: string[]            // dicas metodológicas (falha, RIR, descanso, cadência)
}

export type VolumePreference = 'low' | 'moderate' | 'high'

// ─── Programa completo (todos os dias da divisão) ──────────────────────────

/** Um dia do esqueleto da semana — a divisão real, montada pela IA conforme a ênfase. */
export interface ProgramDaySkeleton {
  label: string          // "Treino A"
  focus: string          // "Quadríceps e Glúteos"
  muscleGroups: string[] // ["Quadríceps", "Glúteos", "Panturrilhas"]
}

export interface WeekSkeleton {
  programName: string        // "ABC — Ênfase em Inferiores"
  weeklyRationale: string    // 1-2 frases explicando a lógica da semana
  days: ProgramDaySkeleton[]
  cardio?: CardioRecommendation[]
}

export interface ProgramDayPlan extends ProgramDaySkeleton {
  exercises: WorkoutExerciseSlot[]
  methodology: string[]
}

export interface SmartProgramPlan {
  programName: string
  weeklyRationale: string
  days: ProgramDayPlan[]
  tips: string[]
  cardio?: CardioRecommendation[]
}
