import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Callback OAuth (Google etc.) e links de e-mail do Supabase.
 * Troca o ?code= por sessão NO SERVIDOR (grava os cookies) e redireciona.
 * Sem esta rota, o proxy bloqueia /app/* antes do code virar sessão.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // destino pós-login — só caminhos internos, evita open redirect
  const nextParam = searchParams.get('next') ?? '/app/hoje'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/app/hoje'

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return response
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`)
}
