/**
 * Shopify OAuth Install Flow
 *
 * GET: Initiates OAuth flow by redirecting to Shopify authorization page
 *
 * Query params:
 * - shop: The Shopify store domain (e.g., "my-store.myshopify.com")
 * - clientId: The YourFellow client ID to associate with this store
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID
const SHOPIFY_SCOPES = 'read_orders,read_customers'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const shop = searchParams.get('shop')
    const clientId = searchParams.get('clientId')

    if (!shop) {
      return NextResponse.json(
        { error: 'Shop parameter is verplicht (bijv. mijn-webshop.myshopify.com)' },
        { status: 400 }
      )
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is verplicht' },
        { status: 400 }
      )
    }

    if (!SHOPIFY_CLIENT_ID) {
      console.error('SHOPIFY_CLIENT_ID environment variable not set')
      return NextResponse.json(
        { error: 'Shopify app niet geconfigureerd' },
        { status: 500 }
      )
    }

    // Verify user is authenticated and has access to this client
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Niet geautoriseerd' },
        { status: 401 }
      )
    }

    // Verify user has access to this client
    const { data: membership } = await supabase
      .from('client_memberships')
      .select('role')
      .eq('client_id', clientId)
      .eq('user_id', user.id)
      .single()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isOrgAdmin = profile?.role === 'admin'
    const hasAccess = membership?.role && ['owner', 'admin', 'editor'].includes(membership.role)

    if (!isOrgAdmin && !hasAccess) {
      return NextResponse.json(
        { error: 'Geen toegang tot deze klant' },
        { status: 403 }
      )
    }

    // Normalize shop domain
    let shopDomain = shop.trim().toLowerCase()
    if (!shopDomain.includes('.myshopify.com')) {
      shopDomain = `${shopDomain}.myshopify.com`
    }
    // Remove protocol if present
    shopDomain = shopDomain.replace(/^https?:\/\//, '')

    // Generate a secure state parameter to prevent CSRF
    // State contains: nonce|clientId|userId
    const nonce = randomBytes(16).toString('hex')
    const state = Buffer.from(JSON.stringify({
      nonce,
      clientId,
      userId: user.id,
      timestamp: Date.now(),
    })).toString('base64url')

    // Store state in database for verification
    const { error: stateError } = await supabase
      .from('shopify_oauth_states')
      .insert({
        state: nonce,
        client_id: clientId,
        user_id: user.id,
        shop: shopDomain,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      })

    if (stateError) {
      console.error('Failed to store OAuth state:', stateError)
      // Continue anyway - we'll validate state from the encoded value
    }

    // Build the Shopify OAuth URL
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/shopify/oauth/callback`

    const authUrl = new URL(`https://${shopDomain}/admin/oauth/authorize`)
    authUrl.searchParams.set('client_id', SHOPIFY_CLIENT_ID)
    authUrl.searchParams.set('scope', SHOPIFY_SCOPES)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)

    // Redirect to Shopify authorization page
    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    console.error('Shopify OAuth install error:', error)
    return NextResponse.json(
      { error: 'Er is een fout opgetreden' },
      { status: 500 }
    )
  }
}
