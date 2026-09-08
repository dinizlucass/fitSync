import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { MetaPixel } from '@/components/analytics/MetaPixel'
import { Clarity } from '@/components/analytics/Clarity'
import { PostHog } from '@/components/analytics/PostHog'
import { appPublicUrl } from '@/lib/asaas/config'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(appPublicUrl()),
  title: 'FitSync — treino, dieta e coach de IA no WhatsApp',
  description: 'Registre refeições por mensagem ou foto, organize seus treinos e acompanhe sua evolução. Coach de IA no WhatsApp e no app.',
  openGraph: {
    title: 'FitSync — treino e dieta no seu WhatsApp',
    description: 'Conheça seu coach de IA e descubra sua prévia personalizada no quiz gratuito.',
    siteName: 'FitSync',
    locale: 'pt_BR',
    type: 'website',
  },
}

// viewportFit: 'cover' habilita os env(safe-area-inset-*) no iOS (notch/home indicator)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`h-full ${inter.variable}`}>
      <body className="min-h-full flex flex-col antialiased">
        <MetaPixel />
        <Clarity />
        <PostHog />
        {children}
      </body>
    </html>
  )
}
