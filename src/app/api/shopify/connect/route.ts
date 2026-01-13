/**
 * Shopify Connect API
 *
 * POST: Connect/validate Shopify credentials for a client
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getShopifySyncService } from '@/services/shopify-sync'
import type { ShopifySettings } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Niet geautoriseerd' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { clientId, storeId, accessToken, currency, timezone } = body

    if (!clientId || !storeId || !accessToken) {
      return NextResponse.json(
        { error: 'Client ID, Store ID en Access Token zijn verplicht' },
        { status: 400 }
      )
    }

    // Verify user has access to this client
    const { data: membership, error: membershipError } = await supabase
      .from('client_memberships')
      .select('role')
      .eq('client_id', clientId)
      .eq('user_id', user.id)
      .single()

    // Also check if user is org admin
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

    // Test the connection
    const syncService = getShopifySyncService()
    const testResult = await syncService.testConnection(storeId, accessToken)

    if (!testResult.success) {
      return NextResponse.json(
        {
          error: 'Kan geen verbinding maken met Shopify',
          details: testResult.error
        },
        { status: 400 }
      )
    }

    // Get current client settings
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('settings')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Klant niet gevonden' },
        { status: 404 }
      )
    }

    // Update settings with Shopify config
    const currentSettings = client.settings || {}
    const shopifySettings: ShopifySettings = {
      enabled: true,
      storeId,
      accessToken,
      currency: currency || 'EUR',
      timezone: timezone || 'Europe/Amsterdam',
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
      .eq('id', clientId)

    if (updateError) {
      console.error('Failed to save Shopify settings:', updateError)
      return NextResponse.json(
        { error: 'Kon instellingen niet opslaan' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Shopify verbinding succesvol',
      storeName: testResult.storeName,
    })
  } catch (error) {
    console.error('Shopify connect error:', error)
    return NextResponse.json(
      { error: 'Er is een fout opgetreden' },
      { status: 500 }
    )
  }
}
