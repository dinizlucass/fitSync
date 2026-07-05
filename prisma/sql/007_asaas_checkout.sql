-- FitSync — checkout hospedado do Asaas (cartão + trial).
-- Rode no Supabase → SQL Editor.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS "asaasCheckoutId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_asaasCheckoutId_key"
  ON subscriptions ("asaasCheckoutId");
