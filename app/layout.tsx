import type { Metadata } from 'next'
import './globals.css'

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
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  )
}
