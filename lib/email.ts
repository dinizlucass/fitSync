/**
 * Mensageria transacional via Resend (https://resend.com).
 * Sem RESEND_API_KEY configurada, vira no-op silencioso (loga e segue) —
 * o app nunca quebra por causa de e-mail.
 *
 * EMAIL_FROM: use um domínio verificado no Resend em produção.
 * Para testes, o Resend aceita onboarding@resend.dev (só envia pro seu próprio e-mail).
 */
import { reportError } from '@/lib/monitoring'

// Lida em tempo de CHAMADA (não no load do módulo) — const de módulo congelava
// a URL antes de envs dinâmicas/testes e gerava e-mails com a URL antiga.
function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fitsync.app.br'
}

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

  // Reply-To: o domínio no Resend só ENVIA (não tem caixa de entrada). Sem isto,
  // respostas vão pra contato@fitsync.app.br e se perdem. Aponta para uma caixa real.
  const replyTo = process.env.EMAIL_REPLY_TO

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
        ...(replyTo ? { reply_to: replyTo } : {}),
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
      <a href="${appUrl()}" style="color:#1D9E75;">${appUrl().replace('https://', '')}</a>
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
      <div style="text-align:center;margin-top:20px;">${button(`${appUrl()}/app/configuracoes`, 'Conectar meu WhatsApp')}</div>
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

// ─── Billing (disparados pelo webhook do Asaas nas transições de status) ───

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const dateBR = (d?: Date | null) =>
  d ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric' }).format(d) : null

/** Trial iniciado — cartão salvo, acesso liberado antes da 1ª cobrança. */
export function sendTrialStartedEmail(to: string, name?: string | null, trialEndsAt?: Date | null): Promise<boolean> {
  const firstName = name?.split(' ')[0]
  const endStr = dateBR(trialEndsAt)
  return sendEmail({
    to,
    subject: 'Seu teste grátis do FitSync começou 🎉',
    html: layout(`
      <h2 style="margin:0 0 12px;font-size:18px;">Tudo certo${firstName ? `, ${firstName}` : ''}! 🎉</h2>
      <p>Seu <strong>teste grátis de 7 dias</strong> está ativo — acesso completo ao app, à geração de treino e dieta por IA e ao coach no WhatsApp.</p>
      ${endStr ? `<p>Sua primeira cobrança só acontece em <strong>${endStr}</strong>. Antes disso, você pode cancelar quando quiser, sem custo.</p>` : ''}
      <div style="text-align:center;margin-top:20px;">${button(`${appUrl()}/app/hoje`, 'Começar agora')}</div>
    `),
  })
}

/** Pagamento confirmado — assinatura ativa. */
export function sendPaymentConfirmedEmail(
  to: string,
  params: { name?: string | null; planName: string; value: number; nextDueDate?: Date | null }
): Promise<boolean> {
  const firstName = params.name?.split(' ')[0]
  const nextStr = dateBR(params.nextDueDate)
  return sendEmail({
    to,
    subject: 'Pagamento confirmado — bem-vindo ao FitSync Premium ✅',
    html: layout(`
      <h2 style="margin:0 0 12px;font-size:18px;">Pagamento confirmado${firstName ? `, ${firstName}` : ''}! ✅</h2>
      <p>Sua assinatura <strong>FitSync Premium</strong> está ativa. Obrigado por fazer parte!</p>
      <table style="width:100%;font-size:14px;margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#666;">Plano</td><td style="padding:6px 0;text-align:right;font-weight:500;">${params.planName}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Valor</td><td style="padding:6px 0;text-align:right;font-weight:500;">${brl(params.value)}</td></tr>
        ${nextStr ? `<tr><td style="padding:6px 0;color:#666;">Próxima cobrança</td><td style="padding:6px 0;text-align:right;font-weight:500;">${nextStr}</td></tr>` : ''}
      </table>
      <div style="text-align:center;margin-top:20px;">${button(`${appUrl()}/app/hoje`, 'Ir para o app')}</div>
      <p style="font-size:12px;color:#666;margin-top:16px;">Precisa de nota fiscal ou tem alguma dúvida? Responda este e-mail.</p>
    `),
  })
}

/** Pagamento não processado — assinatura em atraso, com link para regularizar. */
export function sendPaymentFailedEmail(to: string, name?: string | null): Promise<boolean> {
  const firstName = name?.split(' ')[0]
  return sendEmail({
    to,
    subject: 'Não conseguimos processar seu pagamento — FitSync',
    html: layout(`
      <h2 style="margin:0 0 12px;font-size:18px;">Ops${firstName ? `, ${firstName}` : ''}, tivemos um problema com o pagamento</h2>
      <p>Não conseguimos processar a cobrança da sua assinatura. Isso costuma ser um cartão vencido, sem limite ou bloqueado pelo banco.</p>
      <p>Regularize em poucos cliques para não perder o acesso:</p>
      <div style="text-align:center;margin:20px 0;">${button(`${appUrl()}/app/assinatura`, 'Atualizar pagamento')}</div>
      <p style="font-size:12px;color:#666;">Se já resolveu, pode ignorar este e-mail.</p>
    `),
  })
}

/** Assinatura cancelada — confirmação + porta aberta para voltar. */
export function sendSubscriptionCanceledEmail(to: string, name?: string | null): Promise<boolean> {
  const firstName = name?.split(' ')[0]
  return sendEmail({
    to,
    subject: 'Sua assinatura do FitSync foi cancelada',
    html: layout(`
      <h2 style="margin:0 0 12px;font-size:18px;">Assinatura cancelada${firstName ? `, ${firstName}` : ''}</h2>
      <p>Confirmamos o cancelamento da sua assinatura do FitSync. Você não será mais cobrado.</p>
      <p>Seus dados de treino e dieta continuam salvos. Se um dia quiser voltar, é só reativar — a gente continua de onde você parou. 💪</p>
      <div style="text-align:center;margin-top:20px;">${button(`${appUrl()}/app/assinatura`, 'Reativar assinatura')}</div>
    `),
  })
}
