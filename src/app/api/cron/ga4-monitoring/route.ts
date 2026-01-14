/**
 * GA4 Monitoring Cron API
 *
 * This endpoint is called by Vercel Cron to monitor GA4 data daily.
 * It checks for anomalies (traffic drops, engagement issues) and creates alerts.
 *
 * Schedule: Daily at 7:00 AM UTC (8:00 AM CET)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { BetaAnalyticsDataClient } from '@google-analytics/data'
import type { GA4MonitoringSettings } from '@/types'

// ============================================
// Types
// ============================================

interface GA4DailyMetrics {
  date: string
  sessions: number
  totalUsers: number
  engagementRate: number
  conversions?: number
  revenue?: number
}

interface GA4AnomalyResult {
  type: 'sessions_crash' | 'sessions_drop' | 'users_drop' | 'engagement_drop' | 'conversions_drop'
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  impact: string
  currentValue: number
  previousValue: number
  changePercent: number
  suggestedActions: string[]
}

interface GA4Thresholds {
  sessionsCrash: number    // Default: 40% drop = critical
  sessionsDrop: number     // Default: 20% drop = high
  usersDrop: number        // Default: 25% drop = high
  engagementDrop: number   // Default: 30% drop = medium
  conversionsDrop: number  // Default: 30% drop = critical
  minBaseline: number      // Default: 20 sessions minimum
}

const DEFAULT_THRESHOLDS: GA4Thresholds = {
  sessionsCrash: 40,
  sessionsDrop: 20,
  usersDrop: 25,
  engagementDrop: 30,
  conversionsDrop: 30,
  minBaseline: 20,
}

// ============================================
// Helpers
// ============================================

function getServiceSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase credentials for cron job (SUPABASE_SERVICE_KEY)')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getDateDaysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

// ============================================
// GA4 Data Fetching
// ============================================

async function fetchGA4Data(
  ga4Client: InstanceType<typeof BetaAnalyticsDataClient>,
  propertyId: string,
  startDate: Date,
  endDate: Date,
  isEcommerce: boolean = false
): Promise<GA4DailyMetrics[]> {
  const metrics = [
    { name: 'sessions' },
    { name: 'totalUsers' },
    { name: 'engagementRate' },
  ]

  if (isEcommerce) {
    metrics.push({ name: 'conversions' })
    metrics.push({ name: 'purchaseRevenue' })
  }

  const [response] = await ga4Client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    }],
    dimensions: [{ name: 'date' }],
    metrics,
    orderBys: [{ dimension: { dimensionName: 'date' } }]
  })

  const dataPoints: GA4DailyMetrics[] = []

  if (response.rows) {
    for (const row of response.rows) {
      const rawDate = row.dimensionValues?.[0]?.value
      if (!rawDate) continue

      const formattedDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`

      dataPoints.push({
        date: formattedDate,
        sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
        totalUsers: parseInt(row.metricValues?.[1]?.value || '0', 10),
        engagementRate: parseFloat(row.metricValues?.[2]?.value || '0') * 100,
        conversions: isEcommerce ? parseInt(row.metricValues?.[3]?.value || '0', 10) : undefined,
        revenue: isEcommerce ? parseFloat(row.metricValues?.[4]?.value || '0') : undefined,
      })
    }
  }

  return dataPoints
}

// ============================================
// Anomaly Detection
// ============================================

function detectAnomalies(
  dataPoints: GA4DailyMetrics[],
  thresholds: GA4Thresholds,
  isEcommerce: boolean
): GA4AnomalyResult[] {
  const anomalies: GA4AnomalyResult[] = []

  if (dataPoints.length < 14) {
    console.log('[GA4] Not enough data points for comparison')
    return anomalies
  }

  // Split into last 7 days and previous 7 days
  const lastWeek = dataPoints.slice(-7)
  const previousWeek = dataPoints.slice(-14, -7)

  // Calculate totals
  const lastWeekSessions = lastWeek.reduce((sum, d) => sum + d.sessions, 0)
  const previousWeekSessions = previousWeek.reduce((sum, d) => sum + d.sessions, 0)

  const lastWeekUsers = lastWeek.reduce((sum, d) => sum + d.totalUsers, 0)
  const previousWeekUsers = previousWeek.reduce((sum, d) => sum + d.totalUsers, 0)

  const lastWeekEngagement = lastWeek.reduce((sum, d) => sum + d.engagementRate, 0) / lastWeek.length
  const previousWeekEngagement = previousWeek.reduce((sum, d) => sum + d.engagementRate, 0) / previousWeek.length

  // Check minimum baseline
  if (previousWeekSessions < thresholds.minBaseline * 7) {
    console.log('[GA4] Previous week sessions below minimum baseline, skipping checks')
    return anomalies
  }

  // Calculate changes
  const sessionsChange = previousWeekSessions > 0
    ? ((lastWeekSessions - previousWeekSessions) / previousWeekSessions) * 100
    : 0

  const usersChange = previousWeekUsers > 0
    ? ((lastWeekUsers - previousWeekUsers) / previousWeekUsers) * 100
    : 0

  const engagementChange = previousWeekEngagement > 0
    ? ((lastWeekEngagement - previousWeekEngagement) / previousWeekEngagement) * 100
    : 0

  // Check for sessions crash (critical)
  if (sessionsChange <= -thresholds.sessionsCrash) {
    anomalies.push({
      type: 'sessions_crash',
      severity: 'critical',
      title: 'Verkeer crash gedetecteerd',
      description: `Sessions zijn ${Math.abs(sessionsChange).toFixed(0)}% gedaald t.o.v. vorige week`,
      impact: `Van ${previousWeekSessions} naar ${lastWeekSessions} sessions per week`,
      currentValue: lastWeekSessions,
      previousValue: previousWeekSessions,
      changePercent: sessionsChange,
      suggestedActions: [
        'Controleer of de tracking code nog correct werkt',
        'Check Google Search Console voor indexeringsproblemen',
        'Bekijk of er server/hosting problemen zijn',
        'Analyseer of er recente site wijzigingen zijn geweest',
      ],
    })
  }
  // Check for sessions drop (high)
  else if (sessionsChange <= -thresholds.sessionsDrop) {
    anomalies.push({
      type: 'sessions_drop',
      severity: 'high',
      title: 'Significante daling in verkeer',
      description: `Sessions zijn ${Math.abs(sessionsChange).toFixed(0)}% gedaald t.o.v. vorige week`,
      impact: `Van ${previousWeekSessions} naar ${lastWeekSessions} sessions per week`,
      currentValue: lastWeekSessions,
      previousValue: previousWeekSessions,
      changePercent: sessionsChange,
      suggestedActions: [
        'Analyseer welke kanalen zijn gedaald (Organic, Paid, Direct)',
        'Check of er seizoensgebonden factoren zijn',
        'Bekijk of campagnes zijn gepauzeerd of budgetten verlaagd',
      ],
    })
  }

  // Check for users drop
  if (usersChange <= -thresholds.usersDrop && sessionsChange > -thresholds.sessionsDrop) {
    anomalies.push({
      type: 'users_drop',
      severity: 'high',
      title: 'Daling in unieke gebruikers',
      description: `Unieke gebruikers zijn ${Math.abs(usersChange).toFixed(0)}% gedaald`,
      impact: `Van ${previousWeekUsers} naar ${lastWeekUsers} unieke gebruikers`,
      currentValue: lastWeekUsers,
      previousValue: previousWeekUsers,
      changePercent: usersChange,
      suggestedActions: [
        'Analyseer of bestaande gebruikers terugkomen',
        'Check acquisitie kanalen voor nieuwe gebruikers',
        'Bekijk of er problemen zijn met remarketing',
      ],
    })
  }

  // Check for engagement drop
  if (engagementChange <= -thresholds.engagementDrop) {
    anomalies.push({
      type: 'engagement_drop',
      severity: 'medium',
      title: 'Daling in engagement',
      description: `Engagement rate is ${Math.abs(engagementChange).toFixed(0)}% gedaald`,
      impact: `Van ${previousWeekEngagement.toFixed(1)}% naar ${lastWeekEngagement.toFixed(1)}%`,
      currentValue: lastWeekEngagement,
      previousValue: previousWeekEngagement,
      changePercent: engagementChange,
      suggestedActions: [
        'Analyseer welke paginas lagere engagement hebben',
        'Check of er UX/UI wijzigingen zijn geweest',
        'Bekijk laadtijden van de website',
        'Test de mobiele ervaring',
      ],
    })
  }

  // Check for conversions drop (e-commerce only)
  if (isEcommerce) {
    const lastWeekConversions = lastWeek.reduce((sum, d) => sum + (d.conversions || 0), 0)
    const previousWeekConversions = previousWeek.reduce((sum, d) => sum + (d.conversions || 0), 0)

    const conversionsChange = previousWeekConversions > 0
      ? ((lastWeekConversions - previousWeekConversions) / previousWeekConversions) * 100
      : 0

    if (conversionsChange <= -thresholds.conversionsDrop && previousWeekConversions >= 5) {
      anomalies.push({
        type: 'conversions_drop',
        severity: 'critical',
        title: 'Conversies significant gedaald',
        description: `Conversies zijn ${Math.abs(conversionsChange).toFixed(0)}% gedaald`,
        impact: `Van ${previousWeekConversions} naar ${lastWeekConversions} conversies`,
        currentValue: lastWeekConversions,
        previousValue: previousWeekConversions,
        changePercent: conversionsChange,
        suggestedActions: [
          'Check of het checkout proces werkt',
          'Analyseer of er prijswijzigingen zijn geweest',
          'Bekijk of betaalmethodes werken',
          'Test het volledige aankoopproces',
        ],
      })
    }
  }

  return anomalies
}

// ============================================
// Alert Creation
// ============================================

async function createAlertsFromAnomalies(
  supabase: SupabaseClient,
  clientId: string,
  clientName: string,
  propertyId: string,
  anomalies: GA4AnomalyResult[]
): Promise<number> {
  let alertsCreated = 0
  const today = new Date().toISOString().slice(0, 10)

  for (const anomaly of anomalies) {
    const fingerprint = `ga4:${anomaly.type}:${propertyId}:${today}`

    // Check if alert already exists
    const { data: existing } = await supabase
      .from('alerts')
      .select('id')
      .eq('fingerprint', fingerprint)
      .single()

    if (existing) {
      continue
    }

    const { error } = await supabase.from('alerts').insert({
      client_id: clientId,
      type: 'performance',
      channel: 'website',
      check_id: `ga4_${anomaly.type}`,
      severity: anomaly.severity,
      status: 'open',
      title: anomaly.title,
      short_description: anomaly.description,
      impact: anomaly.impact,
      suggested_actions: anomaly.suggestedActions,
      details: {
        clientName,
        propertyId,
        anomalyType: anomaly.type,
        currentValue: anomaly.currentValue,
        previousValue: anomaly.previousValue,
        changePercent: anomaly.changePercent,
      },
      fingerprint,
      detected_at: new Date().toISOString(),
    })

    if (!error) {
      alertsCreated++
    } else {
      console.error(`[GA4] Failed to create alert:`, error.message)
    }
  }

  return alertsCreated
}

// ============================================
// Main Handler
// ============================================

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Always require CRON_SECRET - no development bypass
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error('[GA4 Cron] Unauthorized request - missing or invalid CRON_SECRET')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[GA4 Cron] Starting GA4 monitoring job...')

    // Check for GA4 credentials
    const credentialsJson = process.env.GA4_CREDENTIALS
    if (!credentialsJson) {
      console.error('[GA4 Cron] GA4_CREDENTIALS not configured')
      return NextResponse.json({
        success: false,
        error: 'GA4_CREDENTIALS not configured',
      }, { status: 500 })
    }

    const credentials = JSON.parse(credentialsJson)
    const ga4Client = new BetaAnalyticsDataClient({ credentials })
    const supabase = getServiceSupabase()

    // Get all active clients with GA4 enabled
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, settings')
      .eq('is_active', true)

    if (clientsError) {
      console.error('[GA4 Cron] Failed to fetch clients:', clientsError)
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
    }

    // Filter clients with GA4 enabled
    const enabledClients = (clients || []).filter(client => {
      const ga4 = client.settings?.ga4Monitoring as GA4MonitoringSettings | undefined
      return ga4?.enabled && ga4?.propertyId
    })

    console.log(`[GA4 Cron] Found ${enabledClients.length} clients with GA4 enabled`)

    const results: {
      clientId: string
      clientName: string
      propertyId: string
      success: boolean
      anomaliesDetected: number
      alertsCreated: number
      error?: string
    }[] = []

    // Process each client
    for (const client of enabledClients) {
      const ga4Settings = client.settings?.ga4Monitoring as GA4MonitoringSettings
      const propertyId = ga4Settings.propertyId!

      const result: {
        clientId: string
        clientName: string
        propertyId: string
        success: boolean
        anomaliesDetected: number
        alertsCreated: number
        error?: string
      } = {
        clientId: client.id,
        clientName: client.name,
        propertyId,
        success: false,
        anomaliesDetected: 0,
        alertsCreated: 0,
      }

      try {
        console.log(`[GA4 Cron] Checking client: ${client.name}`)

        // Fetch last 14 days of data
        const endDate = getDateDaysAgo(1) // Yesterday
        const startDate = getDateDaysAgo(14)

        const dataPoints = await fetchGA4Data(
          ga4Client,
          propertyId,
          startDate,
          endDate,
          ga4Settings.isEcommerce || false
        )

        console.log(`[GA4 Cron] Fetched ${dataPoints.length} days of data for ${client.name}`)

        // Build thresholds from client settings
        const thresholds: GA4Thresholds = {
          ...DEFAULT_THRESHOLDS,
          ...(ga4Settings.thresholds || {}),
        }

        // Detect anomalies
        const anomalies = detectAnomalies(
          dataPoints,
          thresholds,
          ga4Settings.isEcommerce || false
        )

        result.anomaliesDetected = anomalies.length
        result.success = true

        if (anomalies.length > 0) {
          console.log(`[GA4 Cron] Found ${anomalies.length} anomalies for ${client.name}`)

          // Create alerts
          const alertsCreated = await createAlertsFromAnomalies(
            supabase,
            client.id,
            client.name,
            propertyId,
            anomalies
          )

          result.alertsCreated = alertsCreated

          if (alertsCreated > 0) {
            console.log(`[GA4 Cron] Created ${alertsCreated} alerts for ${client.name}`)
          }
        }
      } catch (error) {
        console.error(`[GA4 Cron] Failed for ${client.name}:`, error)
        result.error = error instanceof Error ? error.message : 'Unknown error'
      }

      results.push(result)
    }

    // Summary
    const successful = results.filter(r => r.success).length
    const totalAnomalies = results.reduce((sum, r) => sum + r.anomaliesDetected, 0)
    const totalAlerts = results.reduce((sum, r) => sum + r.alertsCreated, 0)

    console.log(
      `[GA4 Cron] Job complete. Checked: ${successful}/${enabledClients.length}, Anomalies: ${totalAnomalies}, Alerts: ${totalAlerts}`
    )

    return NextResponse.json({
      success: true,
      summary: {
        totalClients: enabledClients.length,
        successful,
        totalAnomalies,
        totalAlerts,
      },
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[GA4 Cron] Job failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// Support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request)
}
