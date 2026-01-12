/**
 * Meta Ads Cron Sync API
 *
 * This endpoint is called by Vercel Cron to sync Meta Ads data daily.
 * It syncs all enabled clients and runs fatigue detection after each sync.
 *
 * Schedule: Daily at 6:00 AM UTC (7:00 AM CET)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getMetaAdsCronSyncService } from '@/services/meta-ads-sync'
import { getMetaCronFatigueDetector } from '@/services/meta-fatigue-detector'
import type { MetaAdsSettings } from '@/types'
import type { MetaFatigueSignal } from '@/types/meta-ads'

// Use service role for cron jobs (no user context)
function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Support both naming conventions for service role key
  const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase credentials for cron job (SUPABASE_SERVICE_KEY)')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

/**
 * Convert fatigue signals to alerts so they appear on the /alerts page
 */
async function createAlertsFromFatigueSignals(
  supabase: SupabaseClient,
  clientId: string,
  clientName: string,
  signals: MetaFatigueSignal[]
): Promise<number> {
  let alertsCreated = 0
  const today = new Date().toISOString().slice(0, 10)

  for (const signal of signals) {
    // Only create alerts for high/critical severity
    if (signal.severity !== 'high' && signal.severity !== 'critical') {
      continue
    }

    // Create unique fingerprint per entity per day
    const fingerprint = `meta_fatigue:${signal.entity_type}:${signal.entity_id}:${today}`

    // Check if alert already exists
    const { data: existing } = await supabase
      .from('alerts')
      .select('id')
      .eq('fingerprint', fingerprint)
      .single()

    if (existing) {
      continue // Skip duplicate
    }

    // Build alert title and description
    const entityLabel = signal.entity_type === 'ad'
      ? 'Ad'
      : signal.entity_type === 'adset'
        ? 'Ad Set'
        : 'Campaign'

    const title = `${entityLabel} fatigue: ${signal.entity_name}`
    const shortDescription = signal.reasons.slice(0, 2).join('. ')

    // Build impact description
    const impactParts: string[] = []
    if (signal.frequency_change > 0) {
      impactParts.push(`Frequency +${signal.frequency_change.toFixed(0)}%`)
    }
    if (signal.ctr_change < -10) {
      impactParts.push(`CTR ${signal.ctr_change.toFixed(0)}%`)
    }
    if (signal.cpc_change > 10) {
      impactParts.push(`CPC +${signal.cpc_change.toFixed(0)}%`)
    }
    const impact = impactParts.length > 0
      ? `Performance degradatie: ${impactParts.join(', ')}`
      : 'Creatieve vermoeidheid gedetecteerd'

    // Insert alert
    const { error } = await supabase.from('alerts').insert({
      client_id: clientId,
      type: 'performance',
      channel: 'meta',
      check_id: `meta_fatigue_${signal.entity_type}`,
      severity: signal.severity,
      status: 'open',
      title,
      short_description: shortDescription,
      impact,
      suggested_actions: signal.suggested_actions,
      details: {
        clientName,
        entity_type: signal.entity_type,
        entity_id: signal.entity_id,
        entity_name: signal.entity_name,
        campaign_name: signal.campaign_name,
        adset_name: signal.adset_name,
        current_frequency: signal.current_frequency,
        current_ctr: signal.current_ctr,
        current_cpc: signal.current_cpc,
        baseline_ctr: signal.baseline_ctr,
        baseline_cpc: signal.baseline_cpc,
        frequency_change: signal.frequency_change,
        ctr_change: signal.ctr_change,
        cpc_change: signal.cpc_change,
        reasons: signal.reasons,
      },
      fingerprint,
      detected_at: signal.detected_at || new Date().toISOString(),
    })

    if (!error) {
      alertsCreated++
    } else {
      console.error(`[Cron] Failed to create alert for ${signal.entity_name}:`, error.message)
    }
  }

  return alertsCreated
}

