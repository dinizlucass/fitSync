# FitSync — auditoria e melhorias de 07/09/2026

## Avaliação

O produto já tem landing, quiz, onboarding, treino, dieta, coach, cobrança e painel administrativo. A prioridade comercial é fazer a oferta corresponder à entrega, reduzir abandono entre quiz e ativação e medir quantos usuários realmente chegam ao pagamento. Não há evidência nesta revisão para prometer aumento percentual de conversão.

## Melhorias aplicadas

- **Quiz:** proteção contra clique duplo, voltar para corrigir respostas preservando valores, decimais com ponto/vírgula, campos acessíveis, recuperação de erro de conexão e validação no servidor de opções, números, restrições, nome e telefone. Testados 64 cenários de resultado (objetivo × local × frequência). A validação de telefone verifica formato, não comprova posse nem existência da conta WhatsApp.
- **Oferta e continuidade:** link visível para o quiz na landing; nome reaproveitado no cadastro sem colocá-lo na URL; objetivo, altura, peso e atividade inicial reaproveitados no onboarding. Data de nascimento continua sendo confirmada, pois o quiz só conhece uma faixa etária. A prévia do onboarding usa as mesmas funções de cálculo do servidor.
- **Transparência:** cadastro e resultado esclarecem cartão, mensal de R$ 29,90 após sete dias e anual sem trial. Resultado apresentado como prévia, sem prazo garantido de mudança de peso nem promessa de lembretes/ajustes semanais automáticos. FAQ de troca de plano orienta suporte, pois a migração automática não está implementada.
- **Medição:** respostas individuais deixam de acompanhar eventos `quiz_answered`; lead só é contabilizado quando salvo. CAPI do quiz executa com `after`, com timeout de rede. Removida a atribuição incorreta de `gclid` a `fbclid`. Isso não constitui auditoria completa de cookies, gravações de sessão ou conformidade legal.
- **Assinatura:** operações de IA verificam acesso no servidor, respeitando `SUBSCRIPTION_ENFORCED`; cobre geradores, refinamentos, coach, fotos e insights. Trial expirado não libera acesso apenas por manter o status TRIALING. Recuperação prioriza a cobrança já existente. Polling de confirmação encerra o carregamento e limpa o timer. Falha de banco na consulta do webhook Asaas retorna erro para permitir reentrega.
- **Treino:** registro de sessão confirma propriedade do treino e pertencimento dos exercícios. Edição substitui exercícios atomicamente, preservando o treino anterior se a gravação falhar.
- **Dieta:** busca inicial retorna IDs reais e exige autenticação; novos alimentos usam a porção correspondente aos nutrientes recebidos. Corrigida a base incoerente do whey no seed. Quantidades inválidas são recusadas; resultados antigos de busca não sobrescrevem os novos; falha de conexão não deixa o modal preso. Dados já existentes não foram migrados.
- **Dependências:** Next.js 16.2.6 → 16.3.4 e correções compatíveis via npm. Alertas da auditoria caíram de 13 (10 altos, 3 moderados) para 4 altos na cadeia do Prisma. O CLI Prisma foi atualizado pelo npm para 7.10.0; cliente/adapter declarados permanecem 7.8.0. Validar a integração de banco em homologação antes de publicar.

## Verificação e limites

- `npm run build`: **aprovado com Next.js 16.3.4**, incluindo geração Prisma, TypeScript e geração das 29 páginas estáticas.
- `npm test`: **74 testes aprovados**, incluindo payloads inválidos na action pública e autorização premium com banco simulado.
- `npm run test:smoke`: **18 verificações HTTP aprovadas** no servidor local antes da atualização de dependências: páginas públicas, quatro ângulos do quiz, redirecionamentos de páginas protegidas e APIs sem autenticação.
- Navegador: quiz de saúde, ângulo ganhar massa, clique duplo, decimais, limites numéricos, botão voltar, seleção exclusiva de restrições, telefone inválido e CTA da landing. Inspeção visual mobile em 390 × 844. Não foi gravado lead fictício em produção.
- Projeto `video/`: TypeScript aprovado; fontes dos criativos inspecionadas. Vídeos não foram renderizados novamente nem tiveram áudio revisado integralmente.
- Pagamento e WhatsApp: o responsável informou que já os testou. Não foram repetidas cobranças, mensagens, cadastros reais ou alterações de banco nesta execução. Testes anteriores não substituem homologação das mudanças desta revisão.
- A revisão não certifica que todas as funcionalidades, condições clínicas, falhas de integração e cenários concorrentes estejam cobertos. Build e testes automatizados não substituem testes autenticados de ponta a ponta.

## O que falta para vender melhor

1. **Homologar e publicar este conjunto:** especialmente gravação de dieta, treino, trial vencido e recuperação de assinatura. Confirmar também compatibilidade das versões Prisma. Não houve deploy nesta tarefa.
2. **Resolver os quatro alertas restantes:** `deepmerge-ts`, `mysql2` e sua cadeia Prisma. O npm sugeriu downgrade incompatível para Prisma 6; não foi aplicado. Avaliar atualização compatível do fornecedor e exposição real do runtime.
3. **Medir o funil por coorte/campanha:** quiz iniciado → concluído → cadastro → WhatsApp vinculado → primeiro registro → trial → primeiro pagamento. Hoje o lead não tem vínculo persistente com o usuário/assinatura; UTMs locais não fecham sozinhas essa atribuição. Priorizar custo por cliente ativado e pagante, não apenas custo por lead.
4. **Persistir preferências:** local de treino e restrições do quiz ainda precisam ser confirmados no gerador. Uma evolução do perfil deve guardar esses dados e alimentar a IA. A prévia não é o plano completo salvo no app.
5. **Conferir dados históricos de alimentos:** a correção de porção vale para novos registros. Auditar registros antigos e unidades como “2 ovos” antes de uma migração; não sobrescrever números nutricionais de usuários automaticamente.
6. **Revisar privacidade e prova social:** conferir configuração de PostHog/Clarity/Pixel, tratamento de dados do quiz, operadores declarados e autorização dos depoimentos existentes. Não foram inventados depoimentos, resultados ou números de clientes.
7. **Executar um teste comercial controlado:** usar um ângulo por campanha e a rota correspondente do quiz; comparar com cadastro direto, mantendo oferta e público comparáveis. Decidir com base em ativação e pagamento observados. Aumentar investimento apenas após confirmar a economia do funil.

## Ambiente observado

Foram conferidos somente indicadores de configuração, sem registrar segredos. No ambiente local, `SUBSCRIPTION_ENFORCED=false`, `ASAAS_ENV=production`, `ASAAS_API_KEY` e `META_CAPI_ACCESS_TOKEN` ausentes. As demais integrações principais têm variáveis configuradas. Isso **não comprova o estado da Vercel** e não invalida os testes de produção informados pelo responsável.

## Referência técnica

Foram consultadas as instruções locais do Next.js e a documentação oficial de [Server Functions](https://nextjs.org/docs/app/api-reference/directives/use-server) e [after](https://nextjs.org/docs/app/api-reference/functions/after). O grafo existente foi usado para orientação; o quiz ainda não constava nele, portanto suas conclusões foram conferidas diretamente no código.
