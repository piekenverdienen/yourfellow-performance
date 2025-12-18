/**
 * Meta Ads AI Insights API
 *
 * GET /api/meta-ads/insights - Get insights
 * POST /api/meta-ads/insights - Generate new insights
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMetaAIInsightsService } from '@/services/meta-ai-insights'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const limit = parseInt(searchParams.get('limit') || '5')

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    // Verify access
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'viewer',
    })

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get insights
    const insightsService = getMetaAIInsightsService()
    const insights = await insightsService.getLatestInsights(clientId, limit)

    return NextResponse.json({ insights })
  } catch (error) {
    console.error('Insights GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

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
    const { clientId, adAccountId, insightType, periodStart, periodEnd } = body

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    // Verify access
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'editor',
    })

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get ad account ID from settings if not provided
    let accountId = adAccountId
    if (!accountId) {
      const { data: client } = await supabase
        .from('clients')
        .select('settings')
        .eq('id', clientId)
        .single()

      accountId = client?.settings?.meta?.adAccountId
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'Meta Ads not configured for this client' },
        { status: 400 }
      )
    }

    // Calculate default date range if not provided
    const end = periodEnd || new Date().toISOString().split('T')[0]
    let start = periodStart
    if (!start) {
      const days = insightType === 'weekly' ? 7 : insightType === 'monthly' ? 30 : 1
      start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
    }

    // Generate insights
    const insightsService = getMetaAIInsightsService()
    const insight = await insightsService.generateInsights({
      clientId,
      adAccountId: `act_${accountId.replace(/^act_/, '')}`,
      insightType: insightType || 'daily',
      periodStart: start,
      periodEnd: end,
    })

    if (!insight) {
      return NextResponse.json(
        { error: 'Failed to generate insights' },
        { status: 500 }
      )
    }

    return NextResponse.json({ insight })
  } catch (error) {
    console.error('Insights POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
