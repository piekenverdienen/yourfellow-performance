/**
 * Meta Ads Fatigue Detection Service
 *
 * Detects creative fatigue based on:
 * - High frequency (> 2.5)
 * - CTR decline (> 30% drop vs baseline)
 * - CPC increase
 * - Spend threshold met
 */

import { createClient } from '@/lib/supabase/server'
import type {
  MetaFatigueSignal,
  MetaFatigueSeverity,
  MetaInsightDaily,
} from '@/types/meta-ads'
import type { MetaAdsSettings } from '@/types'

// ============================================
// Types
// ============================================

interface FatigueThresholds {
  frequencyWarning: number
  ctrDropWarning: number
  minSpendForAlert: number
}

interface BaselineMetrics {
  avg_frequency: number
  avg_ctr: number
  avg_cpc: number
  total_spend: number
}

// ============================================
// Default Thresholds
// ============================================

const DEFAULT_THRESHOLDS: FatigueThresholds = {
  frequencyWarning: 2.5,
  ctrDropWarning: 30,
  minSpendForAlert: 10,
}

// ============================================
// Fatigue Detection Service
// ============================================

export class MetaFatigueDetector {
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  /**
   * Detect fatigue for all ads in a client's account
   */
  async detectFatigue(
    clientId: string,
    adAccountId: string,
    thresholds?: Partial<FatigueThresholds>
  ): Promise<MetaFatigueSignal[]> {
    const t = { ...DEFAULT_THRESHOLDS, ...thresholds }
    const signals: MetaFatigueSignal[] = []

    const supabase = await this.getSupabase()

    // Get recent data (last 7 days)
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    // Get baseline data (previous 7 days)
    const baselineEnd = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
    const baselineStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    // Fetch current period data (grouped by entity)
    const { data: currentData, error: currentError } = await supabase
      .from('meta_insights_daily')
      .select('*')
      .eq('client_id', clientId)
      .eq('ad_account_id', adAccountId)
      .eq('entity_type', 'ad')
      .gte('date', startDate)
      .lte('date', endDate)

    if (currentError || !currentData) {
      console.error('Failed to fetch current data:', currentError)
      return signals
    }

    // Fetch baseline data
    const { data: baselineData, error: baselineError } = await supabase
      .from('meta_insights_daily')
      .select('*')
      .eq('client_id', clientId)
      .eq('ad_account_id', adAccountId)
      .eq('entity_type', 'ad')
      .gte('date', baselineStart)
      .lte('date', baselineEnd)

    if (baselineError) {
      console.error('Failed to fetch baseline data:', baselineError)
    }

    // Group data by entity
    const currentByEntity = this.groupByEntity(currentData as MetaInsightDaily[])
    const baselineByEntity = this.groupByEntity((baselineData || []) as MetaInsightDaily[])

    // Analyze each entity
    for (const [entityId, currentMetrics] of Object.entries(currentByEntity)) {
      const baselineMetrics = baselineByEntity[entityId]

      // Calculate averages for current period
      const current = this.calculateAverages(currentMetrics)

      // Skip if below spend threshold
      if (current.total_spend < t.minSpendForAlert) continue

      // Get baseline or use defaults
      const baseline = baselineMetrics
        ? this.calculateAverages(baselineMetrics)
        : {
            avg_frequency: 1.5,
            avg_ctr: current.avg_ctr * 1.3, // Assume 30% higher baseline
            avg_cpc: current.avg_cpc * 0.8, // Assume 20% lower baseline
            total_spend: 0,
          }

      // Detect fatigue
      const signal = this.analyzeForFatigue(
        clientId,
        adAccountId,
        currentMetrics[0], // Use first record for entity info
        current,
        baseline,
        t
      )

      if (signal) {
        signals.push(signal)
      }
    }

    // Store signals in database
    if (signals.length > 0) {
      await this.storeSignals(signals)
    }

    return signals
  }

  /**
   * Group insights by entity ID
   */
  private groupByEntity(
    data: MetaInsightDaily[]
  ): Record<string, MetaInsightDaily[]> {
    return data.reduce((acc, row) => {
      if (!acc[row.entity_id]) {
        acc[row.entity_id] = []
      }
      acc[row.entity_id].push(row)
      return acc
    }, {} as Record<string, MetaInsightDaily[]>)
  }

  /**
   * Calculate average metrics for a period
   */
  private calculateAverages(data: MetaInsightDaily[]): BaselineMetrics {
    if (data.length === 0) {
      return { avg_frequency: 0, avg_ctr: 0, avg_cpc: 0, total_spend: 0 }
    }

    const totals = data.reduce(
      (acc, row) => ({
        frequency: acc.frequency + (row.frequency || 0),
        ctr: acc.ctr + (row.ctr || 0),
        cpc: acc.cpc + (row.cpc || 0),
        spend: acc.spend + (row.spend || 0),
        count: acc.count + 1,
      }),
      { frequency: 0, ctr: 0, cpc: 0, spend: 0, count: 0 }
    )

    return {
      avg_frequency: totals.frequency / totals.count,
      avg_ctr: totals.ctr / totals.count,
      avg_cpc: totals.cpc / totals.count,
      total_spend: totals.spend,
    }
  }

