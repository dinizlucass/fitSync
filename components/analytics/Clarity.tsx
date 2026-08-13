'use client'

import Script from 'next/script'

// ID público do projeto Clarity (fica visível no client). Sobrescrevível por
// NEXT_PUBLIC_CLARITY_ID sem tocar no código.
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID ?? 'y1z0l58tb5'

/**
 * Microsoft Clarity — heatmaps + gravação de sessão. Carrega após a hidratação.
 * O Clarity rastreia navegações SPA sozinho, então não precisa de hook de rota.
 */
export function Clarity() {
  if (!CLARITY_ID) return null

  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${CLARITY_ID}");`}
    </Script>
  )
}
