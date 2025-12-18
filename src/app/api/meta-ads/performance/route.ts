/**
 * Meta Ads Performance API
 *
 * GET /api/meta-ads/performance
 * Returns performance data for Meta Ads entities with real trends and counts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMetaAdsSyncService } from '@/services/meta-ads-sync'
import type { MetaEntityType, MetaPerformanceRow, MetaDashboardKPIs, MetaInsightDaily } from '@/types/meta-ads'

type TrendDirection = 'up' | 'down' | 'stable'

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
    const entityType = (searchParams.get('entityType') || 'ad') as MetaEntityType
    const dateStart = searchParams.get('dateStart')
    const dateEnd = searchParams.get('dateEnd')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const sortBy = searchParams.get('sortBy') || 'spend'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

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

    // Calculate date range (default: last 7 days)
    const end = dateEnd || new Date().toISOString().split('T')[0]
    const start = dateStart || getDateDaysAgo(7)
    const formattedAccountId = `act_${accountId.replace(/^act_/, '')}`

    // Calculate previous period for comparison
    const daysDiff = getDaysDiff(start, end)
    const previousEnd = getDateDaysAgo(daysDiff + 1, new Date(start))
    const previousStart = getDateDaysAgo(daysDiff, new Date(previousEnd))

    // Get performance data
    const syncService = getMetaAdsSyncService()
    const { data, total } = await syncService.getPerformanceData(
      clientId,
      formattedAccountId,
      entityType,
      start,
      end,
      { page, pageSize, sortBy, sortOrder }
    )

    // Get previous period data for trend comparison
    const previousPeriodData = await getPreviousPeriodMap(
      supabase,
      clientId,
      formattedAccountId,
      entityType,
      previousStart,
      previousEnd
    )

    // Get extended KPIs with trends
    const kpis = await getExtendedKPIs(
      supabase,
      clientId,
      formattedAccountId,
      start,
      end,
      previousStart,
      previousEnd
    )

    // Get entity counts
    const entityCounts = await getEntityCounts(
      supabase,
      clientId,
      formattedAccountId,
      start,
      end
    )

    // Transform data to PerformanceRows with real trends
    const frequencyThreshold = metaSettings?.thresholds?.frequencyWarning || 2.5
    const rows: MetaPerformanceRow[] = data.map(insight => {
      const prev = previousPeriodData.get(insight.entity_id)

      return {
        entity_type: insight.entity_type,
        entity_id: insight.entity_id,
        entity_name: insight.entity_name,
        status: insight.spend > 0 ? 'ACTIVE' : 'PAUSED',
        campaign_name: insight.campaign_name,
        adset_name: insight.adset_name,
        impressions: insight.impressions,
        reach: insight.reach,
        clicks: insight.clicks,
        spend: insight.spend,
        ctr: insight.ctr,
        cpc: insight.cpc,
        cpm: insight.cpm,
        frequency: insight.frequency,
        conversions: insight.conversions,
        roas: insight.roas,
        spend_trend: calculateTrend(insight.spend, prev?.spend),
        ctr_trend: calculateTrend(insight.ctr, prev?.ctr),
        roas_trend: calculateTrend(insight.roas, prev?.roas),
        has_fatigue_warning: insight.frequency > frequencyThreshold,
        fatigue_severity: insight.frequency > 4 ? 'high' : insight.frequency > 3 ? 'medium' : 'low',
      }
    })

    // Build KPIs response with real data
    const dashboardKPIs: MetaDashboardKPIs = {
      total_spend: kpis.current.spend,
      total_impressions: kpis.current.impressions,
      total_reach: kpis.current.reach,
      total_clicks: kpis.current.clicks,
      total_conversions: kpis.current.conversions,
      total_revenue: kpis.current.revenue,
      avg_ctr: kpis.current.impressions > 0
        ? (kpis.current.clicks / kpis.current.impressions) * 100
        : 0,
      avg_cpc: kpis.current.clicks > 0
        ? kpis.current.spend / kpis.current.clicks
        : 0,
      avg_cpm: kpis.current.impressions > 0
        ? (kpis.current.spend / kpis.current.impressions) * 1000
        : 0,
      avg_frequency: kpis.current.reach > 0
        ? kpis.current.impressions / kpis.current.reach
        : 0,
      avg_roas: kpis.current.spend > 0
        ? kpis.current.revenue / kpis.current.spend
        : 0,
      avg_cpa: kpis.current.conversions > 0
        ? kpis.current.spend / kpis.current.conversions
        : 0,
      spend_change: calculatePercentChange(kpis.current.spend, kpis.previous.spend),
      impressions_change: calculatePercentChange(kpis.current.impressions, kpis.previous.impressions),
      clicks_change: calculatePercentChange(kpis.current.clicks, kpis.previous.clicks),
      conversions_change: calculatePercentChange(kpis.current.conversions, kpis.previous.conversions),
      roas_change: calculatePercentChange(
        kpis.current.spend > 0 ? kpis.current.revenue / kpis.current.spend : 0,
        kpis.previous.spend > 0 ? kpis.previous.revenue / kpis.previous.spend : 0
      ),
      active_campaigns: entityCounts.campaigns,
      active_adsets: entityCounts.adsets,
      active_ads: entityCounts.ads,
      fatigued_ads: rows.filter(r => r.has_fatigue_warning).length,
    }

    return NextResponse.json({
      data: rows,
      kpis: dashboardKPIs,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Meta Ads performance error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ============================================
// Helper Functions
// ============================================

function getDateDaysAgo(days: number, fromDate?: Date): string {
  const date = fromDate ? new Date(fromDate) : new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}

function getDaysDiff(start: string, end: string): number {
  const startDate = new Date(start)
  const endDate = new Date(end)
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
}

function calculateTrend(current?: number, previous?: number): TrendDirection {
  if (!current || !previous || previous === 0) return 'stable'
  const change = ((current - previous) / previous) * 100
  if (change > 5) return 'up'
  if (change < -5) return 'down'
  return 'stable'
}

function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100 * 10) / 10
}

/**
 * Get previous period data aggregated by entity for trend comparison
 */
