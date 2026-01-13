/**
 * Shopify Disconnect API
 *
 * POST: Disconnect Shopify from a client
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const { clientId } = body

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is verplicht' },
        { status: 400 }
      )
    }

    // Verify user has access to this client
    const { data: membership } = await supabase
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

    // Remove Shopify settings
    const currentSettings = client.settings || {}
    delete currentSettings.shopify

    const { error: updateError } = await supabase
      .from('clients')
      .update({
        settings: currentSettings,
      })
      .eq('id', clientId)

    if (updateError) {
      console.error('Failed to remove Shopify settings:', updateError)
      return NextResponse.json(
        { error: 'Kon instellingen niet verwijderen' },
        { status: 500 }
      )
    }

    // Optionally: Delete historical data
    // For now, we keep the data for reference
    // await supabase.from('shopify_orders_daily').delete().eq('client_id', clientId)

    return NextResponse.json({
      success: true,
      message: 'Shopify verbinding verwijderd',
    })
  } catch (error) {
    console.error('Shopify disconnect error:', error)
    return NextResponse.json(
      { error: 'Er is een fout opgetreden' },
      { status: 500 }
    )
  }
}
