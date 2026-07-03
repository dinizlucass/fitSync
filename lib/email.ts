/**
 * Mensageria transacional via Resend (https://resend.com).
 * Sem RESEND_API_KEY configurada, vira no-op silencioso (loga e segue) —
 * o app nunca quebra por causa de e-mail.
 *
 * EMAIL_FROM: use um domínio verificado no Resend em produção.
 * Para testes, o Resend aceita onboarding@resend.dev (só envia pro seu próprio e-mail).
 */
import { reportError } from '@/lib/monitoring'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fit-sync-eight-zeta.vercel.app'

interface SendEmailParams {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY ausente — e-mail "${subject}" para ${to} não enviado`)
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'FitSync <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      reportError('email:send', new Error(await res.text()), { to, subject })
      return false
    }
    return true
  } catch (e) {
    reportError('email:send', e, { to, subject })
    return false
  }
}

// ─── Layout base ────────────────────────────────────────────────────────

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background-color:#F5F5F0;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:22px;font-weight:600;color:#111111;">Fit<span style="color:#1D9E75;">Sync</span></span>
    </div>
    <div style="background:#ffffff;border-radius:12px;padding:28px;color:#111111;font-size:14px;line-height:1.6;">
      ${content}
    </div>
    <p style="text-align:center;font-size:11px;color:#999999;margin-top:16px;">
      FitSync — seu consultor de treino e dieta, direto no bolso.<br/>
      <a href="${APP_URL}" style="color:#1D9E75;">${APP_URL.replace('https://', '')}</a>
    </p>
  </div>
</body>
</html>`
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#1D9E75;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;font-size:14px;">${label}</a>`

// ─── Templates ──────────────────────────────────────────────────────────

/** Boas-vindas — disparado na criação do usuário no app (1º acesso). */
export function sendWelcomeEmail(to: string, name?: string | null): Promise<boolean> {
  const firstName = name?.split(' ')[0]
  return sendEmail({
    to,
    subject: 'Bem-vindo ao FitSync! Seus próximos passos 💪',
    html: layout(`
      <h2 style="margin:0 0 12px;font-size:18px;">Bem-vindo${firstName ? `, ${firstName}` : ''}! 🎉</h2>
      <p>Sua conta no FitSync está pronta. Em 2 minutos você deixa tudo funcionando:</p>
      <ol style="padding-left:20px;margin:16px 0;">
        <li style="margin-bottom:8px;"><strong>Defina suas metas</strong> — peso, altura e objetivo. A gente calcula suas calorias e macros.</li>
        <li style="margin-bottom:8px;"><strong>Conecte o WhatsApp</strong> — em Configurações → WhatsApp. É lá que a mágica acontece.</li>
        <li><strong>Mande sua primeira mensagem</strong> — ex: <em>"almocei arroz, feijão e 200g de frango"</em>. Registrado. Simples assim.</li>
      </ol>
      <div style="text-align:center;margin-top:20px;">${button(`${APP_URL}/app/configuracoes`, 'Conectar meu WhatsApp')}</div>
    `),
  })
}

/** Conta criada pelo admin — envia link seguro para a pessoa definir a senha. */
export function sendAccountCreatedEmail(to: string, setPasswordLink: string, name?: string | null): Promise<boolean> {
  const firstName = name?.split(' ')[0]
  return sendEmail({
    to,
    subject: 'Sua conta no FitSync foi criada — defina sua senha',
    html: layout(`
      <h2 style="margin:0 0 12px;font-size:18px;">Olá${firstName ? `, ${firstName}` : ''}!</h2>
      <p>Uma conta no <strong>FitSync</strong> foi criada para você com este e-mail.</p>
      <p>Clique abaixo para definir sua senha e começar a usar:</p>
      <div style="text-align:center;margin:20px 0;">${button(setPasswordLink, 'Definir minha senha')}</div>
      <p style="font-size:12px;color:#666;">O link expira em breve. Se você não esperava este e-mail, pode ignorá-lo.</p>
    `),
  })
}
