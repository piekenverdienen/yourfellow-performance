import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface MetaDataPoint {
  date: string
  spend: number
  roas: number
  conversions: number
  cpa: number
}

interface MetaSummary {
  totalSpend: number
  avgROAS: number
  totalConversions: number
  avgCPA: number
  spendChange: number
  roasChange: number
  conversionsChange: number
  cpaChange: number
  period: {
    start: string
    end: string
  }
}

// GET - Fetch Meta Ads trend data for Control Room
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

    // Check if Meta Ads is configured
    const metaSettings = client.settings?.meta
    if (!metaSettings?.adAccountId) {
      return NextResponse.json({
        enabled: false,
        message: 'Meta Ads niet geconfigureerd voor deze client'
      })
    }

    const adAccountId = `act_${metaSettings.adAccountId.replace(/^act_/, '')}`

    // Calculate date range (last 14 days)
    const endDate = getYesterdayDate()
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 13) // 14 days total

    // Previous period for comparison
    const previousEndDate = new Date(startDate)
    previousEndDate.setDate(previousEndDate.getDate() - 1)
    const previousStartDate = new Date(previousEndDate)
    previousStartDate.setDate(previousStartDate.getDate() - 13)

    // Fetch current period data - aggregate by date at campaign level (most accurate)
    const { data: currentData, error: dataError } = await supabase
      .from('meta_insights_daily')
      .select('date, spend, conversions, conversion_value')
      .eq('client_id', id)
      .eq('ad_account_id', adAccountId)
      .eq('entity_type', 'campaign')
      .gte('date', formatDate(startDate))
      .lte('date', formatDate(endDate))
      .order('date', { ascending: true })

    if (dataError) {
      console.error('Error fetching meta insights:', dataError)
      return NextResponse.json({ error: dataError.message }, { status: 500 })
    }

    // Check if we have any data
    if (!currentData || currentData.length === 0) {
      return NextResponse.json({
        enabled: true,
        adAccountId: metaSettings.adAccountId,
        data: [],
        summary: null,
        message: 'Geen Meta Ads data beschikbaar voor deze periode'
      })
    }

    // Aggregate by date (multiple campaigns per day)
    const dailyMap = new Map<string, { spend: number; conversions: number; revenue: number }>()

    for (const row of currentData) {
      const existing = dailyMap.get(row.date)
      if (existing) {
        existing.spend += row.spend || 0
        existing.conversions += row.conversions || 0
        existing.revenue += row.conversion_value || 0
      } else {
        dailyMap.set(row.date, {
          spend: row.spend || 0,
          conversions: row.conversions || 0,
          revenue: row.conversion_value || 0
        })
      }
    }

    // Convert to data points
    const dataPoints: MetaDataPoint[] = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        spend: Math.round(data.spend * 100) / 100,
        roas: data.spend > 0 ? Math.round((data.revenue / data.spend) * 100) / 100 : 0,
        conversions: data.conversions,
        cpa: data.conversions > 0 ? Math.round((data.spend / data.conversions) * 100) / 100 : 0
      }))

    // Fetch previous period for comparison
    const { data: previousData } = await supabase
      .from('meta_insights_daily')
      .select('spend, conversions, conversion_value')
      .eq('client_id', id)
      .eq('ad_account_id', adAccountId)
      .eq('entity_type', 'campaign')
      .gte('date', formatDate(previousStartDate))
      .lte('date', formatDate(previousEndDate))

    // Calculate totals for current period
    const currentTotals = dataPoints.reduce(
      (acc, d) => ({
        spend: acc.spend + d.spend,
        conversions: acc.conversions + d.conversions,
        revenue: acc.revenue + (d.spend * d.roas) // Reverse calculate revenue
      }),
      { spend: 0, conversions: 0, revenue: 0 }
    )

    // Calculate totals for previous period
    const previousTotals = (previousData || []).reduce(
      (acc: { spend: number; conversions: number; revenue: number }, row: { spend?: number; conversions?: number; conversion_value?: number }) => ({
        spend: acc.spend + (row.spend || 0),
        conversions: acc.conversions + (row.conversions || 0),
        revenue: acc.revenue + (row.conversion_value || 0)
      }),
      { spend: 0, conversions: 0, revenue: 0 }
    )

    // Calculate metrics
    const currentROAS = currentTotals.spend > 0 ? currentTotals.revenue / currentTotals.spend : 0
    const previousROAS = previousTotals.spend > 0 ? previousTotals.revenue / previousTotals.spend : 0
    const currentCPA = currentTotals.conversions > 0 ? currentTotals.spend / currentTotals.conversions : 0
    const previousCPA = previousTotals.conversions > 0 ? previousTotals.spend / previousTotals.conversions : 0

    // Calculate percentage changes
    const calcChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100 * 10) / 10
    }

    const summary: MetaSummary = {
      totalSpend: Math.round(currentTotals.spend * 100) / 100,
      avgROAS: Math.round(currentROAS * 100) / 100,
      totalConversions: currentTotals.conversions,
      avgCPA: Math.round(currentCPA * 100) / 100,
      spendChange: calcChange(currentTotals.spend, previousTotals.spend),
      roasChange: calcChange(currentROAS, previousROAS),
      conversionsChange: calcChange(currentTotals.conversions, previousTotals.conversions),
      cpaChange: calcChange(currentCPA, previousCPA), // Note: lower CPA is better, UI should handle this
      period: {
        start: formatDate(startDate),
        end: formatDate(endDate)
      }
    }

    return NextResponse.json({
      enabled: true,
      adAccountId: metaSettings.adAccountId,
      data: dataPoints,
      summary
    })

  } catch (error) {
    console.error('Meta Ads data fetch error:', error)
    return NextResponse.json({
      error: 'Fout bij ophalen van Meta Ads data',
      details: error instanceof Error ? error.message : 'Onbekende fout'
    }, { status: 500 })
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
