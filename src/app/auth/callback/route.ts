import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('redirect') ?? '/dashboard'
  const origin = requestUrl.origin

  console.log('=== AUTH CALLBACK ===')
  console.log('Full URL:', request.url)
  console.log('Code:', code)
  console.log('Redirect:', next)

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    console.log('Exchange result - Data:', data)
    console.log('Exchange result - Error:', error)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  } else {
    console.log('No code found in URL')
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}