import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { MetaPixel } from '@/components/analytics/MetaPixel'
import { Clarity } from '@/components/analytics/Clarity'
import { PostHog } from '@/components/analytics/PostHog'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'FitSync',
  description: 'Seu consultor de treino e dieta, direto no bolso.',
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
