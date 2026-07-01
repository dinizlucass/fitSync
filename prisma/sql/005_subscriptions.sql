-- FitSync — assinaturas (cobrança recorrente via Asaas)
-- Rode no Supabase → SQL Editor (o free tier bloqueia prisma migrate via IPv4).

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    TEXT PRIMARY KEY,
  "userId"              TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan                  TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'PENDING',
  "billingType"         TEXT NOT NULL DEFAULT 'UNDEFINED',
  value                 DOUBLE PRECISION NOT NULL,
  cycle                 TEXT NOT NULL,
  "cpfCnpj"             TEXT,
  "asaasCustomerId"     TEXT,
  "asaasSubscriptionId" TEXT UNIQUE,
  "checkoutUrl"         TEXT,
  "currentDueDate"      TIMESTAMP(3),
  "trialEndsAt"         TIMESTAMP(3),
  "lastEvent"           TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
