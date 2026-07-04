import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos de Uso — FitSync',
  description: 'Termos de Uso do FitSync.',
}

const ATUALIZACAO = '4 de julho de 2026'

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-medium mt-8 mb-3">{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-text-muted)' }}>{children}</p>
}

export default function TermosPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <Link href="/" className="text-sm" style={{ color: 'var(--color-primary)' }}>← Voltar ao início</Link>
        <h1 className="text-2xl font-medium mt-4 mb-1">Termos de Uso</h1>
        <p className="text-xs mb-8" style={{ color: 'var(--color-text-muted)' }}>Última atualização: {ATUALIZACAO}</p>

        <P>
          Bem-vindo ao FitSync. Estes Termos de Uso (&quot;Termos&quot;) regulam o acesso e a utilização do site,
          aplicativo web e serviços do FitSync (&quot;Serviço&quot;), incluindo o assistente por WhatsApp. Ao criar uma
          conta ou usar o Serviço, você declara que leu, entendeu e concorda com estes Termos e com a nossa{' '}
          <Link href="/privacidade" style={{ color: 'var(--color-primary)' }}>Política de Privacidade</Link>.
          Se não concordar, não utilize o Serviço.
        </P>

        <H2>1. O que é o FitSync</H2>
        <P>
          O FitSync é uma plataforma de acompanhamento de treinos e alimentação que utiliza inteligência
          artificial para registrar refeições e treinos, calcular estimativas de calorias e macronutrientes,
          gerar sugestões de treinos e cardápios e conversar com você pelo aplicativo e pelo WhatsApp.
        </P>

        <H2>2. Aviso importante: o FitSync não é um serviço de saúde</H2>
        <P>
          O FitSync é uma ferramenta de organização, registro e informação de caráter educacional. As sugestões
          geradas por inteligência artificial <strong>não constituem consulta, diagnóstico, prescrição médica,
          nutricional ou de educação física</strong> e não substituem o acompanhamento de médicos, nutricionistas
          ou profissionais de educação física habilitados. Valores de calorias e macronutrientes são estimativas
          e podem conter imprecisões. Consulte um profissional de saúde antes de iniciar qualquer dieta ou programa
          de exercícios, especialmente se você possui condições de saúde preexistentes. Em caso de dor, lesão ou
          sintomas, procure atendimento profissional imediatamente.
        </P>

        <H2>3. Elegibilidade e conta</H2>
        <P>
          O Serviço destina-se a maiores de 18 anos. Ao se cadastrar, você se compromete a fornecer informações
          verdadeiras e a manter a confidencialidade da sua senha. Você é responsável pelas atividades realizadas
          na sua conta. O vínculo do WhatsApp é pessoal: vincule apenas número de telefone de sua titularidade.
        </P>

        <H2>4. Assinatura, período de teste e pagamento</H2>
        <P>
          O FitSync é oferecido por assinatura: plano mensal de R$ 29,90/mês ou plano anual de R$ 257/ano, ambos
          com 7 (sete) dias de teste gratuito com acesso completo. A primeira cobrança ocorre após o período de
          teste. Os pagamentos são processados pela Asaas Gestão Financeira S.A. via PIX, boleto ou cartão de
          crédito. A assinatura é renovada automaticamente a cada ciclo até o cancelamento. Os preços podem ser
          reajustados mediante aviso prévio por e-mail ou no aplicativo, valendo para o ciclo seguinte.
        </P>

        <H2>5. Cancelamento e reembolso</H2>
        <P>
          Você pode cancelar a assinatura a qualquer momento em Configurações → Assinatura, cessando as cobranças
          futuras. Nos termos do art. 49 do Código de Defesa do Consumidor, você pode desistir da contratação em
          até 7 (sete) dias corridos após o primeiro pagamento, com reembolso integral — basta solicitar pelo
          e-mail de contato. Após esse prazo, valores já pagos referentes ao ciclo vigente não são reembolsáveis,
          e o acesso permanece ativo até o fim do período pago.
        </P>

        <H2>6. Uso aceitável</H2>
        <P>
          Você concorda em não: (a) usar o Serviço para fins ilícitos; (b) tentar acessar contas ou dados de
          terceiros; (c) sobrecarregar, explorar falhas ou fazer engenharia reversa da plataforma; (d) revender
          ou sublicenciar o Serviço; (e) enviar conteúdo ofensivo, ilegal ou que viole direitos de terceiros.
          O uso do assistente está sujeito a limites técnicos razoáveis (como limite diário de mensagens) para
          garantir a estabilidade do Serviço. Contas que violem estes Termos podem ser suspensas ou encerradas.
        </P>

        <H2>7. Conteúdo gerado por IA</H2>
        <P>
          Parte das respostas, planos e análises é gerada por modelos de inteligência artificial de terceiros.
          Apesar dos nossos esforços de qualidade, respostas podem conter erros, imprecisões ou omissões. Use o
          bom senso e a orientação de profissionais para decisões sobre a sua saúde.
        </P>

        <H2>8. Propriedade intelectual</H2>
        <P>
          A marca FitSync, o software, o design e os conteúdos da plataforma pertencem ao FitSync ou aos seus
          licenciantes. Os dados que você registra (refeições, treinos, medidas) são seus; você nos concede
          licença para processá-los exclusivamente para a prestação do Serviço, conforme a Política de Privacidade.
        </P>

        <H2>9. Disponibilidade e limitação de responsabilidade</H2>
        <P>
          Trabalhamos para manter o Serviço disponível e seguro, mas ele é fornecido &quot;no estado em que se
          encontra&quot;, podendo sofrer interrupções por manutenção, falhas de terceiros (hospedagem, WhatsApp,
          provedores de IA e de pagamento) ou eventos fora do nosso controle. Na máxima extensão permitida pela
          lei, a responsabilidade total do FitSync limita-se ao valor pago por você nos 12 meses anteriores ao
          evento. Nada nestes Termos exclui direitos irrenunciáveis do consumidor.
        </P>

        <H2>10. Encerramento</H2>
        <P>
          Você pode encerrar sua conta a qualquer momento solicitando pelo e-mail de contato. Podemos encerrar
          ou suspender o acesso em caso de violação destes Termos, mediante comunicação. Após o encerramento,
          seus dados serão tratados conforme a Política de Privacidade.
        </P>

        <H2>11. Alterações destes Termos</H2>
        <P>
          Podemos atualizar estes Termos para refletir mudanças no Serviço ou na legislação. Alterações relevantes
          serão comunicadas por e-mail ou no aplicativo com antecedência razoável. O uso continuado após a vigência
          das alterações constitui concordância.
        </P>

        <H2>12. Contato e foro</H2>
        <P>
          Dúvidas e solicitações: <a href="mailto:contato@fitsync.app.br" style={{ color: 'var(--color-primary)' }}>contato@fitsync.app.br</a>.
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro do domicílio
          do consumidor para dirimir controvérsias.
        </P>
      </div>
    </div>
  )
}
