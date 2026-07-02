-- FitSync — verificação de número WhatsApp por código.
-- Rode no Supabase → SQL Editor (o free tier bloqueia prisma migrate via IPv4).

ALTER TABLE users ADD COLUMN IF NOT EXISTS "phoneVerifyCode" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "phoneVerifyExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "users_phoneVerifyCode_key"
  ON users ("phoneVerifyCode");
