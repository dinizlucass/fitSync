/**
 * Controle de acesso do painel admin.
 * Admins são definidos por e-mail via env ADMIN_EMAILS (separados por vírgula).
 * Fallback: e-mail do dono do projeto — sobrescreva com a env em produção.
 */

const DEFAULT_ADMIN = 'antoniodinizlucas@gmail.com'

export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? DEFAULT_ADMIN
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmails().includes(email.toLowerCase())
}
