import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`h-full ${inter.variable}`}>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  )
}
