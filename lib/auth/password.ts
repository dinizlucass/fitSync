/**
 * Regras de senha do FitSync — usadas no cadastro, redefinição e troca de senha.
 * Mantém a validação em UM lugar só pra as 3 telas ficarem consistentes.
 */

/** Texto de dica exibido sob os campos de senha. */
export const PASSWORD_RULES = 'Mínimo 8 caracteres, com 1 letra maiúscula e 1 número.'

/** Retorna a mensagem de erro (pt-BR) ou null se a senha é válida. */
export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'A senha deve ter no mínimo 8 caracteres.'
  if (!/[A-Z]/.test(pw)) return 'A senha precisa de pelo menos 1 letra maiúscula.'
  if (!/[0-9]/.test(pw)) return 'A senha precisa de pelo menos 1 número.'
  return null
}
