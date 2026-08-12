# E-mails de auth do Supabase via Resend (FitSync)

Roteia os e-mails de autenticação (reset de senha, confirmação, magic link, troca
de e-mail) pelo **Resend**, saindo de `@fitsync.app.br` e com a identidade do FitSync.

> Transacionais de billing/boas-vindas já saem pelo Resend via `lib/email.ts`.
> Isto aqui é só para os e-mails que o **Supabase** dispara.

---

## 1. Credenciais SMTP do Resend

No painel do Resend (mesmo domínio já verificado, `fitsync.app.br`):

- **Host:** `smtp.resend.com`
- **Porta:** `465` (SSL) — ou `587` (TLS) se preferir
- **Usuário:** `resend`
- **Senha:** uma **API key do Resend** (pode reusar a `RESEND_API_KEY` ou criar uma dedicada em Resend → API Keys)

## 2. Ativar Custom SMTP no Supabase

Dashboard → **Authentication → Emails → SMTP Settings** → *Enable Custom SMTP*:

| Campo | Valor |
|---|---|
| Sender email | `contato@fitsync.app.br` |
| Sender name | `FitSync` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | *(API key do Resend)* |

Salve. O `Sender email` precisa estar no domínio verificado no Resend.

## 3. Subir o rate limit de e-mail

Dashboard → **Authentication → Rate Limits** → *Rate limit for sending emails*.
O padrão do serviço embutido é baixíssimo (≈2–4/h). Com SMTP próprio, suba para
algo como **100/hora** (ajuste conforme o volume).

## 4. URL Configuration (essencial pro link funcionar)

Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://www.fitsync.app.br`
- **Redirect URLs (allowlist):**
  - `https://www.fitsync.app.br/**`
  - `http://localhost:3000/**` *(dev)*

Sem isso, o link do e-mail de reset cai fora do fluxo `/redefinir-senha`.

## 5. Colar os templates

Dashboard → **Authentication → Email Templates**. Para cada aba, cole o HTML do
arquivo correspondente e ajuste o **Subject**:

| Aba no Supabase | Arquivo | Subject |
|---|---|---|
| Reset Password | `reset-password.html` | `Redefinir sua senha — FitSync` |
| Confirm signup | `confirm-signup.html` | `Confirme seu e-mail — FitSync` |
| Magic Link | `magic-link.html` | `Seu link de acesso — FitSync` |
| Change Email Address | `change-email.html` | `Confirme seu novo e-mail — FitSync` |

> Variável usada: `{{ .ConfirmationURL }}` (link já pronto do Supabase).
> Outras disponíveis: `{{ .Token }}`, `{{ .SiteURL }}`, `{{ .Email }}`.

## 6. Testar

- Vá em `/login` → "Esqueci minha senha" → envie para seu e-mail.
- O e-mail deve chegar de `contato@fitsync.app.br`, com a cara do FitSync, e o
  botão deve levar a `/redefinir-senha` logado na sessão de recovery.

## Notas

- **Autoconfirmação:** hoje o projeto está com `mailer_autoconfirm: true` — signup
  não dispara o "Confirm signup". O template fica pronto caso você desligue o
  autoconfirm no futuro.
- **Convite de admin** (`adminCreateUser`) já manda o link via Resend por
  `lib/email.ts` (`sendAccountCreatedEmail`) — não usa o template do Supabase.
