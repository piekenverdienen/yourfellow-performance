import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { GoogleAdsClient } from '@/monitoring/google-ads/client'
import { createLogger } from '@/monitoring/utils/logger'
import type { GoogleAdsCredentials } from '@/monitoring/google-ads/types'

interface GoogleAdsDataPoint {
  date: string
  spend: number
  clicks: number
  impressions: number
  conversions: number
  ctr: number
  cpc: number
}

interface GoogleAdsSummary {
  totalSpend: number
  totalClicks: number
  totalImpressions: number
  totalConversions: number
  avgCtr: number
  avgCpc: number
  spendChange: number
  clicksChange: number
  conversionsChange: number
  period: {
    start: string
    end: string
  }
}

// Get service role client for database operations (bypasses RLS)
function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service role credentials')
  }

  return createServiceClient(supabaseUrl, serviceRoleKey)
}

// GET - Fetch Google Ads trend data for Control Room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Fetch client - RLS will handle access control
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, settings')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Client niet gevonden of geen toegang' }, { status: 404 })
      }
      console.error('Error fetching client:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Check if Google Ads is configured for this client
    const googleAdsSettings = client.settings?.googleAds
    if (!googleAdsSettings?.customerId) {
      return NextResponse.json({
        enabled: false,
        message: 'Google Ads niet geconfigureerd voor deze client'
      })
    }

    // Get global Google Ads credentials from app_settings
    const serviceClient = getServiceSupabase()
    const { data: credentialsData } = await serviceClient
      .from('app_settings')
      .select('value')
      .eq('key', 'google_ads_credentials')
      .single()

    if (!credentialsData?.value) {
      return NextResponse.json({
        enabled: false,
        message: 'Google Ads API niet geconfigureerd (geen credentials)'
      })
    }

    const storedCredentials = credentialsData.value as {
      type: string
      developerToken: string
      serviceAccountEmail?: string
      privateKey?: string
      loginCustomerId?: string
    }

    // Build credentials object
    const credentials: GoogleAdsCredentials = {
      type: 'service_account',
      developerToken: storedCredentials.developerToken,
      serviceAccountEmail: storedCredentials.serviceAccountEmail || '',
      privateKey: storedCredentials.privateKey || '',
      loginCustomerId: storedCredentials.loginCustomerId,
    }

    // Initialize Google Ads client
    const logger = createLogger('debug')
    const googleAdsClient = new GoogleAdsClient({
      credentials,
      customerId: googleAdsSettings.customerId,
      logger,
    })

    // Calculate date range (last 14 days)
    const endDate = getYesterdayDate()
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 13) // 14 days total

    // Previous period for comparison
    const previousEndDate = new Date(startDate)
    previousEndDate.setDate(previousEndDate.getDate() - 1)
    const previousStartDate = new Date(previousEndDate)
    previousStartDate.setDate(previousStartDate.getDate() - 13)

    // Fetch current period data via GAQL
    const currentPeriodData = await fetchCampaignMetrics(
      googleAdsClient,
      formatDate(startDate),
      formatDate(endDate)
    )

    // Fetch previous period data for comparison
    const previousPeriodData = await fetchCampaignMetrics(
      googleAdsClient,
      formatDate(previousStartDate),
      formatDate(previousEndDate)
    )

    // Check if we have any data
    if (currentPeriodData.length === 0) {
      return NextResponse.json({
        enabled: true,
        customerId: googleAdsSettings.customerId,
        data: [],
        summary: null,
        message: 'Geen Google Ads data beschikbaar voor deze periode'
      })
    }

    // Aggregate by date
    const dailyMap = new Map<string, { spend: number; clicks: number; impressions: number; conversions: number }>()

    for (const row of currentPeriodData) {
      const existing = dailyMap.get(row.date)
      if (existing) {
        existing.spend += row.spend
        existing.clicks += row.clicks
        existing.impressions += row.impressions
        existing.conversions += row.conversions
      } else {
        dailyMap.set(row.date, {
          spend: row.spend,
          clicks: row.clicks,
          impressions: row.impressions,
          conversions: row.conversions,
        })
      }
    }

    // Convert to data points
    const dataPoints: GoogleAdsDataPoint[] = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        spend: Math.round(data.spend * 100) / 100,
        clicks: data.clicks,
        impressions: data.impressions,
        conversions: data.conversions,
        ctr: data.impressions > 0 ? Math.round((data.clicks / data.impressions) * 10000) / 100 : 0,
        cpc: data.clicks > 0 ? Math.round((data.spend / data.clicks) * 100) / 100 : 0,
      }))

    // Calculate totals for current period
    const currentTotals = dataPoints.reduce(
      (acc, d) => ({
        spend: acc.spend + d.spend,
        clicks: acc.clicks + d.clicks,
        impressions: acc.impressions + d.impressions,
        conversions: acc.conversions + d.conversions,
      }),
      { spend: 0, clicks: 0, impressions: 0, conversions: 0 }
    )

    // Calculate totals for previous period
    const previousTotals = previousPeriodData.reduce(
      (acc, row) => ({
        spend: acc.spend + row.spend,
        clicks: acc.clicks + row.clicks,
        impressions: acc.impressions + row.impressions,
        conversions: acc.conversions + row.conversions,
      }),
      { spend: 0, clicks: 0, impressions: 0, conversions: 0 }
    )

    // Calculate metrics
    const currentCtr = currentTotals.impressions > 0 ? (currentTotals.clicks / currentTotals.impressions) * 100 : 0
    const currentCpc = currentTotals.clicks > 0 ? currentTotals.spend / currentTotals.clicks : 0

    // Calculate percentage changes
    const calcChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100 * 10) / 10
    }

    const summary: GoogleAdsSummary = {
      totalSpend: Math.round(currentTotals.spend * 100) / 100,
      totalClicks: currentTotals.clicks,
      totalImpressions: currentTotals.impressions,
      totalConversions: currentTotals.conversions,
      avgCtr: Math.round(currentCtr * 100) / 100,
      avgCpc: Math.round(currentCpc * 100) / 100,
      spendChange: calcChange(currentTotals.spend, previousTotals.spend),
      clicksChange: calcChange(currentTotals.clicks, previousTotals.clicks),
      conversionsChange: calcChange(currentTotals.conversions, previousTotals.conversions),
      period: {
        start: formatDate(startDate),
        end: formatDate(endDate)
      }
    }

    return NextResponse.json({
      enabled: true,
      customerId: googleAdsSettings.customerId,
      data: dataPoints,
      summary
    })

  } catch (error) {
    console.error('Google Ads data fetch error:', error)
    return NextResponse.json({
      error: 'Fout bij ophalen van Google Ads data',
      details: error instanceof Error ? error.message : 'Onbekende fout'
    }, { status: 500 })
  }
}

