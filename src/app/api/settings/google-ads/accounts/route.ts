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

    const logger = createLogger('debug')
    const mccId = loginCustomerId.trim().replace(/-/g, '')

    console.log('[Google Ads Accounts] Starting query for MCC:', mccId)

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
    // Note: customer_client lists accounts accessible from this manager account
    const response = await client.query(`
      SELECT
        customer_client.id,
        customer_client.descriptive_name,
        customer_client.manager,
        customer_client.status,
        customer_client.currency_code,
        customer_client.time_zone,
        customer_client.level
      FROM customer_client
      WHERE customer_client.status = 'ENABLED'
        AND customer_client.level <= 1
    `)

    console.log('[Google Ads Accounts] Query response:', {
      resultsCount: response.results.length,
      resultsPreview: JSON.stringify(response.results.slice(0, 3)),
    })

    interface CustomerClientRow {
      customerClient: {
        id: string
        descriptiveName: string
        manager: boolean
        status: string
        currencyCode: string
        timeZone: string
        level: number
      }
    }

    let accounts = (response.results as unknown as CustomerClientRow[])
      .filter((row) => row.customerClient?.id) // Filter out empty results
      .map((row) => ({
        id: row.customerClient.id,
        name: row.customerClient.descriptiveName || 'Naamloos account',
        isManager: row.customerClient.manager || false,
        status: row.customerClient.status,
        currency: row.customerClient.currencyCode,
        timezone: row.customerClient.timeZone,
        level: row.customerClient.level,
      }))
      // Exclude the MCC itself from the list
      .filter((acc) => acc.id !== mccId)

    // If no accounts found via customer_client, the MCC might be empty or permissions issue
    if (accounts.length === 0) {
      console.log('[Google Ads Accounts] No sub-accounts found. MCC may be empty or service account lacks permissions.')
    }

    return NextResponse.json({
      success: true,
      mccId,
      accounts,
      count: accounts.length,
      debug: {
        rawResultsCount: response.results.length,
        note: accounts.length === 0 ? 'Geen sub-accounts gevonden. Controleer of dit MCC sub-accounts heeft en of het service account toegang heeft.' : undefined,
      },
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
