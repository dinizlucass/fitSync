-- FitSync — adiciona a refeição "Ceia" ao enum MealType.
-- Rode no Supabase → SQL Editor (o free tier bloqueia prisma migrate via IPv4).

ALTER TYPE "MealType" ADD VALUE IF NOT EXISTS 'CEIA';
