/**
 * Conteúdo de prova social da landing — editável por você, sem mexer no layout.
 *
 * Regra de ouro: NÃO invente depoimentos nem números. O que estiver vazio aqui
 * simplesmente não aparece no site. Preencha com dados REAIS quando tiver.
 */

// ─── Depoimentos ─────────────────────────────────────────────────────────
export interface Testimonial {
  /** Nome de quem deu o depoimento (peça autorização para usar). */
  name: string
  /** Resultado/contexto curto. Ex.: "Perdeu 8 kg em 3 meses" ou "Treina há 2 anos". */
  tag: string
  /** O depoimento em si, nas palavras da pessoa. */
  quote: string
}

/**
 * ⚠️ VAZIO de propósito. Enquanto estiver vazio, a seção de depoimentos NÃO
 * aparece na landing (nada falso vai ao ar). Assim que tiver depoimentos reais
 * de usuários, adicione-os aqui — a seção passa a aparecer automaticamente.
 *
 * Modelo (copie um objeto destes para dentro do array, com dados reais):
 *   { name: 'Rafael M.', tag: 'Ganhou 4 kg de massa em 8 semanas',
 *     quote: 'Só consegui seguir a dieta registrando tudo pelo WhatsApp. Mudou o jogo.' }
 */
export const TESTIMONIALS: Testimonial[] = []

// ─── Métricas de tração ──────────────────────────────────────────────────
export interface Stat {
  value: string
  label: string
}

/**
 * ⚠️ VAZIO de propósito. Só use números REAIS e verificáveis (ex.: "1.200+
 * treinos registrados", "300+ usuários"). Enquanto estiver vazio, esta faixa
 * não aparece — em vez dela mostramos os FATOS DO PRODUTO abaixo, que são
 * sempre verdadeiros. Quando sua base crescer, preencha aqui.
 */
export const STATS: Stat[] = []

/**
 * Fatos do produto — verdadeiros hoje, aparecem sempre. Não são métricas de
 * tração (não dependem de quantos usuários você tem), então é honesto exibir.
 */
export const PRODUCT_FACTS: Stat[] = [
  { value: '7 dias', label: 'grátis para testar' },
  { value: 'WhatsApp', label: 'coach de IA 24/7' },
  { value: 'TACO', label: 'base oficial de alimentos' },
  { value: 'IA', label: 'treino e dieta sob medida' },
]

// ─── Perguntas frequentes (quebra de objeções) ───────────────────────────
export interface Faq {
  q: string
  a: string
}

/** Respostas verdadeiras, alinhadas ao produto real. Ajuste o texto se quiser. */
export const FAQ: Faq[] = [
  {
    q: 'Preciso de cartão para testar?',
    a: 'Sim. O teste de 7 dias no plano mensal pede um cartão para o seu acesso não ser interrompido ao fim do período. Mas você não paga nada durante o teste e pode cancelar quando quiser, direto nas Configurações — sem cobrança.',
  },
  {
    q: 'Como faço para cancelar?',
    a: 'Em Configurações → Assinatura, com um clique. Se cancelar dentro dos 7 dias grátis, nada é cobrado. Sem burocracia e sem ligar para ninguém.',
  },
  {
    q: 'Funciona sem WhatsApp?',
    a: 'Funciona. O WhatsApp é um atalho para registrar treino e refeição por mensagem, mas tudo também é feito pelo app: treinos, dieta, progresso e a IA consultora.',
  },
  {
    q: 'Meus dados estão seguros?',
    a: 'Sim. Seguimos a LGPD, seus dados trafegam criptografados e você pode excluir a conta e todos os dados quando quiser. Veja os detalhes na nossa Política de Privacidade.',
  },
  {
    q: 'A IA substitui um personal ou nutricionista?',
    a: 'A IA gera treinos e dietas personalizados e te acompanha no dia a dia, com base nos seus objetivos. Ela não substitui avaliação médica — para condições de saúde específicas, consulte um profissional.',
  },
  {
    q: 'Posso trocar de plano depois?',
    a: 'Pode. Comece no mensal com os 7 dias grátis e migre para o anual (com desconto) quando quiser.',
  },
]
