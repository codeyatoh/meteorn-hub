import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (
    !user &&
    (request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/admin') ||
      request.nextUrl.pathname.startsWith('/onboarding'))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    const nickname = user.user_metadata?.nickname
    const role = user.user_metadata?.role
    const isOnboarding = request.nextUrl.pathname.startsWith('/onboarding')

    // Force onboarding if no nickname
    if (!nickname && !isOnboarding && request.nextUrl.pathname !== '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    // Redirect away from onboarding if already has a nickname
    if (nickname && isOnboarding) {
      const url = request.nextUrl.clone()
      url.pathname = role === 'admin' ? '/admin' : '/dashboard'
      return NextResponse.redirect(url)
    }

    // Admin route protection
    if (request.nextUrl.pathname.startsWith('/admin') && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Redirect authenticated users away from /login
    if (request.nextUrl.pathname === '/login') {
      const url = request.nextUrl.clone()
      // If they don't have a nickname, redirect to onboarding instead of dashboard
      url.pathname = !nickname ? '/onboarding' : (role === 'admin' ? '/admin' : '/dashboard')
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
