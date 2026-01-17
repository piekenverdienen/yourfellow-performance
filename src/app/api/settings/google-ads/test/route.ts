import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleAdsClient } from '@/monitoring/google-ads/client'
import { createLogger } from '@/monitoring/utils/logger'

// POST - Test Google Ads connection
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

    // Validate required fields - customerId is the account to test (can be MCC or sub-account)
    if (!developerToken || !serviceAccountEmail || !privateKey || !customerId) {
      return NextResponse.json(
        { error: 'Vul alle verplichte velden in' },
        { status: 400 }
      )
    }

    // Create client and test connection
    const logger = createLogger('info')

    // For MCC testing: use the provided customerId (which might be the MCC itself)
    const testCustomerId = customerId.replace(/-/g, '')

    const client = new GoogleAdsClient({
      credentials: {
        type: 'service_account',
        developerToken,
        serviceAccountEmail,
        privateKey,
        loginCustomerId: loginCustomerId?.replace(/-/g, '') || undefined,
      },
      customerId: testCustomerId,
      logger,
    })

    // Try to get customer info - wrap in try/catch to get detailed error
    let customerInfo
    try {
      customerInfo = await client.getCustomerInfo()
    } catch (apiError) {
      const err = apiError as Error & { details?: unknown; statusCode?: number }
      console.error('Google Ads API error:', apiError)

      // Try to parse the error details for more info
      let errorDetails = ''
      if (err.details) {
        try {
          const parsed = typeof err.details === 'string' ? JSON.parse(err.details) : err.details
          errorDetails = JSON.stringify(parsed, null, 2)
        } catch {
          errorDetails = String(err.details)
        }
      }

      return NextResponse.json({
        success: false,
        error: `API Error: ${err.message}`,
        statusCode: err.statusCode,
        details: errorDetails || String(apiError),
      })
    }

    if (!customerInfo) {
      return NextResponse.json({
        success: false,
        error: 'Kon geen account informatie ophalen. De API gaf geen data terug. Check of het service account email is toegevoegd in Google Ads met leesrechten.',
      })
    }

    return NextResponse.json({
      success: true,
      customerId: customerInfo.customerId,
      customerName: customerInfo.descriptiveName,
      currencyCode: customerInfo.currencyCode,
      timeZone: customerInfo.timeZone,
    })
  } catch (error) {
    console.error('Google Ads connection test failed:', error)

    // Parse error message for common issues
    let errorMessage = (error as Error).message

    if (errorMessage.includes('401')) {
      errorMessage = 'Authenticatie mislukt. Controleer de service account credentials.'
    } else if (errorMessage.includes('403')) {
      errorMessage = 'Toegang geweigerd. Controleer of het service account toegang heeft tot dit Google Ads account.'
    } else if (errorMessage.includes('404')) {
      errorMessage = 'Account niet gevonden. Controleer de Customer ID.'
    } else if (errorMessage.includes('developer-token')) {
      errorMessage = 'Ongeldige Developer Token. Vraag een token aan via Google Ads API Center.'
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
    })
  }
}
