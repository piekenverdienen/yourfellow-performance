/**
 * Meta Ads Sync Service
 *
 * Syncs performance data from Meta Ads API to Supabase.
 * Designed for daily/scheduled sync operations.
 */

import { createClient } from '@/lib/supabase/server'
import { MetaAdsClient, parseMetaInsights } from '@/lib/meta/client'
import type {
  MetaInsightDaily,
  MetaSyncRequest,
  MetaSyncResponse,
  MetaEntityType,
} from '@/types/meta-ads'
import type { MetaAdsSettings } from '@/types'

// ============================================
// Types
// ============================================

interface SyncStats {
  campaigns: number
  adsets: number
  ads: number
  insights: number
}

// ============================================
// Meta Ads Sync Service
// ============================================

export class MetaAdsSyncService {
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  /**
   * Sync Meta Ads data for a specific client
   */
  async syncClient(request: MetaSyncRequest): Promise<MetaSyncResponse> {
    const { clientId, adAccountId, dateStart, dateEnd, entityTypes } = request

    const stats: SyncStats = {
      campaigns: 0,
      adsets: 0,
      ads: 0,
      insights: 0,
    }
    const errors: string[] = []

    try {
      // Get client settings
      const supabase = await this.getSupabase()
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('settings')
        .eq('id', clientId)
        .single()

      if (clientError || !client) {
        return {
          success: false,
          synced: stats,
          errors: ['Client not found'],
        }
      }

      const metaSettings = client.settings?.meta as MetaAdsSettings | undefined
      if (!metaSettings?.enabled || !metaSettings.accessToken) {
        return {
          success: false,
          synced: stats,
          errors: ['Meta Ads not configured for this client'],
        }
      }

      // Initialize Meta client
      const metaClient = new MetaAdsClient({
        accessToken: metaSettings.accessToken,
        adAccountId: adAccountId || metaSettings.adAccountId,
      })

      // Calculate date range (default: last 7 days)
      const endDate = dateEnd || new Date().toISOString().split('T')[0]
      const startDate = dateStart || this.getDateDaysAgo(7)

      // Determine which entity types to sync
      const typesToSync = entityTypes || ['campaign', 'adset', 'ad']
      const accountId = MetaAdsClient.formatAdAccountId(
        adAccountId || metaSettings.adAccountId || ''
      )

      // Sync each entity type
      for (const entityType of typesToSync) {
        try {
          const insights = await this.syncEntityType(
            metaClient,
            clientId,
            accountId,
            entityType as MetaEntityType,
            startDate,
            endDate
          )
          stats.insights += insights

          // Update counts
          if (entityType === 'campaign') stats.campaigns = insights
          if (entityType === 'adset') stats.adsets = insights
          if (entityType === 'ad') stats.ads = insights
        } catch (error) {
          const errorMsg = `Failed to sync ${entityType}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }
      }

      // Update last sync timestamp
      await this.updateLastSyncTimestamp(clientId)

      return {
        success: errors.length === 0,
        synced: stats,
        errors: errors.length > 0 ? errors : undefined,
      }
    } catch (error) {
      console.error('Meta Ads sync error:', error)
      return {
        success: false,
        synced: stats,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }
    }
  }

  /**
   * Sync a specific entity type
   */
  private async syncEntityType(
    client: MetaAdsClient,
    clientId: string,
    adAccountId: string,
    entityType: MetaEntityType,
    dateStart: string,
    dateEnd: string
  ): Promise<number> {
    // Fetch insights from Meta API
    const rawInsights = await client.getAccountInsights(
      adAccountId,
      dateStart,
      dateEnd,
      entityType
    )

    if (rawInsights.length === 0) {
      return 0
    }

    // Parse to typed insights
    const insights = parseMetaInsights(rawInsights, clientId, adAccountId)

    // Upsert to database
    await this.upsertInsights(insights)

    return insights.length
  }

  /**
   * Upsert insights to database (idempotent)
   */
  private async upsertInsights(insights: MetaInsightDaily[]): Promise<void> {
    if (insights.length === 0) return

    const supabase = await this.getSupabase()

    // Upsert in batches of 100
    const batchSize = 100
    for (let i = 0; i < insights.length; i += batchSize) {
      const batch = insights.slice(i, i + batchSize)

      const { error } = await supabase
        .from('meta_insights_daily')
        .upsert(batch, {
          onConflict: 'client_id,ad_account_id,entity_type,entity_id,date',
          ignoreDuplicates: false,
        })

      if (error) {
        console.error('Upsert error:', error)
        throw new Error(`Failed to upsert insights: ${error.message}`)
      }
    }
  }

  /**
   * Update the last sync timestamp for a client
   */
  private async updateLastSyncTimestamp(clientId: string): Promise<void> {
    const supabase = await this.getSupabase()

    // Get current settings
    const { data: client } = await supabase
      .from('clients')
      .select('settings')
      .eq('id', clientId)
      .single()

    if (!client) return

    const settings = client.settings || {}
    const metaSettings = (settings.meta || {}) as MetaAdsSettings

    // Update lastSyncAt
    metaSettings.lastSyncAt = new Date().toISOString()

    const { error } = await supabase
      .from('clients')
      .update({
        settings: {
          ...settings,
          meta: metaSettings,
        },
      })
      .eq('id', clientId)

    if (error) {
      console.error('Failed to update last sync timestamp:', error)
    }
  }

  /**
   * Sync all enabled clients
   */
  async syncAllClients(): Promise<{
    total: number
    success: number
    failed: number
    results: { clientId: string; clientName: string; result: MetaSyncResponse }[]
  }> {
    const supabase = await this.getSupabase()

    // Get all clients with Meta enabled
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, settings')
      .eq('is_active', true)

    if (error || !clients) {
      return { total: 0, success: 0, failed: 0, results: [] }
    }

    interface ClientRow { id: string; name: string; settings: Record<string, unknown> | null }
    // Filter clients with Meta enabled
    const enabledClients = (clients as ClientRow[]).filter((c: ClientRow) => {
      const meta = c.settings?.meta as MetaAdsSettings | undefined
      return meta?.enabled && meta?.syncEnabled && meta?.accessToken && meta?.adAccountId
    })

    const results: { clientId: string; clientName: string; result: MetaSyncResponse }[] = []
    let success = 0
    let failed = 0

    for (const client of enabledClients) {
      const meta = client.settings?.meta as MetaAdsSettings
      const result = await this.syncClient({
        clientId: client.id,
        adAccountId: meta.adAccountId!,
      })

      results.push({
        clientId: client.id,
        clientName: client.name,
        result,
      })

      if (result.success) {
        success++
      } else {
        failed++
      }
    }

    return {
      total: enabledClients.length,
      success,
      failed,
      results,
    }
  }

  /**
   * Get aggregated performance data for a client
   */
  async getPerformanceData(
    clientId: string,
    adAccountId: string,
    entityType: MetaEntityType,
    dateStart: string,
    dateEnd: string,
    options?: {
      page?: number
      pageSize?: number
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
    }
  ): Promise<{ data: MetaInsightDaily[]; total: number }> {
    const supabase = await this.getSupabase()

    const page = options?.page || 1
    const pageSize = options?.pageSize || 50
    const sortBy = options?.sortBy || 'spend'
    const sortOrder = options?.sortOrder || 'desc'
    const offset = (page - 1) * pageSize

    // Build query
    let query = supabase
      .from('meta_insights_daily')
      .select('*', { count: 'exact' })
      .eq('client_id', clientId)
      .eq('ad_account_id', adAccountId)
      .eq('entity_type', entityType)
      .gte('date', dateStart)
      .lte('date', dateEnd)

    // Add sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Add pagination
    query = query.range(offset, offset + pageSize - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('Failed to fetch performance data:', error)
      throw new Error(`Failed to fetch performance data: ${error.message}`)
    }

    return {
      data: (data || []) as MetaInsightDaily[],
      total: count || 0,
    }
  }

  /**
   * Get KPI summary for date range
   */
  async getKPISummary(
    clientId: string,
    adAccountId: string,
    dateStart: string,
    dateEnd: string
  ): Promise<{
    total_spend: number
    total_impressions: number
    total_clicks: number
    total_conversions: number
    avg_ctr: number
    avg_cpc: number
    avg_roas: number
  }> {
    const supabase = await this.getSupabase()

    const { data, error } = await supabase
      .from('meta_insights_daily')
      .select('spend, impressions, clicks, conversions, conversion_value, ctr, cpc, roas')
      .eq('client_id', clientId)
      .eq('ad_account_id', adAccountId)
      .eq('entity_type', 'campaign') // Campaign level has accurate totals (ads miss dynamic ad spend)
      .gte('date', dateStart)
      .lte('date', dateEnd)

    if (error || !data) {
      return {
        total_spend: 0,
        total_impressions: 0,
        total_clicks: 0,
        total_conversions: 0,
        avg_ctr: 0,
        avg_cpc: 0,
        avg_roas: 0,
      }
    }

    interface MetricRow { spend: number | null; impressions: number | null; clicks: number | null; conversions: number | null; conversion_value: number | null }
    interface Totals { spend: number; impressions: number; clicks: number; conversions: number; conversion_value: number }
    const totals = (data as MetricRow[]).reduce(
      (acc: Totals, row: MetricRow) => ({
        spend: acc.spend + (row.spend || 0),
        impressions: acc.impressions + (row.impressions || 0),
        clicks: acc.clicks + (row.clicks || 0),
        conversions: acc.conversions + (row.conversions || 0),
        conversion_value: acc.conversion_value + (row.conversion_value || 0),
      }),
      {
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        conversion_value: 0,
      }
    )

    // Calculate derived metrics from totals (more accurate than averaging)
    const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
    const avgCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
    const avgRoas = totals.spend > 0 ? totals.conversion_value / totals.spend : 0

    return {
      total_spend: totals.spend,
      total_impressions: totals.impressions,
      total_clicks: totals.clicks,
      total_conversions: totals.conversions,
      avg_ctr: avgCtr,
      avg_cpc: avgCpc,
      avg_roas: avgRoas,
    }
  }

  // ============================================
  // Helpers
  // ============================================

  private getDateDaysAgo(days: number): string {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.toISOString().split('T')[0]
  }
}

// ============================================
// Singleton Export
// ============================================

let syncServiceInstance: MetaAdsSyncService | null = null

export function getMetaAdsSyncService(): MetaAdsSyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new MetaAdsSyncService()
  }
  return syncServiceInstance
}
