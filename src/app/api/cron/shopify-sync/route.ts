/**
 * Shopify Sync & Monitoring Cron API
 *
 * This endpoint is called by Vercel Cron to sync Shopify data and detect anomalies.
 * It syncs order data and creates alerts for significant drops in revenue/orders.
 *
 * Schedule: Daily at 6:00 AM UTC (7:00 AM CET)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getShopifyCronSyncService } from '@/services/shopify-sync'
import type { ShopifySettings, ShopifyOrdersDaily } from '@/types'

// ============================================
// Types
// ============================================

interface ShopifyAnomalyResult {
  type: 'revenue_crash' | 'revenue_drop' | 'orders_crash' | 'orders_drop' | 'aov_drop' | 'high_refund_rate'
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  impact: string
  currentValue: number
  previousValue: number
  changePercent: number
  suggestedActions: string[]
}

interface ShopifyThresholds {
  revenueDropWarning: number    // Default: 20% drop = high
  revenueDropCritical: number   // Default: 40% drop = critical
  ordersDropWarning: number     // Default: 25% drop = high
  ordersDropCritical: number    // Default: 50% drop = critical
  aovDropWarning: number        // Default: 15% drop = medium
  highRefundRate: number        // Default: 10% = high
  minBaseline: number           // Default: 10 orders minimum
}

const DEFAULT_THRESHOLDS: ShopifyThresholds = {
  revenueDropWarning: 20,
  revenueDropCritical: 40,
  ordersDropWarning: 25,
  ordersDropCritical: 50,
  aovDropWarning: 15,
  highRefundRate: 10,
  minBaseline: 10,
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
// Anomaly Detection
// ============================================

function detectAnomalies(
  dataPoints: ShopifyOrdersDaily[],
  thresholds: ShopifyThresholds
): ShopifyAnomalyResult[] {
  const anomalies: ShopifyAnomalyResult[] = []

  if (dataPoints.length < 14) {
    console.log('[Shopify] Not enough data points for comparison')
    return anomalies
  }

  // Split into last 7 days and previous 7 days
  const lastWeek = dataPoints.slice(-7)
  const previousWeek = dataPoints.slice(-14, -7)

  // Calculate totals
  const lastWeekRevenue = lastWeek.reduce((sum, d) => sum + (d.total_revenue || 0), 0)
  const previousWeekRevenue = previousWeek.reduce((sum, d) => sum + (d.total_revenue || 0), 0)

  const lastWeekOrders = lastWeek.reduce((sum, d) => sum + (d.total_orders || 0), 0)
  const previousWeekOrders = previousWeek.reduce((sum, d) => sum + (d.total_orders || 0), 0)

  const lastWeekRefunds = lastWeek.reduce((sum, d) => sum + (d.refund_count || 0), 0)

  // Check minimum baseline
  if (previousWeekOrders < thresholds.minBaseline) {
    console.log('[Shopify] Previous week orders below minimum baseline, skipping checks')
    return anomalies
  }

  // Calculate changes
  const revenueChange = previousWeekRevenue > 0
    ? ((lastWeekRevenue - previousWeekRevenue) / previousWeekRevenue) * 100
    : 0

  const ordersChange = previousWeekOrders > 0
    ? ((lastWeekOrders - previousWeekOrders) / previousWeekOrders) * 100
    : 0

  const lastWeekAOV = lastWeekOrders > 0 ? lastWeekRevenue / lastWeekOrders : 0
  const previousWeekAOV = previousWeekOrders > 0 ? previousWeekRevenue / previousWeekOrders : 0
  const aovChange = previousWeekAOV > 0
    ? ((lastWeekAOV - previousWeekAOV) / previousWeekAOV) * 100
    : 0

  const refundRate = lastWeekOrders > 0 ? (lastWeekRefunds / lastWeekOrders) * 100 : 0

  // Check for revenue crash (critical)
  if (revenueChange <= -thresholds.revenueDropCritical) {
    anomalies.push({
      type: 'revenue_crash',
      severity: 'critical',
      title: 'Omzet crash gedetecteerd',
      description: `Omzet is ${Math.abs(revenueChange).toFixed(0)}% gedaald t.o.v. vorige week`,
      impact: `Van €${previousWeekRevenue.toFixed(0)} naar €${lastWeekRevenue.toFixed(0)} per week`,
      currentValue: lastWeekRevenue,
      previousValue: previousWeekRevenue,
      changePercent: revenueChange,
      suggestedActions: [
        'Controleer of de webshop correct werkt',
        'Check of betalingen worden verwerkt',
        'Analyseer of er voorraadproblemen zijn',
        'Bekijk of er prijswijzigingen of concurrentie-acties zijn',
      ],
    })
  }
  // Check for revenue drop (high)
  else if (revenueChange <= -thresholds.revenueDropWarning) {
    anomalies.push({
      type: 'revenue_drop',
      severity: 'high',
      title: 'Significante daling in omzet',
      description: `Omzet is ${Math.abs(revenueChange).toFixed(0)}% gedaald t.o.v. vorige week`,
      impact: `Van €${previousWeekRevenue.toFixed(0)} naar €${lastWeekRevenue.toFixed(0)} per week`,
      currentValue: lastWeekRevenue,
      previousValue: previousWeekRevenue,
      changePercent: revenueChange,
      suggestedActions: [
        'Analyseer welke productcategorieën zijn gedaald',
        'Check of er seizoensgebonden factoren zijn',
        'Bekijk of marketing campagnes zijn gepauzeerd',
        'Vergelijk conversieratio met vorige periode',
      ],
    })
  }

  // Check for orders crash (critical)
  if (ordersChange <= -thresholds.ordersDropCritical) {
    anomalies.push({
      type: 'orders_crash',
      severity: 'critical',
      title: 'Orders crash gedetecteerd',
      description: `Aantal orders is ${Math.abs(ordersChange).toFixed(0)}% gedaald`,
      impact: `Van ${previousWeekOrders} naar ${lastWeekOrders} orders per week`,
      currentValue: lastWeekOrders,
      previousValue: previousWeekOrders,
      changePercent: ordersChange,
      suggestedActions: [
        'Check of het checkout proces werkt',
        'Controleer of er technische problemen zijn',
        'Analyseer verkeer naar de webshop',
        'Test het volledige aankoopproces',
      ],
    })
  }
  // Check for orders drop (high)
  else if (ordersChange <= -thresholds.ordersDropWarning) {
    anomalies.push({
      type: 'orders_drop',
      severity: 'high',
      title: 'Significante daling in orders',
      description: `Aantal orders is ${Math.abs(ordersChange).toFixed(0)}% gedaald`,
      impact: `Van ${previousWeekOrders} naar ${lastWeekOrders} orders per week`,
      currentValue: lastWeekOrders,
      previousValue: previousWeekOrders,
      changePercent: ordersChange,
      suggestedActions: [
        'Analyseer conversieratio per kanaal',
        'Check bounce rate op productpaginas',
        'Bekijk of er UX problemen zijn gemeld',
      ],
    })
  }

  // Check for AOV drop (medium)
  if (aovChange <= -thresholds.aovDropWarning) {
    anomalies.push({
      type: 'aov_drop',
      severity: 'medium',
      title: 'Daling in gemiddelde orderwaarde',
      description: `Gemiddelde orderwaarde is ${Math.abs(aovChange).toFixed(0)}% gedaald`,
      impact: `Van €${previousWeekAOV.toFixed(2)} naar €${lastWeekAOV.toFixed(2)} per order`,
      currentValue: lastWeekAOV,
      previousValue: previousWeekAOV,
      changePercent: aovChange,
      suggestedActions: [
        'Analyseer welke producten worden verkocht',
        'Check of er kortingsacties actief zijn',
        'Bekijk cross-sell/upsell performance',
        'Vergelijk productmix met vorige periode',
      ],
    })
  }

  // Check for high refund rate (high)
  if (refundRate >= thresholds.highRefundRate && lastWeekOrders >= 10) {
    anomalies.push({
      type: 'high_refund_rate',
      severity: 'high',
      title: 'Hoog percentage retouren',
      description: `${refundRate.toFixed(1)}% van de orders wordt geretourneerd`,
      impact: `${lastWeekRefunds} retouren op ${lastWeekOrders} orders deze week`,
      currentValue: refundRate,
      previousValue: thresholds.highRefundRate,
      changePercent: refundRate - thresholds.highRefundRate,
      suggestedActions: [
        'Analyseer retourredenen per product',
        'Check productbeschrijvingen en foto\'s',
        'Bekijk of er kwaliteitsproblemen zijn',
        'Vergelijk met branche-gemiddelde',
      ],
    })
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
  storeId: string,
  anomalies: ShopifyAnomalyResult[]
): Promise<number> {
  let alertsCreated = 0
  const today = new Date().toISOString().slice(0, 10)

  for (const anomaly of anomalies) {
    const fingerprint = `shopify:${anomaly.type}:${storeId}:${today}`

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
      channel: 'shopify',
      check_id: `shopify_${anomaly.type}`,
      severity: anomaly.severity,
      status: 'open',
      title: anomaly.title,
      short_description: anomaly.description,
      impact: anomaly.impact,
      suggested_actions: anomaly.suggestedActions,
      details: {
        clientName,
        storeId,
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
      console.error(`[Shopify] Failed to create alert:`, error.message)
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
      console.error('[Shopify Cron] Unauthorized request - missing or invalid CRON_SECRET')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Shopify Cron] Starting Shopify sync & monitoring job...')

    const supabase = getServiceSupabase()
    const syncService = getShopifyCronSyncService()

    // Step 1: Sync all enabled clients
    console.log('[Shopify Cron] Syncing data from Shopify...')
    const syncResult = await syncService.syncAllClients()

    console.log(
      `[Shopify Cron] Sync complete. Total: ${syncResult.total}, Success: ${syncResult.success}, Failed: ${syncResult.failed}`
    )

    // Step 2: Run anomaly detection for each synced client
    console.log('[Shopify Cron] Running anomaly detection...')

    const results: {
      clientId: string
      clientName: string
      storeId: string
      syncSuccess: boolean
      syncedDays: number
      syncedOrders: number
      anomaliesDetected: number
      alertsCreated: number
      error?: string
    }[] = []

    // Get all active clients with Shopify enabled
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, settings')
      .eq('is_active', true)

    const enabledClients = (clients || []).filter(client => {
      const shopify = client.settings?.shopify as ShopifySettings | undefined
      return shopify?.enabled && shopify?.storeId
    })

    for (const client of enabledClients) {
      const shopifySettings = client.settings?.shopify as ShopifySettings
      const storeId = shopifySettings.storeId!

      // Find sync result for this client
      const clientSyncResult = syncResult.results.find(r => r.clientId === client.id)

      const result: {
        clientId: string
        clientName: string
        storeId: string
        syncSuccess: boolean
        syncedDays: number
        syncedOrders: number
        anomaliesDetected: number
        alertsCreated: number
        error?: string
      } = {
        clientId: client.id,
        clientName: client.name,
        storeId,
        syncSuccess: clientSyncResult?.result.success || false,
        syncedDays: clientSyncResult?.result.synced.days || 0,
        syncedOrders: clientSyncResult?.result.synced.orders || 0,
        anomaliesDetected: 0,
        alertsCreated: 0,
      }

      try {
        // Fetch last 14 days of data for anomaly detection
        const endDate = getDateDaysAgo(1) // Yesterday
        const startDate = getDateDaysAgo(14)

        const { data: dataPoints } = await supabase
          .from('shopify_orders_daily')
          .select('*')
          .eq('client_id', client.id)
          .gte('date', formatDate(startDate))
          .lte('date', formatDate(endDate))
          .order('date', { ascending: true })

        if (dataPoints && dataPoints.length >= 14) {
          // Build thresholds from client settings
          const thresholds: ShopifyThresholds = {
            ...DEFAULT_THRESHOLDS,
            ...(shopifySettings.thresholds || {}),
          }

          // Detect anomalies
          const anomalies = detectAnomalies(dataPoints as ShopifyOrdersDaily[], thresholds)
          result.anomaliesDetected = anomalies.length

          if (anomalies.length > 0) {
            console.log(`[Shopify Cron] Found ${anomalies.length} anomalies for ${client.name}`)

            // Create alerts
            const alertsCreated = await createAlertsFromAnomalies(
              supabase,
              client.id,
              client.name,
              storeId,
              anomalies
            )

            result.alertsCreated = alertsCreated

            if (alertsCreated > 0) {
              console.log(`[Shopify Cron] Created ${alertsCreated} alerts for ${client.name}`)
            }
          }
        }
      } catch (error) {
        console.error(`[Shopify Cron] Anomaly detection failed for ${client.name}:`, error)
        result.error = error instanceof Error ? error.message : 'Unknown error'
      }

      results.push(result)
    }

    // Summary
    const successful = results.filter(r => r.syncSuccess).length
    const totalAnomalies = results.reduce((sum, r) => sum + r.anomaliesDetected, 0)
    const totalAlerts = results.reduce((sum, r) => sum + r.alertsCreated, 0)

    console.log(
      `[Shopify Cron] Job complete. Synced: ${successful}/${enabledClients.length}, Anomalies: ${totalAnomalies}, Alerts: ${totalAlerts}`
    )

    return NextResponse.json({
      success: true,
      summary: {
        totalClients: enabledClients.length,
        syncedSuccessfully: successful,
        totalAnomalies,
        totalAlerts,
      },
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Shopify Cron] Job failed:', error)
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