interface CampaignMetricRow {
  date: string
  spend: number
  clicks: number
  impressions: number
  conversions: number
}

async function fetchCampaignMetrics(
  client: GoogleAdsClient,
  startDate: string,
  endDate: string
): Promise<CampaignMetricRow[]> {
  const query = `
    SELECT
      segments.date,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date
  `

  try {
    const response = await client.query(query)

    return response.results.map((row) => {
      const segments = row.segments as { date?: string } | undefined
      const metrics = row.metrics as {
        costMicros?: string
        clicks?: string
        impressions?: string
        conversions?: string
      } | undefined

      return {
        date: segments?.date || '',
        spend: metrics?.costMicros ? parseInt(metrics.costMicros, 10) / 1_000_000 : 0,
        clicks: metrics?.clicks ? parseInt(metrics.clicks, 10) : 0,
        impressions: metrics?.impressions ? parseInt(metrics.impressions, 10) : 0,
        conversions: metrics?.conversions ? parseFloat(metrics.conversions) : 0,
      }
    })
  } catch (error) {
    console.error('Error fetching Google Ads campaign metrics:', error)
    return []
  }
}

function getYesterdayDate(): Date {
  const now = new Date()
  now.setDate(now.getDate() - 1)
  now.setHours(0, 0, 0, 0)
  return now
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
