/**
 * Helpers compartilhados pelo coach (contexto + tools).
 * Datas usam o fuso America/Sao_Paulo e a mesma convenção de armazenamento
 * do resto do app (logs de refeição ancorados na meia-noite do dia local).
 */
import { startOfDay, endOfDay } from 'date-fns'

export const GOAL_LABELS_PT: Record<string, string> = {
  GAIN_MUSCLE: 'Ganho de massa muscular',
  LOSE_FAT: 'Perda de gordura',
  RECOMPOSITION: 'Recomposição corporal',
  MAINTAIN: 'Manutenção',
}

export const LEVEL_LABELS_PT: Record<string, string> = {
  SEDENTARY: 'Sedentário',
  LIGHT: 'Iniciante',
  MODERATE: 'Intermediário',
  ACTIVE: 'Ativo',
  VERY_ACTIVE: 'Avançado',
}

/** Data de hoje (yyyy-MM-dd) no fuso America/Sao_Paulo. */
export function saoPauloDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
}

/** Hora atual (HH:mm) no fuso America/Sao_Paulo. */
export function saoPauloTimeStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
}

/**
 * Intervalo [início, fim] de um dia para consultas no Prisma.
 * Usa o truque T12:00:00 já adotado em copyMealsFromYesterday/applyTemplate
 * para casar com como os logs são gravados.
 */
export function dayRange(dateStr?: string): { start: Date; end: Date; dateStr: string } {
  const ds = dateStr ?? saoPauloDateStr()
  const base = new Date(ds + 'T12:00:00')
  return { start: startOfDay(base), end: endOfDay(base), dateStr: ds }
}

export interface FoodMacros {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  servingSize: number
}

/** Escala os macros de um alimento pela quantidade consumida (em gramas). */
export function scaleMacros(food: FoodMacros, quantityG: number) {
  const ratio = quantityG / (food.servingSize || 100)
  return {
    calories: food.calories * ratio,
    proteinG: food.proteinG * ratio,
    carbsG: food.carbsG * ratio,
    fatG: food.fatG * ratio,
  }
}

export function round(n: number): number {
  return Math.round(n)
}
