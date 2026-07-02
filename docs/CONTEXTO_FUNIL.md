# FitSync — Contexto completo para criação do funil de vendas

> Documento de briefing. Contém tudo sobre o produto, modelo de negócio, estado atual
> e restrições. Objetivo: gerar o funil completo de aquisição → ativação → conversão → retenção.

## 1. O que é o produto

**FitSync** — consultoria de treino e dieta com IA, direto no WhatsApp.

O usuário conversa com um coach de IA (nome: **Sync**) pelo WhatsApp como falaria com um
personal trainer humano: *"comi arroz, feijão e 200g de frango no almoço"* → registrado com
calorias e macros calculados. *"qual o treino de hoje?"* → responde com o plano dele.
*"não tô a fim de treinar"* → negocia uma versão mais curta. Também aceita **foto do prato**
(IA identifica os alimentos e registra).

Além do WhatsApp, tem web app completo (mobile-first): dashboard do dia, treinos com
registro de séries/cargas/recordes, dieta com metas de macros, gráficos de progresso,
gerador de treino e cardápio por IA.

**One-liner:** "Seu consultor de treino e dieta, direto no bolso."

## 2. Público-alvo

- Brasileiros que treinam (musculação principalmente) e querem controlar dieta sem fricção
- Pessoa que já tentou MyFitnessPal/planilha e abandonou pela chatice de registrar
- Não quer/não pode pagar personal + nutricionista (R$300–800/mês)
- Faixa 20–40 anos, usa WhatsApp o dia inteiro
- Dores: inconsistência, não saber se está comendo certo pra o objetivo, falta de acompanhamento

## 3. Posicionamento e diferenciais

| Concorrente | Fraqueza | FitSync |
|---|---|---|
| MyFitnessPal / FatSecret | Registro manual chato, em inglês, sem coach | Registro por mensagem/foto em PT-BR, coach que conversa |
| Personal + nutri | R$300–800/mês | R$29,90/mês |
| Planilha / caderno | Zero inteligência | IA calcula, ajusta e cobra consistência |
| Apps de treino (ex: Mfit) | Só treino, sem dieta/conversa | Treino + dieta + coach 24/7 integrados |

**Diferencial nº 1:** o WhatsApp como interface. Zero app pra abrir, zero fricção.
**Diferencial nº 2:** o coach entende intenção (function calling real sobre os dados do usuário,
não chatbot de menu). Ele lê o que a pessoa comeu HOJE e responde com números reais.

## 4. Modelo de negócio (já implementado)

- **Plano Mensal: R$ 29,90/mês**
- **Plano Anual: R$ 257/ano** (≈R$ 21,42/mês, "Economize 28%")
- **Trial: 7 dias grátis nos dois planos, SEM cartão antecipado** — cria conta, usa tudo,
  a 1ª fatura só vence no dia 7
- Pagamento via **Asaas** (gateway BR): cliente escolhe **PIX, boleto ou cartão** no checkout hospedado
- Cobrança recorrente automática por assinatura
- Sem plano grátis permanente (decisão estratégica: custo de IA por usuário > 0; trial-first, não freemium)
- Estratégia validada: se trial→pago vier <10% após ~100 trials, testar "reverse trial"
  (não pagou → modo limitado sem IA em vez de bloqueio total)

## 5. Funil atual (o que existe hoje)

```
Anúncio/orgânico → Landing (fit-sync-eight-zeta.vercel.app)
  → "Testar grátis por 7 dias" → /login (cadastro email/senha via Supabase)
  → Onboarding de metas (peso, altura, objetivo, atividade → calcula TDEE e macros)
  → App liberado (flag de bloqueio por assinatura existe mas está DESLIGADA até o Asaas ativar)
  → Configurações → Assinatura: escolhe plano + CPF → redireciona pro checkout Asaas
  → Vinculação WhatsApp: app gera código FIT-XXXXXX → usuário envia pro bot → vinculado
  → Usa o coach pelo WhatsApp
```

**Estados de assinatura:** TRIALING (7 dias) → ACTIVE (pagou) / PAST_DUE (fatura venceu) → CANCELED.
Webhook do Asaas atualiza automaticamente.

