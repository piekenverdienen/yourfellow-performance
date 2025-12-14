import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID
const GOOGLE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google_ads/callback`

// Google OAuth scopes for Ads API
const SCOPES = [
  'https://www.googleapis.com/auth/adwords',
  'openid',
  'email',
  'profile',
].join(' ')

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!GOOGLE_CLIENT_ID) {
      return NextResponse.json(
        { error: 'Google Ads is nog niet geconfigureerd. Voeg GOOGLE_ADS_CLIENT_ID toe aan je environment variables.' },
        { status: 500 }
      )
    }

    // Create state token to prevent CSRF
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
      nonce: crypto.randomUUID(),
    })).toString('base64')

    // Build OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', SCOPES)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
    authUrl.searchParams.set('state', state)

    return NextResponse.json({ authUrl: authUrl.toString() })
  } catch (error) {
    console.error('Error starting OAuth flow:', error)
    return NextResponse.json(
      { error: 'Failed to start OAuth flow' },
      { status: 500 }
    )
  }
}
