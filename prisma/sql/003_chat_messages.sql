-- FitSync — tabela de memória de conversa do coach (Sync)
-- Rode este SQL no Supabase → SQL Editor (o free tier bloqueia prisma migrate via IPv4).

CREATE TABLE IF NOT EXISTS chat_messages (
  id         TEXT PRIMARY KEY,
  "userId"   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  channel    TEXT NOT NULL DEFAULT 'whatsapp',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "chat_messages_userId_createdAt_idx"
  ON chat_messages ("userId", "createdAt");