export async function GET(request: NextRequest) {
  try {
    // Skip auth in development for easy testing
    const isDev = process.env.NODE_ENV === 'development'

    if (!isDev) {
      // Verify cron secret (Vercel sends this header)
      // SECURITY: Always require CRON_SECRET in production
      const authHeader = request.headers.get('authorization')
      const cronSecret = process.env.CRON_SECRET

      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.error('Unauthorized cron request - missing or invalid CRON_SECRET')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    console.log('[Cron] Starting Meta Ads sync job...')

    const supabase = getServiceSupabase()

    // Get all active clients with Meta Ads enabled
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, settings')
      .eq('is_active', true)

    if (clientsError) {
      console.error('[Cron] Failed to fetch clients:', clientsError)
      return NextResponse.json(
        { error: 'Failed to fetch clients' },
        { status: 500 }
      )
    }

    // Filter clients with Meta Ads enabled and configured
    const enabledClients = (clients || []).filter(client => {
      const meta = client.settings?.meta as MetaAdsSettings | undefined
      return (
        meta?.enabled &&
        meta?.syncEnabled !== false && // Default to enabled if not set
        meta?.accessToken &&
        meta?.adAccountId
      )
    })

    console.log(`[Cron] Found ${enabledClients.length} clients with Meta Ads enabled`)

    const results: {
      clientId: string
      clientName: string
      syncSuccess: boolean
      syncError?: string
      fatigueDetected: number
      alertsCreated: number
      fatigueError?: string
    }[] = []

    const syncService = getMetaAdsCronSyncService()
    const fatigueDetector = getMetaCronFatigueDetector()

    // Process each client
    for (const client of enabledClients) {
      const meta = client.settings?.meta as MetaAdsSettings
      const result: typeof results[0] = {
        clientId: client.id,
        clientName: client.name,
        syncSuccess: false,
        fatigueDetected: 0,
        alertsCreated: 0,
      }

      try {
        // Step 1: Sync data from Meta API
        console.log(`[Cron] Syncing client: ${client.name}`)
        const syncResult = await syncService.syncClient({
          clientId: client.id,
          adAccountId: meta.adAccountId!,
        })

        result.syncSuccess = syncResult.success
        if (!syncResult.success && syncResult.errors) {
          result.syncError = syncResult.errors.join(', ')
        }

        console.log(
          `[Cron] Sync complete for ${client.name}: ${syncResult.synced.ads} ads synced`
        )

        // Step 2: Run fatigue detection (only if sync was successful)
        if (syncResult.success) {
          try {
            console.log(`[Cron] Running fatigue detection for: ${client.name}`)
            const fatigueSignals = await fatigueDetector.detectFatigue(
              client.id,
              `act_${meta.adAccountId!.replace(/^act_/, '')}`
            )

            result.fatigueDetected = fatigueSignals.length
            console.log(
              `[Cron] Fatigue detection complete for ${client.name}: ${fatigueSignals.length} signals`
            )

            // Step 3: Create alerts from high-severity fatigue signals
            if (fatigueSignals.length > 0) {
              const alertsCreated = await createAlertsFromFatigueSignals(
                supabase,
                client.id,
                client.name,
                fatigueSignals
              )
              result.alertsCreated = alertsCreated

              if (alertsCreated > 0) {
                console.log(
                  `[Cron] Created ${alertsCreated} alerts for ${client.name}`
                )
              }
            }
          } catch (fatigueError) {
            console.error(
              `[Cron] Fatigue detection failed for ${client.name}:`,
              fatigueError
            )
            result.fatigueError =
              fatigueError instanceof Error
                ? fatigueError.message
                : 'Unknown fatigue error'
          }
        }
      } catch (syncError) {
        console.error(`[Cron] Sync failed for ${client.name}:`, syncError)
        result.syncError =
          syncError instanceof Error ? syncError.message : 'Unknown sync error'
      }

      results.push(result)
    }

    // Summary
    const successful = results.filter(r => r.syncSuccess).length
    const failed = results.filter(r => !r.syncSuccess).length
    const totalFatigue = results.reduce((sum, r) => sum + r.fatigueDetected, 0)
    const totalAlerts = results.reduce((sum, r) => sum + r.alertsCreated, 0)

    console.log(
      `[Cron] Job complete. Synced: ${successful}/${enabledClients.length}, Fatigue signals: ${totalFatigue}, Alerts created: ${totalAlerts}`
    )

    return NextResponse.json({
      success: true,
      summary: {
        totalClients: enabledClients.length,
        successful,
        failed,
        totalFatigueSignals: totalFatigue,
        totalAlertsCreated: totalAlerts,
      },
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron] Meta Ads sync job failed:', error)
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

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request)
}
