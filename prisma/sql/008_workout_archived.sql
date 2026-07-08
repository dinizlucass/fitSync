-- FitSync — arquivar treinos ao gerar um programa novo (preserva histórico).
-- Rode no Supabase → SQL Editor.

ALTER TABLE workouts ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