async function getPreviousPeriodMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  adAccountId: string,
  entityType: MetaEntityType,
  dateStart: string,
  dateEnd: string
): Promise<Map<string, { spend: number; ctr: number; roas: number }>> {
  const { data } = await supabase
    .from('meta_insights_daily')
    .select('entity_id, spend, ctr, roas')
    .eq('client_id', clientId)
    .eq('ad_account_id', adAccountId)
    .eq('entity_type', entityType)
    .gte('date', dateStart)
    .lte('date', dateEnd)

  const map = new Map<string, { spend: number; ctr: number; roas: number }>()

  if (!data) return map

  // Aggregate by entity_id
  for (const row of data) {
    const existing = map.get(row.entity_id)
    if (existing) {
      existing.spend += row.spend || 0
      // For CTR and ROAS, we'll use the average (simplified)
      existing.ctr = (existing.ctr + (row.ctr || 0)) / 2
      existing.roas = (existing.roas + (row.roas || 0)) / 2
    } else {
      map.set(row.entity_id, {
        spend: row.spend || 0,
        ctr: row.ctr || 0,
        roas: row.roas || 0,
      })
    }
  }

  return map
}

/**
 * Get extended KPIs with current and previous period totals
 */
async function getExtendedKPIs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  adAccountId: string,
  currentStart: string,
  currentEnd: string,
  previousStart: string,
  previousEnd: string
): Promise<{
  current: { spend: number; impressions: number; reach: number; clicks: number; conversions: number; revenue: number }
  previous: { spend: number; impressions: number; reach: number; clicks: number; conversions: number; revenue: number }
}> {
  // Get current period totals
  const { data: currentData } = await supabase
    .from('meta_insights_daily')
    .select('spend, impressions, reach, clicks, conversions, conversion_value')
    .eq('client_id', clientId)
    .eq('ad_account_id', adAccountId)
    .eq('entity_type', 'ad') // Sum at ad level to avoid double counting
    .gte('date', currentStart)
    .lte('date', currentEnd)

  // Get previous period totals
  const { data: previousData } = await supabase
    .from('meta_insights_daily')
    .select('spend, impressions, reach, clicks, conversions, conversion_value')
    .eq('client_id', clientId)
    .eq('ad_account_id', adAccountId)
    .eq('entity_type', 'ad')
    .gte('date', previousStart)
    .lte('date', previousEnd)

  type KPITotals = { spend: number; impressions: number; reach: number; clicks: number; conversions: number; revenue: number }
  type InsightRow = { spend: number | null; impressions: number | null; reach: number | null; clicks: number | null; conversions: number | null; conversion_value: number | null }

  const sumData = (data: InsightRow[] | null): KPITotals => {
    if (!data) return { spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0 }
    return data.reduce<KPITotals>(
      (acc: KPITotals, row: InsightRow) => ({
        spend: acc.spend + (row.spend || 0),
        impressions: acc.impressions + (row.impressions || 0),
        reach: acc.reach + (row.reach || 0),
        clicks: acc.clicks + (row.clicks || 0),
        conversions: acc.conversions + (row.conversions || 0),
        revenue: acc.revenue + (row.conversion_value || 0),
      }),
      { spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0 }
    )
  }

  return {
    current: sumData(currentData),
    previous: sumData(previousData),
  }
}

/**
 * Get counts of active entities (entities with spend > 0 in period)
 */
async function getEntityCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  adAccountId: string,
  dateStart: string,
  dateEnd: string
): Promise<{ campaigns: number; adsets: number; ads: number }> {
  // Get unique campaign IDs with spend
  const { data: campaigns } = await supabase
    .from('meta_insights_daily')
    .select('entity_id')
    .eq('client_id', clientId)
    .eq('ad_account_id', adAccountId)
    .eq('entity_type', 'campaign')
    .gte('date', dateStart)
    .lte('date', dateEnd)
    .gt('spend', 0)

  // Get unique adset IDs with spend
  const { data: adsets } = await supabase
    .from('meta_insights_daily')
    .select('entity_id')
    .eq('client_id', clientId)
    .eq('ad_account_id', adAccountId)
    .eq('entity_type', 'adset')
    .gte('date', dateStart)
    .lte('date', dateEnd)
    .gt('spend', 0)

  // Get unique ad IDs with spend
  const { data: ads } = await supabase
    .from('meta_insights_daily')
    .select('entity_id')
    .eq('client_id', clientId)
    .eq('ad_account_id', adAccountId)
    .eq('entity_type', 'ad')
    .gte('date', dateStart)
    .lte('date', dateEnd)
    .gt('spend', 0)

  // Count unique entity IDs
  const uniqueCampaigns = new Set(campaigns?.map((c: { entity_id: string }) => c.entity_id) || [])
  const uniqueAdsets = new Set(adsets?.map((a: { entity_id: string }) => a.entity_id) || [])
  const uniqueAds = new Set(ads?.map((a: { entity_id: string }) => a.entity_id) || [])

  return {
    campaigns: uniqueCampaigns.size,
    adsets: uniqueAdsets.size,
    ads: uniqueAds.size,
  }
}
