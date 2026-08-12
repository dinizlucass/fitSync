import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { enforceRateLimit } from '@/lib/ratelimit'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Resgate de OAuth: se o ?code= cair na raiz (fallback do Supabase quando a
  // redirect URL não está na allowlist), encaminha pro handler que troca o
  // code por sessão — o login funciona mesmo com a allowlist mal configurada.
  if (pathname === '/' && request.nextUrl.searchParams.has('code')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/callback'
    url.searchParams.set('next', '/app/hoje')
    return NextResponse.redirect(url)
  }

  // Escudo global por IP em rotas sensíveis: login e /api (menos webhooks, que
  // são Meta/Asaas e têm HMAC/token + idempotência). Fail-open se o Redis cair.
  if (pathname === '/login' || (pathname.startsWith('/api/') && !pathname.startsWith('/api/webhook'))) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const rl = await enforceRateLimit('ip:sensitive', ip)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: rl.message },
        { status: 429, headers: rl.retryAfterSec ? { 'Retry-After': String(rl.retryAfterSec) } : undefined },
      )
    }
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/app/hoje'
    return NextResponse.redirect(url)
  }

  if (!user && pathname.startsWith('/app')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
