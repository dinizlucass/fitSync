export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE'
export type GoalType = 'GAIN_MUSCLE' | 'LOSE_FAT' | 'RECOMPOSITION' | 'MAINTAIN'

const activityMultipliers: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
}

/**
 * Calculate Total Daily Energy Expenditure using Mifflin-St Jeor equation.
 */
export function calculateTDEE(
  weightKg: number,
  heightCm: number,
  age: number,
  activityLevel: ActivityLevel,
  sex: 'male' | 'female' = 'male'
): number {
  // Mifflin-St Jeor BMR
  let bmr: number
  if (sex === 'male') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161
  }

  const multiplier = activityMultipliers[activityLevel]
  return Math.round(bmr * multiplier)
}

export interface MacroResult {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

/**
 * Calculate macro targets based on TDEE and goal type.
 */
export function calculateMacros(tdee: number, goalType: GoalType, weightKg: number = 70): MacroResult {
  let calories: number
  let proteinG: number

  switch (goalType) {
    case 'LOSE_FAT':
      calories = tdee - 400
      proteinG = Math.round(weightKg * 2.0)
      break
    case 'GAIN_MUSCLE':
      calories = tdee + 250
      proteinG = Math.round(weightKg * 2.2)
      break
    case 'RECOMPOSITION':
      calories = tdee
      proteinG = Math.round(weightKg * 2.0)
      break
    case 'MAINTAIN':
    default:
      calories = tdee
      proteinG = Math.round(weightKg * 1.8)
      break
  }

  // Protein calories
  const proteinCalories = proteinG * 4

  // Fat: 25-30% of total calories
  const fatG = Math.round((calories * 0.27) / 9)
  const fatCalories = fatG * 9

  // Carbs: remaining calories
  const carbsCalories = calories - proteinCalories - fatCalories
  const carbsG = Math.round(carbsCalories / 4)

  return {
    calories: Math.round(calories),
    proteinG,
    carbsG: Math.max(carbsG, 0),
    fatG,
  }
}

export interface PreviousSet {
  weightKg: number | null
  reps: number | null
}

/**
 * Detect if a new set constitutes a personal record.
 * Uses the "1RM equivalent" formula: weight * (1 + reps/30)
 */
export function detectPersonalRecord(
  newWeight: number,
  newReps: number,
  previousSets: PreviousSet[]
): boolean {
  if (!newWeight || !newReps || previousSets.length === 0) return false

  const new1RM = newWeight * (1 + newReps / 30)

  const maxPrevious1RM = previousSets.reduce((max, set) => {
    if (!set.weightKg || !set.reps) return max
    const prev1RM = set.weightKg * (1 + set.reps / 30)
    return Math.max(max, prev1RM)
  }, 0)

  return new1RM > maxPrevious1RM
}
