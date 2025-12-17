import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BetaAnalyticsDataClient } from '@google-analytics/data'

interface GA4DataPoint {
  date: string
  sessions: number
  totalUsers: number
  engagementRate: number
}

// GET - Fetch GA4 trend data for a client
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

    // Check if GA4 monitoring is enabled
    const ga4Settings = client.settings?.ga4Monitoring
    if (!ga4Settings?.enabled || !ga4Settings?.propertyId) {
      return NextResponse.json({
        enabled: false,
        message: 'GA4 monitoring niet ingeschakeld voor deze client'
      })
    }

    // Check if we have GA4 credentials
    const credentialsJson = process.env.GA4_CREDENTIALS
    if (!credentialsJson) {
      return NextResponse.json({
        error: 'GA4 credentials niet geconfigureerd'
      }, { status: 500 })
    }

    // Initialize GA4 client
    const credentials = JSON.parse(credentialsJson)
    const ga4Client = new BetaAnalyticsDataClient({ credentials })

    // Calculate date range (last 14 days)
    const timezone = ga4Settings.timezone || 'Europe/Amsterdam'
    const endDate = getYesterdayDate(timezone)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 13) // 14 days total

    const propertyId = `properties/${ga4Settings.propertyId}`

    // Fetch GA4 data
    const [response] = await ga4Client.runReport({
      property: propertyId,
      dateRanges: [{
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
      }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'engagementRate' }
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }]
    })

    // Process rows
    const dataPoints: GA4DataPoint[] = []

    if (response.rows) {
      for (const row of response.rows) {
        const rawDate = row.dimensionValues?.[0]?.value
        if (!rawDate) continue

        // Convert YYYYMMDD to YYYY-MM-DD
        const formattedDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`

        dataPoints.push({
          date: formattedDate,
          sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
          totalUsers: parseInt(row.metricValues?.[1]?.value || '0', 10),
          engagementRate: parseFloat(row.metricValues?.[2]?.value || '0') * 100 // Convert to percentage
        })
      }
    }

    // Calculate summary stats
    const totalSessions = dataPoints.reduce((sum, d) => sum + d.sessions, 0)
    const totalUsers = dataPoints.reduce((sum, d) => sum + d.totalUsers, 0)
    const avgEngagementRate = dataPoints.length > 0
      ? dataPoints.reduce((sum, d) => sum + d.engagementRate, 0) / dataPoints.length
      : 0

    // Calculate week-over-week change
    const lastWeek = dataPoints.slice(-7)
    const previousWeek = dataPoints.slice(0, 7)

    const lastWeekSessions = lastWeek.reduce((sum, d) => sum + d.sessions, 0)
    const previousWeekSessions = previousWeek.reduce((sum, d) => sum + d.sessions, 0)

    const sessionsChange = previousWeekSessions > 0
      ? ((lastWeekSessions - previousWeekSessions) / previousWeekSessions) * 100
      : 0

    return NextResponse.json({
      enabled: true,
      propertyId: ga4Settings.propertyId,
      data: dataPoints,
      summary: {
        totalSessions,
        totalUsers,
        avgEngagementRate: Math.round(avgEngagementRate * 10) / 10,
        sessionsChange: Math.round(sessionsChange * 10) / 10,
        period: {
          start: formatDate(startDate),
          end: formatDate(endDate)
        }
      }
    })

  } catch (error) {
    console.error('GA4 data fetch error:', error)
    return NextResponse.json({
      error: 'Fout bij ophalen van GA4 data',
      details: error instanceof Error ? error.message : 'Onbekende fout'
    }, { status: 500 })
  }
}

function getYesterdayDate(timezone: string): Date {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const todayStr = formatter.format(now)
  const today = new Date(todayStr + 'T00:00:00')
  today.setDate(today.getDate() - 1)
  return today
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