**Métrica de ativação nº 1 (definida):** % de contas que vinculam o WhatsApp e fazem o
1º registro no dia 1. Meta >50%. Trial→pago saudável: 15–25% (sem cartão antecipado).

## 6. O que está pronto (tecnicamente)

- Web app completo em produção (Vercel): landing, cadastro/login, dashboard "Hoje", treinos
  (criar/executar/histórico/PRs), dieta (metas, refeições, cardápio padrão), progresso
  (gráficos de peso/carga), gerador IA de treino (métodos PPL, Upper/Lower, ABC...) e de
  cardápio (3 variações por refeição batendo as calorias-alvo)
- Coach Sync no WhatsApp com function calling (8 tools), memória de conversa, rate limit
  (60 msgs/dia), análise de foto de refeição
- Número oficial do WhatsApp registrado na Meta Cloud API (Phone ID ativo)
- Checkout Asaas integrado (código pronto; falta ativar a conta Asaas e as chaves)
- Segurança: auditada (IDOR corrigidos, webhooks com validação de assinatura/token,
  verificação de posse do número por código)
- Monitoramento de erros com alerta em tempo real (webhook Discord opcional)

## 7. Restrições e pendências importantes (impactam o funil)

1. **Sem CNPJ ainda** → Meta Business Verification pendente → **o bot NÃO pode iniciar
   conversa** (sem mensagens proativas/templates). Só responde quem manda mensagem primeiro.
   Consequência: lembretes de fim de trial e reengajamento por WhatsApp NÃO são possíveis
   ainda — avisos precisam ser in-app ou por e-mail. Plano: abrir MEI quando a receita entrar.
2. **Conta Asaas ainda não ativada** (código pronto, faltam as chaves) → hoje ninguém paga.
   O bloqueio por assinatura (`SUBSCRIPTION_ENFORCED`) liga na sequência.
3. **Sem termos de uso / política de privacidade ainda** (LGPD — coleta CPF, telefone,
   dados de saúde). Bloqueante legal antes de tráfego pago.
4. Founder solo, orçamento de mídia limitado — funil precisa de ciclo de aprendizado curto.
5. Domínio próprio ainda não configurado (hoje: fit-sync-eight-zeta.vercel.app).
6. E-mail transacional não configurado (só o e-mail de confirmação do Supabase).

## 8. Ativos existentes

- Landing page atual (dark, PT-BR): hero com mockups de celular, seção funcionalidades,
  "como funciona" com mockup de conversa do WhatsApp, planos (Mensal/Anual), CTA final
- Identidade: verde #1D9E75, fonte Inter, tom informal-direto ("Bora", "fechou")
- Persona do coach: **Sync** — direto, gente boa, motivador sem puxa-saquismo, fala como
  personal no WhatsApp, não usa "Prezado" nem textão
- Nenhum criativo de anúncio, e-mail ou sequência produzidos ainda
- Nenhuma base de leads; Instagram/social não montados ainda

## 9. O que o funil precisa cobrir (pedido)

- **Topo:** estratégia de aquisição (Meta Ads prioritário; ângulos de criativo, públicos,
  oferta), considerando CPM/CPC Brasil e ticket R$29,90
- **Meio:** landing/página de captura (a atual serve? o que testar), onboarding de ativação
  (meta: WhatsApp vinculado no dia 1)
- **Fundo:** conversão trial→pago sem poder mandar WhatsApp proativo (avisos in-app/e-mail),
  recuperação de PAST_DUE via PIX
- **Retenção:** hábito diário via coach, análise semanal, o que reduzir churn
- **Métricas:** funil completo com benchmarks e metas por etapa
- KPIs econômicos: CAC-alvo, LTV estimado (assinatura R$29,90, churn a estimar), payback

## 10. Links

- App/landing: https://fit-sync-eight-zeta.vercel.app
- Repo: github.com/dinizlucass/fitSync (privado)
- Stack: Next.js 16 + Supabase + Prisma + OpenAI (GPT-4.1-mini no coach, GPT-4o nos geradores)
  + Meta WhatsApp Cloud API + Asaas — hospedado na Vercel
