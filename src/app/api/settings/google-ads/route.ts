import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Get service role client for database operations (bypasses RLS)
function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service role credentials')
  }

  return createServiceClient(supabaseUrl, serviceRoleKey)
}

// GET - Load Google Ads settings
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Use service role client to bypass RLS
    const serviceClient = getServiceSupabase()

    // Get settings from app_settings table
    const { data: settings } = await serviceClient
      .from('app_settings')
      .select('value')
      .eq('key', 'google_ads_credentials')
      .single()

    if (!settings?.value) {
      return NextResponse.json({})
    }

    // Return settings without the private key for security
    const { privateKey, ...safeSettings } = settings.value as Record<string, unknown>

    return NextResponse.json({
      ...safeSettings,
      hasPrivateKey: !!privateKey,
    })
  } catch (error) {
    console.error('Failed to load Google Ads settings:', error)
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    )
  }
}

// POST - Save Google Ads settings
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const {
      developerToken,
      serviceAccountEmail,
      privateKey,
      customerId,
      loginCustomerId,
    } = body

    // Validate required fields - for MCC setup, loginCustomerId is required, customerId is optional
    if (!developerToken || !serviceAccountEmail || !privateKey || !loginCustomerId) {
      return NextResponse.json(
        { error: 'Vul alle verplichte velden in (Developer Token, Service Account, Private Key, MCC Account ID)' },
        { status: 400 }
      )
    }

    // Use service role client to bypass RLS
    const serviceClient = getServiceSupabase()

    // Store in app_settings table
    const { error } = await serviceClient
      .from('app_settings')
      .upsert({
        key: 'google_ads_credentials',
        value: {
          type: 'service_account',
          developerToken,
          serviceAccountEmail,
          privateKey,
          customerId: customerId || null, // Optional for MCC setup
          loginCustomerId, // Required - the MCC account ID
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      })

    if (error) {
      console.error('Failed to save settings:', error)
      return NextResponse.json(
        { error: `Database error: ${error.message || error.code || 'Unknown error'}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save Google Ads settings:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Server error: ${errorMessage}` },
      { status: 500 }
    )
  }
}