  /**
   * Analyze metrics for fatigue signals
   */
  private analyzeForFatigue(
    clientId: string,
    adAccountId: string,
    entityInfo: MetaInsightDaily,
    current: BaselineMetrics,
    baseline: BaselineMetrics,
    thresholds: FatigueThresholds
  ): MetaFatigueSignal | null {
    const reasons: string[] = []
    const actions: string[] = []

    // Check frequency
    const frequencyHigh = current.avg_frequency > thresholds.frequencyWarning

    // Check CTR drop
    const ctrDrop = baseline.avg_ctr > 0
      ? ((baseline.avg_ctr - current.avg_ctr) / baseline.avg_ctr) * 100
      : 0
    const ctrDropped = ctrDrop > thresholds.ctrDropWarning

    // Check CPC increase
    const cpcIncrease = baseline.avg_cpc > 0
      ? ((current.avg_cpc - baseline.avg_cpc) / baseline.avg_cpc) * 100
      : 0
    const cpcIncreased = cpcIncrease > 20 // 20% increase

    // Determine if fatigued
    const isFatigued = frequencyHigh && (ctrDropped || cpcIncreased)

    if (!isFatigued) return null

    // Build reasons
    if (frequencyHigh) {
      reasons.push(
        `Frequency te hoog: ${current.avg_frequency.toFixed(1)} (drempel: ${thresholds.frequencyWarning})`
      )
      actions.push('Vergroot de doelgroep of voeg nieuwe creatives toe')
    }

    if (ctrDropped) {
      reasons.push(
        `CTR gedaald met ${ctrDrop.toFixed(1)}% t.o.v. baseline`
      )
      actions.push('Test nieuwe ad creatives met andere hooks')
    }

    if (cpcIncreased) {
      reasons.push(
        `CPC gestegen met ${cpcIncrease.toFixed(1)}% t.o.v. baseline`
      )
      actions.push('Controleer targeting en overweeg een lagere bid')
    }

    // Determine severity
    let severity: MetaFatigueSeverity = 'low'
    if (current.avg_frequency > 4 && ctrDrop > 40) {
      severity = 'critical'
    } else if (current.avg_frequency > 3.5 && ctrDrop > 30) {
      severity = 'high'
    } else if (current.avg_frequency > 3 || ctrDrop > 25) {
      severity = 'medium'
    }

    return {
      client_id: clientId,
      ad_account_id: adAccountId,
      entity_type: entityInfo.entity_type,
      entity_id: entityInfo.entity_id,
      entity_name: entityInfo.entity_name,
      campaign_name: entityInfo.campaign_name,
      adset_name: entityInfo.adset_name,

      current_frequency: current.avg_frequency,
      current_ctr: current.avg_ctr,
      current_cpc: current.avg_cpc,

      baseline_frequency: baseline.avg_frequency,
      baseline_ctr: baseline.avg_ctr,
      baseline_cpc: baseline.avg_cpc,

      frequency_change:
        baseline.avg_frequency > 0
          ? ((current.avg_frequency - baseline.avg_frequency) / baseline.avg_frequency) * 100
          : 0,
      ctr_change: -ctrDrop, // Negative = drop
      cpc_change: cpcIncrease,

      severity,
      reasons,
      suggested_actions: actions,

      is_acknowledged: false,
      detected_at: new Date().toISOString(),
    }
  }

  /**
   * Store fatigue signals in database
   */
  private async storeSignals(signals: MetaFatigueSignal[]): Promise<void> {
    const supabase = await this.getSupabase()

    for (const signal of signals) {
      // Check if similar signal exists recently (within 24h)
      const { data: existing } = await supabase
        .from('meta_fatigue_signals')
        .select('id')
        .eq('client_id', signal.client_id)
        .eq('entity_id', signal.entity_id)
        .eq('is_acknowledged', false)
        .gte(
          'detected_at',
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        )
        .single()

      if (existing) {
        // Update existing signal
        await supabase
          .from('meta_fatigue_signals')
          .update({
            current_frequency: signal.current_frequency,
            current_ctr: signal.current_ctr,
            current_cpc: signal.current_cpc,
            frequency_change: signal.frequency_change,
            ctr_change: signal.ctr_change,
            cpc_change: signal.cpc_change,
            severity: signal.severity,
            reasons: signal.reasons,
            suggested_actions: signal.suggested_actions,
            detected_at: signal.detected_at,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      } else {
        // Insert new signal
        await supabase.from('meta_fatigue_signals').insert(signal)
      }
    }
  }

  /**
   * Get active fatigue signals for a client
   */
  async getActiveSignals(
    clientId: string,
    options?: {
      severity?: MetaFatigueSeverity[]
      includeAcknowledged?: boolean
    }
  ): Promise<MetaFatigueSignal[]> {
    const supabase = await this.getSupabase()

    let query = supabase
      .from('meta_fatigue_signals')
      .select('*')
      .eq('client_id', clientId)
      .order('detected_at', { ascending: false })

    if (!options?.includeAcknowledged) {
      query = query.eq('is_acknowledged', false)
    }

    if (options?.severity && options.severity.length > 0) {
      query = query.in('severity', options.severity)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch fatigue signals:', error)
      return []
    }

    return (data || []) as MetaFatigueSignal[]
  }

  /**
   * Acknowledge a fatigue signal
   */
  async acknowledgeSignal(signalId: string, userId: string): Promise<void> {
    const supabase = await this.getSupabase()

    await supabase
      .from('meta_fatigue_signals')
      .update({
        is_acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq('id', signalId)
  }
}

// ============================================
// Singleton Export
// ============================================

let detectorInstance: MetaFatigueDetector | null = null

export function getMetaFatigueDetector(): MetaFatigueDetector {
  if (!detectorInstance) {
    detectorInstance = new MetaFatigueDetector()
  }
  return detectorInstance
}
