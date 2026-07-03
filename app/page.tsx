import Link from 'next/link'
import { PLANS } from '@/lib/asaas/config'

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: v % 1 ? 2 : 0 })

export default function LandingPage() {
  const monthly = PLANS.monthly
  const annual = PLANS.annual
  const annualPerMonth = annual.value / 12
  const savingsPct = Math.round((1 - annual.value / (monthly.value * 12)) * 100)
  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-xl font-medium tracking-tight">
              <span className="text-black dark:text-white">Fit</span>
              <span style={{ color: 'var(--color-primary)' }}>Sync</span>
            </span>
            <div className="hidden md:flex items-center gap-6">
              <a href="#funcionalidades" className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Funcionalidades</a>
              <a href="#como-funciona" className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Como funciona</a>
              <a href="#planos" className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Planos</a>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="inline-flex text-sm px-3 sm:px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50 dark:hover:bg-gray-900" style={{ borderColor: 'var(--color-border)' }}>
              Entrar
            </Link>
            <Link href="/login?tab=signup" className="inline-flex text-sm px-3 sm:px-4 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90 whitespace-nowrap" style={{ backgroundColor: 'var(--color-primary)' }}>
              7 dias grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col items-center text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Agora com integração WhatsApp
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-medium leading-tight tracking-tight mb-6 max-w-3xl">
              Seu consultor de treino e dieta,{' '}
              <span style={{ color: 'var(--color-primary)' }}>direto no bolso</span>
            </h1>

            <p className="text-lg max-w-2xl mb-10" style={{ color: 'var(--color-text-muted)' }}>
              Registre treinos, controle sua dieta e acompanhe seu progresso com inteligência artificial.
              Tudo via WhatsApp ou pelo app — sem complicação.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <Link href="/login?tab=signup" className="inline-flex items-center justify-center text-sm px-6 py-3 rounded-lg text-white font-medium transition-opacity hover:opacity-90" style={{ backgroundColor: 'var(--color-primary)' }}>
                Testar grátis por {monthly.trialDays} dias
              </Link>
              <a href="#como-funciona" className="inline-flex items-center justify-center text-sm px-6 py-3 rounded-lg border transition-colors hover:bg-gray-50 dark:hover:bg-gray-900" style={{ borderColor: 'var(--color-border)' }}>
                Ver como funciona
              </a>
            </div>

            <p className="text-xs mb-16" style={{ color: 'var(--color-text-muted)' }}>
              {monthly.trialDays} dias grátis • PIX, boleto ou cartão • Cancele quando quiser
            </p>

            {/* Phone Mockups */}
            <div className="relative flex items-end justify-center gap-4 w-full max-w-3xl">
              {/* Left - Diet mockup (tilted) */}
              <div className="hidden sm:block transform -rotate-6 translate-y-4 flex-shrink-0" style={{ width: '180px' }}>
                <div className="rounded-2xl overflow-hidden shadow-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                  <div className="h-5 rounded-t-2xl flex items-center justify-center gap-1" style={{ backgroundColor: '#111' }}>
                    <div className="w-8 h-1 rounded-full bg-gray-700"></div>
                  </div>
                  <div className="p-3 space-y-2" style={{ backgroundColor: 'var(--color-surface)' }}>
                    <div className="text-xs font-medium">Dieta</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Hoje — 1.840 kcal</div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                      <div className="h-full rounded-full" style={{ width: '75%', backgroundColor: 'var(--color-primary)' }}></div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[['Prot', '142g', 'var(--color-primary)'], ['Carb', '195g', 'var(--color-carbs)'], ['Gord', '58g', 'var(--color-fat)']].map(([label, val, color]) => (
                        <div key={label} className="rounded-lg p-1.5 text-center" style={{ backgroundColor: 'var(--color-background)' }}>
                          <div className="text-xs font-medium" style={{ color }}>{val}</div>
                          <div className="text-xs" style={{ color: 'var(--color-text-muted)', fontSize: '9px' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1">
                      {['Frango grelhado', 'Arroz integral', 'Brócolis'].map(item => (
                        <div key={item} className="flex justify-between items-center py-1 border-b text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                          <span>{item}</span>
                          <span>100g</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Center - Dashboard (main) */}
              <div className="flex-shrink-0 z-10" style={{ width: '220px' }}>
                <div className="rounded-2xl overflow-hidden shadow-2xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                  <div className="h-6 rounded-t-2xl flex items-center justify-center gap-1" style={{ backgroundColor: '#111' }}>
                    <div className="w-10 h-1.5 rounded-full bg-gray-700"></div>
                  </div>
                  <div className="p-4 space-y-3" style={{ backgroundColor: 'var(--color-background)' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium">Bom dia, Rafael!</div>
                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Segunda-feira</div>
                      </div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>R</div>
                    </div>
                    {/* Mini calorie ring */}
                    <div className="flex items-center justify-center py-2">
                      <div className="relative">
                        <svg width="80" height="80" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="32" fill="none" strokeWidth="8" stroke="var(--color-border)" />
                          <circle cx="40" cy="40" r="32" fill="none" strokeWidth="8" stroke="var(--color-primary)"
                            strokeDasharray="201" strokeDashoffset="50" strokeLinecap="round"
                            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-sm font-medium">1.840</div>
                          <div className="text-xs" style={{ color: 'var(--color-text-muted)', fontSize: '9px' }}>kcal</div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[['Proteína', '142g', 'var(--color-primary)'], ['Carbs', '195g', 'var(--color-carbs)'], ['Gordura', '58g', 'var(--color-fat)']].map(([label, val, color]) => (
                        <div key={label} className="rounded-lg p-2" style={{ backgroundColor: 'var(--color-surface)' }}>
                          <div className="text-xs font-medium" style={{ color }}>{val}</div>
                          <div style={{ color: 'var(--color-text-muted)', fontSize: '9px' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg p-2" style={{ backgroundColor: 'var(--color-surface)' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5">
                            <path d="M18 20V10M12 20V4M6 20v-6"/>
                          </svg>
                        </div>
                        <div>
                          <div className="text-xs font-medium">Treino A — Peito</div>
                          <div className="text-xs" style={{ color: 'var(--color-text-muted)', fontSize: '9px' }}>5 exercícios</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right - Workout mockup (tilted) */}
              <div className="hidden sm:block transform rotate-6 translate-y-4 flex-shrink-0" style={{ width: '180px' }}>
                <div className="rounded-2xl overflow-hidden shadow-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                  <div className="h-5 rounded-t-2xl flex items-center justify-center" style={{ backgroundColor: '#111' }}>
                    <div className="w-8 h-1 rounded-full bg-gray-700"></div>
                  </div>
                  <div className="p-3 space-y-2" style={{ backgroundColor: 'var(--color-surface)' }}>
                    <div className="text-xs font-medium">Treino A — Peito</div>
                    <div className="space-y-1.5">
                      {[
                        { name: 'Supino reto', sets: '4×8', weight: '80kg', pr: true },
                        { name: 'Crucifixo', sets: '3×12', weight: '16kg', pr: false },
                        { name: 'Paralelas', sets: '3×10', weight: 'Peso corporal', pr: false },
                      ].map(ex => (
                        <div key={ex.name} className="rounded-lg p-2 flex items-center justify-between" style={{ backgroundColor: 'var(--color-background)' }}>
                          <div>
                            <div className="flex items-center gap-1">
                              <div className="text-xs font-medium">{ex.name}</div>
                              {ex.pr && (
                                <span className="text-xs px-1 rounded" style={{ backgroundColor: '#fff8e1', color: 'var(--color-fat)', fontSize: '8px' }}>PR</span>
                              )}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--color-text-muted)', fontSize: '9px' }}>{ex.sets} • {ex.weight}</div>
                          </div>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }}></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funcionalidades" className="py-20" style={{ backgroundColor: 'var(--color-surface)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-medium tracking-tight mb-3">Tudo que você precisa para evoluir</h2>
            <p className="text-base" style={{ color: 'var(--color-text-muted)' }}>
              Funcionalidades pensadas para quem leva fitness a sério
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 20V10M12 20V4M6 20v-6"/>
                  </svg>
                ),
                title: 'Registro de treinos',
                desc: 'Registre cada série, repetição e carga. Detectamos automaticamente seus recordes pessoais.',
                color: 'var(--color-primary)',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a3 3 0 0 0-3 3v4H6a3 3 0 0 0 0 6h1v4a3 3 0 0 0 6 0v-4h1a3 3 0 0 0 0-6h-3V5a3 3 0 0 0-3-3z"/>
                  </svg>
                ),
                title: 'Controle de dieta',
                desc: 'Acompanhe calorias e macros em tempo real. Base de dados completa com tabela TACO.',
                color: 'var(--color-carbs)',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                ),
                title: 'Progresso visual',
                desc: 'Gráficos claros de evolução de peso e cargas. Veja sua consistência semana a semana.',
                color: 'var(--color-fat)',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                  </svg>
                ),
                title: 'IA consultora',
                desc: 'Análise semanal com insights personalizados. Registre tudo via WhatsApp com linguagem natural.',
                color: 'var(--color-alert)',
              },
            ].map((feature) => (
              <div key={feature.title} className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-card)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--color-surface)', color: feature.color }}>
                  {feature.icon}
                </div>
                <h3 className="text-sm font-medium mb-2">{feature.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-medium tracking-tight mb-3">Simples como mandar uma mensagem</h2>
              <p className="text-base mb-10" style={{ color: 'var(--color-text-muted)' }}>
                Registre treinos e refeições em linguagem natural. A IA entende e organiza tudo pra você.
              </p>
              <div className="space-y-6">
                {[
                  { step: '01', title: 'Crie sua conta', desc: 'Configure seus objetivos, peso, altura e nível de atividade.' },
                  { step: '02', title: 'Conecte o WhatsApp', desc: 'Um clique em Configurações gera seu código — envie pro nosso número e pronto, vinculado.' },
                  { step: '03', title: 'Registre tudo', desc: 'Diga "fiz supino 4x8 80kg" ou mande foto do prato. A IA cuida do resto.' },
                  { step: '04', title: 'Acompanhe a evolução', desc: 'Veja gráficos, recordes e receba insights semanais personalizados.' },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                      {item.step}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium mb-1">{item.title}</h3>
                      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* WhatsApp chat mockup */}
            <div className="flex justify-center">
              <div className="w-80 rounded-2xl overflow-hidden shadow-xl border" style={{ borderColor: 'var(--color-border)' }}>
                {/* Header */}
                <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: '#075e54' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-medium text-sm" style={{ backgroundColor: 'var(--color-primary)' }}>FS</div>
                  <div>
                    <div className="text-sm font-medium text-white">FitSync</div>
                    <div className="text-xs text-green-200">online</div>
                  </div>
                </div>
                {/* Messages */}
                <div className="p-4 space-y-3 min-h-72" style={{ backgroundColor: '#e5ddd5' }}>
                  {[
                    { from: 'user', text: 'Oi! Acabei de malhar. Fiz supino 4x8 80kg, crucifixo 3x12 14kg e tríceps corda 4x15 25kg' },
                    { from: 'bot', text: '✅ Treino registrado!\n\n💪 Supino Reto — 4 séries × 8 reps × 80kg\n🔥 *NOVO RECORDE PESSOAL!*\n\n📊 Crucifixo — 3×12 × 14kg\n📊 Tríceps Corda — 4×15 × 25kg\n\nVolume total: 3.088 kg\nExcelente treino!' },
                    { from: 'user', text: 'Almocei arroz integral 150g, frango grelhado 200g e salada' },
                    { from: 'bot', text: '🍽️ Almoço registrado!\n\nCalories: 620 kcal\n🥩 Proteína: 58g\n🍚 Carbs: 72g\n🫒 Gordura: 8g\n\nVocê já consumiu 1.240 kcal hoje. Faltam 600 kcal para sua meta!' },
                  ].map((msg, i) => (
                    <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className="max-w-xs rounded-xl px-3 py-2 text-xs shadow-sm whitespace-pre-line"
                        style={{
                          backgroundColor: msg.from === 'user' ? '#dcf8c6' : 'white',
                          color: '#111',
                          borderRadius: msg.from === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                        }}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="planos" className="py-20" style={{ backgroundColor: 'var(--color-surface)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-medium tracking-tight mb-3">Planos simples e transparentes</h2>
            <p className="text-base" style={{ color: 'var(--color-text-muted)' }}>
              {monthly.trialDays} dias grátis em qualquer plano · cancele quando quiser
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Mensal */}
            <div className="rounded-xl p-6 border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-card)' }}>
              <div className="mb-4">
                <h3 className="text-base font-medium mb-1">Mensal</h3>
                <div className="text-3xl font-medium">{brl(monthly.value)}<span className="text-base font-normal">/mês</span></div>
                <div className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>{monthly.trialDays} dias grátis</div>
              </div>
              <ul className="space-y-2 mb-6">
                {['Treinos e dieta gerados por IA', 'Coach IA no WhatsApp 24/7', 'Foto de refeições (IA)', 'Gráficos de progresso e recordes', 'Análise semanal personalizada'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/login?tab=signup" className="block text-center text-sm py-2.5 px-4 rounded-lg border transition-colors hover:bg-gray-50 dark:hover:bg-gray-900" style={{ borderColor: 'var(--color-border)' }}>
                Começar {monthly.trialDays} dias grátis
              </Link>
            </div>

            {/* Anual */}
            <div className="rounded-xl p-6 border-2 relative" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-primary)', borderRadius: 'var(--radius-card)' }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                Economize {savingsPct}%
              </div>
              <div className="mb-4">
                <h3 className="text-base font-medium mb-1">Anual</h3>
                <div className="text-3xl font-medium">{brl(annual.value)}<span className="text-base font-normal">/ano</span></div>
                <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  ≈ {brl(annualPerMonth)}/mês · <span className="font-medium" style={{ color: 'var(--color-primary)' }}>{annual.trialDays} dias grátis</span>
                </div>
              </div>
              <ul className="space-y-2 mb-6">
                {['Tudo do plano mensal', `${savingsPct}% mais barato que o mensal`, 'Preço travado por 12 meses', 'PIX, boleto ou cartão'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/login?tab=signup" className="block text-center text-sm py-2.5 px-4 rounded-lg text-white font-medium transition-opacity hover:opacity-90" style={{ backgroundColor: 'var(--color-primary)' }}>
                Começar {annual.trialDays} dias grátis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-medium tracking-tight mb-4">
            Pronto para transformar seu treino?
          </h2>
          <p className="text-base mb-8" style={{ color: 'var(--color-text-muted)' }}>
            Treino, dieta e coach por IA no seu WhatsApp. Teste {monthly.trialDays} dias sem pagar nada.
          </p>
          <Link href="/login?tab=signup" className="inline-flex items-center text-sm px-8 py-3.5 rounded-lg text-white font-medium transition-opacity hover:opacity-90" style={{ backgroundColor: 'var(--color-primary)' }}>
            Começar {monthly.trialDays} dias grátis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-base font-medium">
            <span className="text-black dark:text-white">Fit</span>
            <span style={{ color: 'var(--color-primary)' }}>Sync</span>
          </span>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            © {new Date().getFullYear()} FitSync. Todos os direitos reservados.
          </p>
          <div className="flex gap-4">
            {['Privacidade', 'Termos', 'Contato'].map(link => (
              <a key={link} href="#" className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{link}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
