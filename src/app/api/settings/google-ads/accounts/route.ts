import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleAdsClient } from '@/monitoring/google-ads/client'
import { createLogger } from '@/monitoring/utils/logger'

// POST - List accessible Google Ads accounts
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
      loginCustomerId,
    } = body

    // Validate required fields
    if (!developerToken || !serviceAccountEmail || !privateKey || !loginCustomerId) {
      return NextResponse.json(
        { error: 'Vul alle verplichte velden in' },
        { status: 400 }
      )
    }

    const logger = createLogger('info')
    const mccId = loginCustomerId.replace(/-/g, '')

    // Create client for MCC account
    const client = new GoogleAdsClient({
      credentials: {
        type: 'service_account',
        developerToken,
        serviceAccountEmail,
        privateKey,
        loginCustomerId: mccId,
      },
      customerId: mccId,
      logger,
    })

    // Query to list all accessible customer accounts under the MCC
    const response = await client.query(`
      SELECT
        customer_client.id,
        customer_client.descriptive_name,
        customer_client.manager,
        customer_client.status,
        customer_client.currency_code,
        customer_client.time_zone
      FROM customer_client
      WHERE customer_client.status = 'ENABLED'
    `)

    const accounts = response.results.map((row: {
      customerClient: {
        id: string
        descriptiveName: string
        manager: boolean
        status: string
        currencyCode: string
        timeZone: string
      }
    }) => ({
      id: row.customerClient.id,
      name: row.customerClient.descriptiveName,
      isManager: row.customerClient.manager,
      status: row.customerClient.status,
      currency: row.customerClient.currencyCode,
      timezone: row.customerClient.timeZone,
    }))

    return NextResponse.json({
      success: true,
      mccId,
      accounts,
      count: accounts.length,
    })
  } catch (error) {
    console.error('Failed to list Google Ads accounts:', error)

    let errorMessage = (error as Error).message

    if (errorMessage.includes('401')) {
      errorMessage = 'Authenticatie mislukt. Controleer de service account credentials.'
    } else if (errorMessage.includes('403')) {
      errorMessage = 'Toegang geweigerd. Zorg dat het service account email is toegevoegd als gebruiker in Google Ads.'
    } else if (errorMessage.includes('404')) {
      errorMessage = 'MCC account niet gevonden. Controleer de MCC Account ID.'
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
    })
  }
}
