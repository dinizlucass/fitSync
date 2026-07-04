import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade — FitSync',
  description: 'Como o FitSync coleta, usa e protege seus dados pessoais (LGPD).',
}

const ATUALIZACAO = '4 de julho de 2026'

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-medium mt-8 mb-3">{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-text-muted)' }}>{children}</p>
}
function LI({ children }: { children: React.ReactNode }) {
  return <li className="text-sm leading-relaxed mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{children}</li>
}

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <Link href="/" className="text-sm" style={{ color: 'var(--color-primary)' }}>← Voltar ao início</Link>
        <h1 className="text-2xl font-medium mt-4 mb-1">Política de Privacidade</h1>
        <p className="text-xs mb-8" style={{ color: 'var(--color-text-muted)' }}>Última atualização: {ATUALIZACAO}</p>

        <P>
          Esta Política explica como o FitSync (&quot;nós&quot;) trata os seus dados pessoais, em conformidade com a
          Lei Geral de Proteção de Dados — Lei nº 13.709/2018 (&quot;LGPD&quot;). Ela se aplica ao site
          www.fitsync.app.br, ao aplicativo web e ao assistente pelo WhatsApp. Canal do controlador para assuntos
          de privacidade: <a href="mailto:contato@fitsync.app.br" style={{ color: 'var(--color-primary)' }}>contato@fitsync.app.br</a>.
        </P>

        <H2>1. Quais dados coletamos</H2>
        <ul className="list-disc pl-5 mb-3">
          <LI><strong>Cadastro:</strong> nome, e-mail e senha (armazenada de forma criptografada pelo nosso provedor de autenticação). No login com Google: nome, e-mail e foto do perfil.</LI>
          <LI><strong>Cobrança:</strong> CPF ou CNPJ, plano contratado e status de pagamento. Dados de cartão são tratados diretamente pelo processador de pagamentos (Asaas) e não ficam armazenados conosco.</LI>
          <LI><strong>WhatsApp:</strong> número de telefone vinculado e o conteúdo das mensagens e fotos que você envia ao assistente.</LI>
          <LI><strong>Dados de saúde e hábitos (dados sensíveis):</strong> peso, altura, data de nascimento, sexo, objetivo físico, nível de atividade, refeições registradas, fotos de refeições, treinos, cargas e evolução corporal.</LI>
          <LI><strong>Uso técnico:</strong> registros de acesso (logs), identificadores de sessão (cookies essenciais) e dados necessários à segurança e ao funcionamento do Serviço.</LI>
        </ul>

        <H2>2. Para que usamos os dados</H2>
        <ul className="list-disc pl-5 mb-3">
          <LI>Prestar o Serviço: registrar refeições e treinos, calcular estimativas de calorias/macros, gerar planos e responder às suas mensagens (execução de contrato — art. 7º, V).</LI>
          <LI>Tratar dados de saúde que você mesmo registra, com o seu <strong>consentimento</strong>, exclusivamente para as funcionalidades do Serviço (art. 11, I). Você pode revogá-lo a qualquer momento — o que implica o encerramento das funcionalidades que dependem desses dados.</LI>
          <LI>Processar pagamentos e prevenir fraudes (execução de contrato e obrigação legal).</LI>
          <LI>Enviar e-mails transacionais (boas-vindas, redefinição de senha, avisos de cobrança) e comunicações sobre o Serviço.</LI>
          <LI>Garantir segurança, prevenir abusos e melhorar o Serviço (legítimo interesse — art. 7º, IX, sempre com o mínimo de dados necessário).</LI>
        </ul>

        <H2>3. Inteligência artificial</H2>
        <P>
          Para funcionar, o FitSync envia o conteúdo das suas mensagens, fotos de refeições e um resumo do seu
          perfil e registros (como metas e refeições do dia) a provedores de modelos de inteligência artificial
          (atualmente a OpenAI), que atuam como operadores de dados e estão contratualmente proibidos de usar
          esses dados para treinar seus modelos via API. Não venda ou compartilhe seus dados para publicidade.
        </P>

        <H2>4. Com quem compartilhamos (operadores)</H2>
        <ul className="list-disc pl-5 mb-3">
          <LI><strong>Supabase</strong> — autenticação e banco de dados.</LI>
          <LI><strong>Vercel</strong> — hospedagem da aplicação.</LI>
          <LI><strong>OpenAI</strong> — processamento das mensagens e imagens para gerar respostas e análises.</LI>
          <LI><strong>Meta Platforms (WhatsApp Business)</strong> — envio e recebimento das mensagens do assistente.</LI>
          <LI><strong>Asaas</strong> — processamento de pagamentos e emissão de cobranças.</LI>
          <LI><strong>Resend</strong> — envio de e-mails transacionais.</LI>
        </ul>
        <P>
          Alguns desses provedores estão localizados fora do Brasil (ex.: Estados Unidos), o que caracteriza
          transferência internacional de dados (arts. 33 e seguintes da LGPD), realizada com salvaguardas
          contratuais adequadas. Também poderemos compartilhar dados mediante ordem judicial ou obrigação legal.
        </P>

        <H2>5. Por quanto tempo guardamos</H2>
        <P>
          Mantemos seus dados enquanto sua conta existir. Após a exclusão da conta, os dados são eliminados ou
          anonimizados em até 30 dias, exceto registros que devamos manter por obrigação legal (ex.: dados fiscais
          de pagamento) ou para exercício regular de direitos, pelos prazos legais aplicáveis.
        </P>

        <H2>6. Seus direitos (art. 18 da LGPD)</H2>
        <P>
          Você pode solicitar a qualquer momento: confirmação de tratamento, acesso, correção, anonimização,
          portabilidade, informação sobre compartilhamentos, revogação de consentimento e <strong>eliminação</strong> dos
          seus dados. Basta escrever para{' '}
          <a href="mailto:contato@fitsync.app.br" style={{ color: 'var(--color-primary)' }}>contato@fitsync.app.br</a> —
          respondemos nos prazos da LGPD. Você também pode desvincular o WhatsApp e editar seus dados diretamente
          em Configurações. Caso entenda que seus direitos não foram atendidos, você pode peticionar à Autoridade
          Nacional de Proteção de Dados (ANPD).
        </P>

        <H2>7. Segurança</H2>
        <P>
          Adotamos medidas técnicas e organizacionais para proteger seus dados: criptografia em trânsito (HTTPS),
          senhas com hash, controle de acesso por conta, validação de assinatura nos webhooks, verificação de
          posse do número de WhatsApp por código e monitoramento de erros. Nenhum sistema é 100% seguro; em caso
          de incidente relevante, comunicaremos você e a ANPD conforme a lei.
        </P>

        <H2>8. Cookies</H2>
        <P>
          Utilizamos apenas cookies essenciais de autenticação e sessão, necessários para manter você conectado.
          Não utilizamos cookies de publicidade.
        </P>

        <H2>9. Crianças e adolescentes</H2>
        <P>
          O Serviço não se destina a menores de 18 anos e não coletamos intencionalmente dados de crianças e
          adolescentes. Se identificarmos uma conta nessas condições, ela será encerrada e os dados eliminados.
        </P>

        <H2>10. Alterações desta Política</H2>
        <P>
          Podemos atualizar esta Política para refletir mudanças no Serviço ou na legislação. Mudanças relevantes
          serão comunicadas por e-mail ou no aplicativo. A data da última atualização consta no topo desta página.
        </P>

        <H2>11. Contato</H2>
        <P>
          Encarregado pelo tratamento de dados (DPO) e canal de privacidade:{' '}
          <a href="mailto:contato@fitsync.app.br" style={{ color: 'var(--color-primary)' }}>contato@fitsync.app.br</a>.
        </P>

        <p className="text-xs mt-10" style={{ color: 'var(--color-text-muted)' }}>
          Veja também os nossos <Link href="/termos" style={{ color: 'var(--color-primary)' }}>Termos de Uso</Link>.
        </p>
      </div>
    </div>
  )
}
