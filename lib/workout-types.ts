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
