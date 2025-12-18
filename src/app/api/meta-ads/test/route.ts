/**
 * Meta Ads Test Connection API
 *
 * POST /api/meta-ads/test
 * Tests the connection to Meta Ads API with provided credentials
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MetaAdsClient } from '@/lib/meta/client'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const body = await request.json()
    const { accessToken, adAccountId } = body

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Access token is required' },
        { status: 400 }
      )
    }

    // Create client and test connection
    const metaClient = new MetaAdsClient({
      accessToken,
      adAccountId: adAccountId ? MetaAdsClient.formatAdAccountId(adAccountId) : undefined,
    })

    const result = await metaClient.testConnection()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Meta Ads test error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
