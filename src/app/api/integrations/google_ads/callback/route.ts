import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google_ads/callback`
const GOOGLE_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

interface GoogleUserInfo {
  email: string
  name: string
}

interface GoogleAdsCustomer {
  resourceName: string
  id: string
  descriptiveName: string
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Redirect to settings page with error or success
  const redirectUrl = new URL('/settings/integrations', process.env.NEXT_PUBLIC_APP_URL)

  if (error) {
    redirectUrl.searchParams.set('error', error)
    return NextResponse.redirect(redirectUrl)
  }

  if (!code || !state) {
    redirectUrl.searchParams.set('error', 'missing_params')
    return NextResponse.redirect(redirectUrl)
  }

  try {
    // Decode and validate state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    const { userId, timestamp } = stateData

    // Check if state is not too old (15 minutes)
    if (Date.now() - timestamp > 15 * 60 * 1000) {
      redirectUrl.searchParams.set('error', 'state_expired')
      return NextResponse.redirect(redirectUrl)
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token exchange failed:', errorData)
      redirectUrl.searchParams.set('error', 'token_exchange_failed')
      return NextResponse.redirect(redirectUrl)
    }

    const tokens: TokenResponse = await tokenResponse.json()

    // Get user info for display
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    let userEmail = 'Google Ads Account'
    if (userInfoResponse.ok) {
      const userInfo: GoogleUserInfo = await userInfoResponse.json()
      userEmail = userInfo.email || userInfo.name || userEmail
    }

    // Get Google Ads customer accounts
    let customerId: string | null = null
    let customerName: string | null = null

    if (GOOGLE_DEVELOPER_TOKEN) {
      try {
        const customersResponse = await fetch(
          'https://googleads.googleapis.com/v15/customers:listAccessibleCustomers',
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              'developer-token': GOOGLE_DEVELOPER_TOKEN,
            },
          }
        )

        if (customersResponse.ok) {
          const customersData = await customersResponse.json()
          const resourceNames: string[] = customersData.resourceNames || []

          if (resourceNames.length > 0) {
            // Get the first customer's details
            customerId = resourceNames[0].replace('customers/', '')

            // Fetch customer details
            const customerResponse = await fetch(
              `https://googleads.googleapis.com/v15/customers/${customerId}`,
              {
                headers: {
                  Authorization: `Bearer ${tokens.access_token}`,
                  'developer-token': GOOGLE_DEVELOPER_TOKEN,
                  'login-customer-id': customerId,
                },
              }
            )

            if (customerResponse.ok) {
              const customerData: GoogleAdsCustomer = await customerResponse.json()
              customerName = customerData.descriptiveName || `Account ${customerId}`
            }
          }
        }
      } catch (adsError) {
        console.error('Error fetching Google Ads accounts:', adsError)
        // Continue without customer info - user can still connect
      }
    }

    // Store integration in database
    const supabase = await createClient()

    const { error: dbError } = await supabase.from('integrations').upsert(
      {
        user_id: userId,
        provider: 'google_ads',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        account_id: customerId,
        account_name: customerName || userEmail,
        scopes: tokens.scope.split(' '),
        is_active: true,
        connection_status: 'connected',
        last_error: null,
        metadata: {
          email: userEmail,
          connected_at: new Date().toISOString(),
        },
      },
      {
        onConflict: 'user_id,provider,account_id',
      }
    )

    if (dbError) {
      console.error('Database error:', dbError)
      redirectUrl.searchParams.set('error', 'database_error')
      return NextResponse.redirect(redirectUrl)
    }

    // Log the connection
    await supabase.from('integration_logs').insert({
      user_id: userId,
      action: 'connect',
      provider: 'google_ads',
      details: {
        account_id: customerId,
        account_name: customerName,
      },
    })

    redirectUrl.searchParams.set('success', 'google_ads')
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('OAuth callback error:', error)
    redirectUrl.searchParams.set('error', 'unknown_error')
    return NextResponse.redirect(redirectUrl)
  }
}
