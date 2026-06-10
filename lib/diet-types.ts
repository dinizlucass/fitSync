export interface MealFoodItem {
  food: string
  quantity: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface MealVariant {
  label: string
  tagline: string
  items: MealFoodItem[]
  totalCalories: number
  totalProteinG: number
  totalCarbsG: number
  totalFatG: number
}

export interface MealSlot {
  name: string
  time: string
  variants: MealVariant[]
}

export interface SmartDietPlan {
  meals: MealSlot[]
  tips: string[]
}
