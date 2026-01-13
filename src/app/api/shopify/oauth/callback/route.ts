/**
 * Shopify OAuth Callback
 *
 * GET: Handles the OAuth callback from Shopify, exchanges code for access token
 *
 * Query params from Shopify:
 * - code: The authorization code to exchange for an access token
 * - shop: The shop domain
 * - state: The state parameter for CSRF protection
 * - hmac: HMAC signature from Shopify
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHmac } from 'crypto'
import type { ShopifySettings } from '@/types'

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET

interface ShopifyTokenResponse {
  access_token: string
  scope: string
}

interface ShopifyShopResponse {
  shop: {
    name: string
    domain: string
    email: string
    currency: string
    timezone: string
  }
}

/**
 * Verify Shopify HMAC signature
 */
function verifyHmac(query: URLSearchParams): boolean {
  if (!SHOPIFY_CLIENT_SECRET) return false

  const hmac = query.get('hmac')
  if (!hmac) return false

  // Build the message from all params except hmac
  const params = new URLSearchParams()
  query.forEach((value, key) => {
    if (key !== 'hmac') {
      params.set(key, value)
    }
  })

  // Sort parameters alphabetically
  const sortedParams = new URLSearchParams([...params.entries()].sort())
  const message = sortedParams.toString()

  // Calculate HMAC
  const calculatedHmac = createHmac('sha256', SHOPIFY_CLIENT_SECRET)
    .update(message)
    .digest('hex')

  return calculatedHmac === hmac
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const shop = searchParams.get('shop')
    const state = searchParams.get('state')

    // Validate required parameters
    if (!code || !shop || !state) {
      return redirectWithError('Ongeldige OAuth callback - ontbrekende parameters')
    }

    // Verify HMAC signature from Shopify
    if (!verifyHmac(searchParams)) {
      console.error('HMAC verification failed')
      return redirectWithError('Ongeldige OAuth callback - HMAC verificatie mislukt')
    }

    // Decode and validate state
    let stateData: {
      nonce: string
      clientId: string
      userId: string
      timestamp: number
    }

    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    } catch {
      return redirectWithError('Ongeldige OAuth state')
    }

    // Check if state is not expired (10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      return redirectWithError('OAuth sessie verlopen - probeer opnieuw')
    }

    if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
      console.error('Shopify credentials not configured')
      return redirectWithError('Shopify app niet geconfigureerd')
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return redirectWithError('Kon access token niet verkrijgen')
    }

    const tokenData: ShopifyTokenResponse = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Fetch shop details to get store name
    const shopResponse = await fetch(`https://${shop}/admin/api/2026-01/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    let storeName = shop.replace('.myshopify.com', '')
    let currency = 'EUR'
    let timezone = 'Europe/Amsterdam'

    if (shopResponse.ok) {
      const shopData: ShopifyShopResponse = await shopResponse.json()
      storeName = shopData.shop.name
      currency = shopData.shop.currency || 'EUR'
      timezone = shopData.shop.timezone || 'Europe/Amsterdam'
    }

    // Extract store ID from shop domain
    const storeId = shop.replace('.myshopify.com', '')

    // Save the connection to the database
    const supabase = await createClient()

    // Get current client settings
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('settings')
      .eq('id', stateData.clientId)
      .single()

    if (clientError || !client) {
      console.error('Client not found:', clientError)
      return redirectWithError('Klant niet gevonden')
    }

    // Update settings with Shopify config
    const currentSettings = client.settings || {}
    const shopifySettings: ShopifySettings = {
      enabled: true,
      storeId,
      accessToken,
      currency,
      timezone,
      syncEnabled: true,
      lastSyncAt: undefined,
      thresholds: {
        revenueDropWarning: 20,
        revenueDropCritical: 40,
        ordersDropWarning: 25,
        ordersDropCritical: 50,
        highRefundRate: 10,
      },
    }

    const { error: updateError } = await supabase
      .from('clients')
      .update({
        settings: {
          ...currentSettings,
          shopify: shopifySettings,
        },
      })
      .eq('id', stateData.clientId)

    if (updateError) {
      console.error('Failed to save Shopify settings:', updateError)
      return redirectWithError('Kon instellingen niet opslaan')
    }

    // Clean up the OAuth state
    await supabase
      .from('shopify_oauth_states')
      .delete()
      .eq('state', stateData.nonce)

    // Redirect to success page
    const successUrl = new URL('/clients/' + stateData.clientId + '/settings', request.nextUrl.origin)
    successUrl.searchParams.set('shopify', 'connected')
    successUrl.searchParams.set('store', storeName)

    return NextResponse.redirect(successUrl.toString())
  } catch (error) {
    console.error('Shopify OAuth callback error:', error)
    return redirectWithError('Er is een fout opgetreden')
  }
}

function redirectWithError(error: string): NextResponse {
  // Redirect to a general error page or settings page with error
  const errorUrl = new URL('/settings', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
  errorUrl.searchParams.set('shopify_error', error)
  return NextResponse.redirect(errorUrl.toString())
}
