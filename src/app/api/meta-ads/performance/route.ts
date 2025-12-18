/**
 * Meta Ads Performance API
 *
 * GET /api/meta-ads/performance
 * Returns performance data for Meta Ads entities
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMetaAdsSyncService } from '@/services/meta-ads-sync'
import type { MetaEntityType, MetaPerformanceRow, MetaDashboardKPIs } from '@/types/meta-ads'

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

    // Get performance data
    const syncService = getMetaAdsSyncService()
    const { data, total } = await syncService.getPerformanceData(
      clientId,
      `act_${accountId.replace(/^act_/, '')}`,
      entityType,
      start,
      end,
      { page, pageSize, sortBy, sortOrder }
    )

    // Get KPIs
    const kpis = await syncService.getKPISummary(
      clientId,
      `act_${accountId.replace(/^act_/, '')}`,
      start,
      end
    )

    // Transform data to PerformanceRows
    const rows: MetaPerformanceRow[] = data.map(insight => ({
      entity_type: insight.entity_type,
      entity_id: insight.entity_id,
      entity_name: insight.entity_name,
      status: 'ACTIVE', // Would need to fetch from campaigns/ads table
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
      spend_trend: 'stable',
      ctr_trend: 'stable',
      roas_trend: 'stable',
      has_fatigue_warning: insight.frequency > (metaSettings?.thresholds?.frequencyWarning || 2.5),
      fatigue_severity: insight.frequency > 4 ? 'high' : insight.frequency > 3 ? 'medium' : 'low',
    }))

    // Build KPIs response
    const dashboardKPIs: MetaDashboardKPIs = {
      total_spend: kpis.total_spend,
      total_impressions: kpis.total_impressions,
      total_reach: 0, // Would need separate query
      total_clicks: kpis.total_clicks,
      total_conversions: kpis.total_conversions,
      total_revenue: 0, // Would need conversion value sum
      avg_ctr: kpis.avg_ctr,
      avg_cpc: kpis.avg_cpc,
      avg_cpm: kpis.total_impressions > 0 ? (kpis.total_spend / kpis.total_impressions) * 1000 : 0,
      avg_frequency: 0, // Would need separate calculation
      avg_roas: kpis.avg_roas,
      avg_cpa: kpis.total_conversions > 0 ? kpis.total_spend / kpis.total_conversions : 0,
      spend_change: 0,
      impressions_change: 0,
      clicks_change: 0,
      conversions_change: 0,
      roas_change: 0,
      active_campaigns: 0,
      active_adsets: 0,
      active_ads: rows.length,
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

function getDateDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}
