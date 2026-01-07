/**
 * Meta Ads Top Ads API
 *
 * GET /api/meta-ads/top-ads
 * Returns top performing ads with creative data
 *
 * Query params:
 * - clientId (required): Client UUID
 * - adAccountId (optional): Override ad account ID
 * - rangeDays (optional): Number of days to look back (default: 14)
 * - metric (optional): Sort metric - 'roas' | 'cpa' | 'spend' | 'conversions' (default: 'roas')
 * - limit (optional): Number of results (default: 10, max: 50)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TopAdItem, TopAdsResponse } from '@/types/meta-ads'

type SortMetric = 'roas' | 'cpa' | 'spend' | 'conversions'

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
    const adAccountId = searchParams.get('adAccountId')
    const rangeDays = Math.min(Math.max(parseInt(searchParams.get('rangeDays') || '14'), 1), 90)
    const metric = (searchParams.get('metric') || 'roas') as SortMetric
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10'), 1), 50)

    // Validate required params
    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      )
    }

    // Verify user has access to client
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'viewer',
    })

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get client settings to find ad account ID
    const { data: client } = await supabase
      .from('clients')
      .select('settings')
      .eq('id', clientId)
      .single()

    const metaSettings = client?.settings?.meta
    const accountId = adAccountId || metaSettings?.adAccountId

    if (!accountId) {
      return NextResponse.json(
        { error: 'Meta Ads not configured for this client' },
        { status: 400 }
      )
    }

    const formattedAccountId = `act_${accountId.replace(/^act_/, '')}`

    // Calculate date range
    const dateEnd = new Date().toISOString().split('T')[0]
    const dateStart = getDateDaysAgo(rangeDays)

    // Step 1: Get aggregated ad performance data
    const { data: insightsData, error: insightsError } = await supabase
      .from('meta_insights_daily')
      .select('entity_id, entity_name, spend, impressions, clicks, conversions, conversion_value, ctr, cpc, roas')
      .eq('client_id', clientId)
      .eq('ad_account_id', formattedAccountId)
      .eq('entity_type', 'ad')
      .gte('date', dateStart)
      .lte('date', dateEnd)

    if (insightsError) {
      console.error('Failed to fetch insights:', insightsError)
      return NextResponse.json(
        { error: 'Failed to fetch performance data' },
        { status: 500 }
      )
    }

    if (!insightsData || insightsData.length === 0) {
      return NextResponse.json({
        rangeDays,
        metric,
        items: [],
      } as TopAdsResponse)
    }

    // Step 2: Aggregate by ad_id (sum metrics across days)
    const adAggregates = new Map<string, {
      ad_id: string
      ad_name: string
      spend: number
      impressions: number
      clicks: number
      conversions: number
      conversion_value: number
    }>()

    for (const row of insightsData) {
      const existing = adAggregates.get(row.entity_id)
      if (existing) {
        existing.spend += row.spend || 0
        existing.impressions += row.impressions || 0
        existing.clicks += row.clicks || 0
        existing.conversions += row.conversions || 0
        existing.conversion_value += row.conversion_value || 0
      } else {
        adAggregates.set(row.entity_id, {
          ad_id: row.entity_id,
          ad_name: row.entity_name,
          spend: row.spend || 0,
          impressions: row.impressions || 0,
          clicks: row.clicks || 0,
          conversions: row.conversions || 0,
          conversion_value: row.conversion_value || 0,
        })
      }
    }

    // Step 3: Calculate derived metrics and filter
    const adsWithMetrics = Array.from(adAggregates.values())
      .filter(ad => ad.spend > 0) // Only ads with spend
      .map(ad => {
        const roas = ad.spend > 0 ? ad.conversion_value / ad.spend : 0
        const cpa = ad.conversions > 0 ? ad.spend / ad.conversions : Infinity
        const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0
        const cpc = ad.clicks > 0 ? ad.spend / ad.clicks : 0

        return {
          ...ad,
          roas,
          cpa: ad.conversions > 0 ? cpa : 0, // Set to 0 for display if no conversions
          ctr,
          cpc,
          _sortCpa: cpa, // Keep Infinity for sorting
        }
      })

    // Step 4: Sort by selected metric
    const sortedAds = adsWithMetrics.sort((a, b) => {
      switch (metric) {
        case 'roas':
          return b.roas - a.roas // Higher is better
        case 'cpa':
          // Lower is better, but filter out ads with no conversions for CPA sort
          if (a.conversions === 0 && b.conversions === 0) return 0
          if (a.conversions === 0) return 1
          if (b.conversions === 0) return -1
          return a._sortCpa - b._sortCpa
        case 'spend':
          return b.spend - a.spend // Higher spend first
        case 'conversions':
          return b.conversions - a.conversions // More conversions first
        default:
          return b.roas - a.roas
      }
    })

    // Step 5: Take top N ads
    const topAdIds = sortedAds.slice(0, limit).map(ad => ad.ad_id)

    // Step 6: Get creatives for these ads
    const { data: creativesData } = await supabase
      .from('meta_ad_creatives')
      .select('ad_id, title, body, cta_type, image_url, thumbnail_url, video_id, link_url')
      .eq('client_id', clientId)
      .eq('ad_account_id', formattedAccountId)
      .in('ad_id', topAdIds)

    // Create a map of creatives by ad_id
    const creativesMap = new Map<string, {
      title?: string
      body?: string
      cta_type?: string
      image_url?: string
      thumbnail_url?: string
      video_id?: string
      link_url?: string
    }>()

    if (creativesData) {
      for (const creative of creativesData) {
        creativesMap.set(creative.ad_id, {
          title: creative.title || undefined,
          body: creative.body || undefined,
          cta_type: creative.cta_type || undefined,
          image_url: creative.image_url || undefined,
          thumbnail_url: creative.thumbnail_url || undefined,
          video_id: creative.video_id || undefined,
          link_url: creative.link_url || undefined,
        })
      }
    }

    // Step 7: Build response
    const items: TopAdItem[] = sortedAds.slice(0, limit).map(ad => ({
      ad_id: ad.ad_id,
      ad_name: ad.ad_name,
      spend: Math.round(ad.spend * 100) / 100,
      impressions: ad.impressions,
      clicks: ad.clicks,
      conversions: ad.conversions,
      conversion_value: Math.round(ad.conversion_value * 100) / 100,
      roas: Math.round(ad.roas * 100) / 100,
      cpa: Math.round(ad.cpa * 100) / 100,
      ctr: Math.round(ad.ctr * 100) / 100,
      cpc: Math.round(ad.cpc * 100) / 100,
      creative: creativesMap.get(ad.ad_id),
    }))

    const response: TopAdsResponse = {
      rangeDays,
      metric,
      items,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Top ads error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ============================================
// Helper Functions
// ============================================

function getDateDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}
