-- FitSync — leads do quiz de captação (funil de tráfego pago).
-- Rode no Supabase → SQL Editor (o free tier bloqueia prisma migrate via IPv4).
CREATE TABLE IF NOT EXISTS "quiz_leads" (
  "id"          TEXT PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "whatsapp"    TEXT NOT NULL,
  "objective"   TEXT,
  "answers"     JSONB NOT NULL,
  "utmSource"   TEXT,
  "utmMedium"   TEXT,
  "utmCampaign" TEXT,
  "utmContent"  TEXT,
  "utmTerm"     TEXT,
  "fbclid"      TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "quiz_leads_createdAt_idx" ON "quiz_leads" ("createdAt");
