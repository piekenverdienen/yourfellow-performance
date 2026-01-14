/**
 * Meta Ads Fatigue Detection Service
 *
 * Detects creative fatigue and scaling opportunities based on:
 * - High frequency (configurable, default > 2.5)
 * - CTR decline (configurable, default > 30% drop)
 * - CPC increase (configurable, default > 20%)
 * - ROAS decline (configurable, default > 25% drop)
 * - CPA increase (configurable, default > 25%)
 * - Reach plateau detection
 *
 * Also provides scaling recommendations for healthy ads.
 */

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type {
  MetaFatigueSignal,
  MetaFatigueSeverity,
  MetaInsightDaily,
  MetaPerformanceTargets,
  MetaAlertThresholds,
} from '@/types/meta-ads'
import type { MetaAdsSettings } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

interface MetaFatigueDetectorOptions {
  useServiceRole?: boolean
}

// ============================================
// Types
// ============================================

interface FatigueThresholds {
  frequencyWarning: number      // Max frequency before warning
  ctrDropWarning: number        // % CTR drop to trigger warning
  cpcIncreaseWarning: number    // % CPC increase to trigger warning
  roasDropWarning: number       // % ROAS drop to trigger warning
  cpaIncreaseWarning: number    // % CPA increase to trigger warning
  minSpendForAlert: number      // Min spend to consider for alerts
  reachPlateau: number          // % reach growth below this = plateau
}

interface ExtendedMetrics {
  avg_frequency: number
  avg_ctr: number
  avg_cpc: number
  avg_roas: number
  avg_cpa: number
  total_spend: number
  total_conversions: number
  total_reach: number
  total_impressions: number
}

export interface ScalingRecommendation {
  entity_id: string
  entity_name: string
  campaign_name?: string
  recommendation: 'scale_up' | 'maintain' | 'scale_down' | 'pause'
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
  suggested_actions: string[]
  metrics: {
    spend: number
    roas: number
    cpa: number
    frequency: number
    ctr_trend: number
    roas_trend: number
  }
}

// ============================================
// Default Thresholds
// ============================================

const DEFAULT_THRESHOLDS: FatigueThresholds = {
  frequencyWarning: 2.5,
  ctrDropWarning: 30,
  cpcIncreaseWarning: 20,
  roasDropWarning: 25,
  cpaIncreaseWarning: 25,
  minSpendForAlert: 10,
  reachPlateau: 5,
}

// ============================================
// Fatigue Detection Service
// ============================================

export class MetaFatigueDetector {
  private supabase: SupabaseClient | null = null
  private useServiceRole: boolean

  constructor(options: MetaFatigueDetectorOptions = {}) {
    this.useServiceRole = options.useServiceRole ?? false
  }

  private async getSupabase(): Promise<SupabaseClient> {
    if (!this.supabase) {
      if (this.useServiceRole) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !serviceKey) {
          throw new Error('Missing Supabase service credentials for cron fatigue detection')
        }

        this.supabase = createServiceClient(supabaseUrl, serviceKey)
      } else {
        this.supabase = await createClient()
      }
    }
    return this.supabase!
  }

  /**
   * Get client-specific targets and alert thresholds from settings
   */
  private async getClientTargets(clientId: string): Promise<{
    targets: MetaPerformanceTargets
    alertThresholds: MetaAlertThresholds
  }> {
    const supabase = await this.getSupabase()

    const { data } = await supabase
      .from('clients')
      .select('settings')
      .eq('id', clientId)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metaSettings = data?.settings?.meta as any | undefined

    // Return client targets with fallbacks to defaults
    return {
      targets: metaSettings?.targets || {},
      alertThresholds: metaSettings?.alertThresholds || metaSettings?.thresholds || {},
    }
  }

  /**
   * Build fatigue thresholds from client settings
   */
  private buildThresholdsFromClientSettings(
    targets: MetaPerformanceTargets,
    alertThresholds: MetaAlertThresholds,
    overrides?: Partial<FatigueThresholds>
  ): FatigueThresholds {
    return {
      // Use client's maxFrequency or alertThreshold, fall back to default
      frequencyWarning: overrides?.frequencyWarning
        ?? alertThresholds.frequencyWarning
        ?? targets.maxFrequency
        ?? DEFAULT_THRESHOLDS.frequencyWarning,

      // Use client's alert thresholds or defaults
      ctrDropWarning: overrides?.ctrDropWarning
        ?? alertThresholds.ctrDropWarning
        ?? DEFAULT_THRESHOLDS.ctrDropWarning,

      cpcIncreaseWarning: overrides?.cpcIncreaseWarning
        ?? alertThresholds.cpcIncreaseWarning
        ?? DEFAULT_THRESHOLDS.cpcIncreaseWarning,

      roasDropWarning: overrides?.roasDropWarning
        ?? alertThresholds.roasDropWarning
        ?? DEFAULT_THRESHOLDS.roasDropWarning,

      cpaIncreaseWarning: overrides?.cpaIncreaseWarning
        ?? alertThresholds.cpaIncreaseWarning
        ?? DEFAULT_THRESHOLDS.cpaIncreaseWarning,

      minSpendForAlert: overrides?.minSpendForAlert
        ?? alertThresholds.minSpendForAlert
        ?? DEFAULT_THRESHOLDS.minSpendForAlert,

      reachPlateau: overrides?.reachPlateau
        ?? DEFAULT_THRESHOLDS.reachPlateau,
    }
  }

  /**
   * Detect fatigue for all ads in a client's account
   */
  async detectFatigue(
    clientId: string,
    adAccountId: string,
    thresholds?: Partial<FatigueThresholds>
  ): Promise<MetaFatigueSignal[]> {
    // Get client-specific targets and build thresholds
    const { targets, alertThresholds } = await this.getClientTargets(clientId)
    const t = this.buildThresholdsFromClientSettings(targets, alertThresholds, thresholds)

    const signals: MetaFatigueSignal[] = []
    const supabase = await this.getSupabase()

    // Get recent data (last 7 days)
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    // Get baseline data (previous 14 days for more stable baseline)
    const baselineEnd = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
    const baselineStart = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
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
      const current = this.calculateExtendedAverages(currentMetrics)

      // Skip if below spend threshold
      if (current.total_spend < t.minSpendForAlert) continue

      // Get baseline or use intelligent defaults
      const baseline = baselineMetrics
        ? this.calculateExtendedAverages(baselineMetrics)
        : this.createIntelligentBaseline(current)

      // Detect fatigue
      const signal = this.analyzeForFatigue(
        clientId,
        adAccountId,
        currentMetrics[0], // Use first record for entity info
        current,
        baseline,
        t,
        targets // Pass client targets for context
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
   * Get scaling recommendations for healthy ads
   */
  async getScalingRecommendations(
    clientId: string,
    adAccountId: string,
    thresholds?: Partial<FatigueThresholds>
  ): Promise<ScalingRecommendation[]> {
    // Get client-specific targets and build thresholds
    const { targets, alertThresholds } = await this.getClientTargets(clientId)
    const t = this.buildThresholdsFromClientSettings(targets, alertThresholds, thresholds)

    const recommendations: ScalingRecommendation[] = []
    const supabase = await this.getSupabase()

    // Get last 14 days data for trend analysis
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
    const midDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    // Fetch data
    const { data, error } = await supabase
      .from('meta_insights_daily')
      .select('*')
      .eq('client_id', clientId)
      .eq('ad_account_id', adAccountId)
      .in('entity_type', ['ad', 'adset'])
      .gte('date', startDate)
      .lte('date', endDate)

    if (error || !data) {
      console.error('Failed to fetch data for scaling:', error)
      return recommendations
    }

    const byEntity = this.groupByEntity(data as MetaInsightDaily[])

    for (const [entityId, metrics] of Object.entries(byEntity)) {
      const recentMetrics = metrics.filter(m => m.date >= midDate)
      const olderMetrics = metrics.filter(m => m.date < midDate)

      if (recentMetrics.length === 0) continue

      const recent = this.calculateExtendedAverages(recentMetrics)
      const older = olderMetrics.length > 0
        ? this.calculateExtendedAverages(olderMetrics)
        : recent

      // Skip low spend entities
      if (recent.total_spend < t.minSpendForAlert) continue

      const recommendation = this.analyzeForScaling(
        metrics[0],
        recent,
        older,
        t,
        targets // Pass client targets for ROAS/CPA thresholds
      )

      if (recommendation) {
        recommendations.push(recommendation)
      }
    }

    // Sort by confidence and potential impact
    return recommendations.sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 }
      const recOrder = { scale_up: 4, maintain: 2, scale_down: 3, pause: 1 }
      return (
        (confidenceOrder[b.confidence] * recOrder[b.recommendation]) -
        (confidenceOrder[a.confidence] * recOrder[a.recommendation])
      )
    })
  }

  /**
   * Analyze entity for scaling recommendation
   */
  private analyzeForScaling(
    entityInfo: MetaInsightDaily,
    recent: ExtendedMetrics,
    older: ExtendedMetrics,
    thresholds: FatigueThresholds,
    targets: MetaPerformanceTargets
  ): ScalingRecommendation | null {
    const reasons: string[] = []
    const actions: string[] = []

    // Use client-specific targets or sensible defaults
    const targetROAS = targets.targetROAS ?? 2.0
    const minROAS = targets.minROAS ?? 1.0
    const excellentROAS = targetROAS * 1.5 // 50% above target = excellent
    const targetCPA = targets.maxCPA ?? targets.targetCPA
    const optimalFrequency = targets.optimalFrequency ?? 2.0

    // Calculate trends
    const ctrTrend = older.avg_ctr > 0
      ? ((recent.avg_ctr - older.avg_ctr) / older.avg_ctr) * 100
      : 0
    const roasTrend = older.avg_roas > 0
      ? ((recent.avg_roas - older.avg_roas) / older.avg_roas) * 100
      : 0
    const cpaTrend = older.avg_cpa > 0
      ? ((recent.avg_cpa - older.avg_cpa) / older.avg_cpa) * 100
      : 0

    // Determine recommendation
    let recommendation: ScalingRecommendation['recommendation'] = 'maintain'
    let confidence: ScalingRecommendation['confidence'] = 'medium'

    // Check CPA against target (if set)
    const cpaOnTarget = !targetCPA || recent.avg_cpa <= targetCPA
    const cpaAboveTarget = targetCPA && recent.avg_cpa > targetCPA

    // SCALE UP criteria: Good ROAS (above target), stable/improving CTR, low frequency
    if (
      recent.avg_roas >= targetROAS &&
      recent.avg_frequency < thresholds.frequencyWarning &&
      roasTrend >= -10 &&
      ctrTrend >= -15 &&
      cpaOnTarget
    ) {
      recommendation = 'scale_up'
      reasons.push(`ROAS ${recent.avg_roas.toFixed(2)} boven target (${targetROAS})`)
      reasons.push(`Frequentie (${recent.avg_frequency.toFixed(1)}) geeft ruimte voor schaal`)
      if (targetCPA && recent.avg_cpa > 0) {
        reasons.push(`CPA €${recent.avg_cpa.toFixed(0)} onder max €${targetCPA}`)
      }

      if (recent.avg_roas >= excellentROAS && roasTrend >= 0) {
        confidence = 'high'
        actions.push('Verhoog budget met 20-30% per 3 dagen')
        actions.push('Overweeg lookalike audiences toe te voegen')
      } else {
        confidence = 'medium'
        actions.push('Verhoog budget met 10-15% per week')
        actions.push('Monitor CPA nauwlettend bij schaling')
      }

      if (recent.avg_frequency < optimalFrequency) {
        actions.push('Er is nog veel bereik potentieel - schaal gerust')
      }
    }
    // SCALE DOWN criteria: Declining metrics, CPA above target, or ROAS below target
    else if (
      (recent.avg_roas >= minROAS && recent.avg_roas < targetROAS) ||
      cpaAboveTarget ||
      (roasTrend < -15 || cpaTrend > 20)
    ) {
      recommendation = 'scale_down'
      if (recent.avg_roas < targetROAS) {
        reasons.push(`ROAS ${recent.avg_roas.toFixed(2)} onder target (${targetROAS})`)
      }
      if (roasTrend < -15) {
        reasons.push(`ROAS daalt (${roasTrend.toFixed(1)}% trend)`)
      }
      if (cpaAboveTarget && targetCPA) {
        reasons.push(`CPA €${recent.avg_cpa.toFixed(0)} boven max €${targetCPA}`)
      }
      if (cpaTrend > 20) {
        reasons.push(`CPA stijgt met ${cpaTrend.toFixed(1)}%`)
      }
      confidence = 'medium'
      actions.push('Verlaag budget met 20-30%')
      actions.push('Test nieuwe creatives voordat je verder schaalt')
      actions.push('Evalueer audience targeting')
    }
    // PAUSE criteria: Unprofitable (below minROAS)
    else if (recent.avg_roas < minROAS || (recent.avg_cpa > 0 && recent.total_conversions < 1)) {
      recommendation = 'pause'
      if (recent.avg_roas < minROAS) {
        reasons.push(`ROAS ${recent.avg_roas.toFixed(2)} onder minimum (${minROAS})`)
      }
      if (recent.total_conversions < 1 && recent.total_spend > 50) {
        reasons.push(`Geen conversies bij €${recent.total_spend.toFixed(0)} spend`)
      }
      confidence = recent.total_spend > 100 ? 'high' : 'medium'
      actions.push('Pauzeer deze ad/adset')
      actions.push('Analyseer waarom conversies uitblijven')
      actions.push('Test compleet nieuwe creative angle')
    }
    // MAINTAIN criteria: Stable performance
    else {
      recommendation = 'maintain'
      reasons.push('Prestaties zijn stabiel')
      confidence = 'low'
      actions.push('Houd huidige budget aan')
      actions.push('Test variaties van best presterende ads')
    }

    return {
      entity_id: entityInfo.entity_id,
      entity_name: entityInfo.entity_name,
      campaign_name: entityInfo.campaign_name,
      recommendation,
      confidence,
      reasons,
      suggested_actions: actions,
      metrics: {
        spend: recent.total_spend,
        roas: recent.avg_roas,
        cpa: recent.avg_cpa,
        frequency: recent.avg_frequency,
        ctr_trend: ctrTrend,
        roas_trend: roasTrend,
      },
    }
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
   * Calculate extended average metrics for a period
   */
  private calculateExtendedAverages(data: MetaInsightDaily[]): ExtendedMetrics {
    if (data.length === 0) {
      return {
        avg_frequency: 0,
        avg_ctr: 0,
        avg_cpc: 0,
        avg_roas: 0,
        avg_cpa: 0,
        total_spend: 0,
        total_conversions: 0,
        total_reach: 0,
        total_impressions: 0,
      }
    }

    const totals = data.reduce(
      (acc, row) => ({
        frequency: acc.frequency + (row.frequency || 0),
        ctr: acc.ctr + (row.ctr || 0),
        cpc: acc.cpc + (row.cpc || 0),
        spend: acc.spend + (row.spend || 0),
        conversions: acc.conversions + (row.conversions || 0),
        conversion_value: acc.conversion_value + (row.conversion_value || 0),
        reach: acc.reach + (row.reach || 0),
        impressions: acc.impressions + (row.impressions || 0),
        count: acc.count + 1,
      }),
      {
        frequency: 0,
        ctr: 0,
        cpc: 0,
        spend: 0,
        conversions: 0,
        conversion_value: 0,
        reach: 0,
        impressions: 0,
        count: 0,
      }
    )

    return {
      avg_frequency: totals.frequency / totals.count,
      avg_ctr: totals.ctr / totals.count,
      avg_cpc: totals.cpc / totals.count,
      avg_roas: totals.spend > 0 ? totals.conversion_value / totals.spend : 0,
      avg_cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
      total_spend: totals.spend,
      total_conversions: totals.conversions,
      total_reach: totals.reach,
      total_impressions: totals.impressions,
    }
  }

  /**
   * Create intelligent baseline when no historical data exists
   */
  private createIntelligentBaseline(current: ExtendedMetrics): ExtendedMetrics {
    return {
      avg_frequency: Math.max(1.5, current.avg_frequency * 0.7),
      avg_ctr: current.avg_ctr * 1.2, // Assume 20% higher baseline
      avg_cpc: current.avg_cpc * 0.85, // Assume 15% lower baseline
      avg_roas: current.avg_roas * 1.15, // Assume 15% higher baseline
      avg_cpa: current.avg_cpa * 0.85, // Assume 15% lower baseline
      total_spend: 0,
      total_conversions: 0,
      total_reach: 0,
      total_impressions: 0,
    }
  }

  /**
   * Analyze metrics for fatigue signals
   */
  private analyzeForFatigue(
    clientId: string,
    adAccountId: string,
    entityInfo: MetaInsightDaily,
    current: ExtendedMetrics,
    baseline: ExtendedMetrics,
    thresholds: FatigueThresholds,
    targets: MetaPerformanceTargets
  ): MetaFatigueSignal | null {
    const reasons: string[] = []
    const actions: string[] = []
    let fatigueScore = 0 // Accumulate fatigue indicators

    // Client targets for context in messages
    const maxFrequency = targets.maxFrequency ?? thresholds.frequencyWarning
    const targetCPA = targets.maxCPA ?? targets.targetCPA
    const minROAS = targets.minROAS ?? 1.0

    // Check frequency
    const frequencyHigh = current.avg_frequency > thresholds.frequencyWarning
    if (frequencyHigh) {
      fatigueScore += 2
    }

    // Check CTR drop
    const ctrDrop = baseline.avg_ctr > 0
      ? ((baseline.avg_ctr - current.avg_ctr) / baseline.avg_ctr) * 100
      : 0
    const ctrDropped = ctrDrop > thresholds.ctrDropWarning
    if (ctrDropped) {
      fatigueScore += 2
    }

    // Check CPC increase
    const cpcIncrease = baseline.avg_cpc > 0
      ? ((current.avg_cpc - baseline.avg_cpc) / baseline.avg_cpc) * 100
      : 0
    const cpcIncreased = cpcIncrease > thresholds.cpcIncreaseWarning
    if (cpcIncreased) {
      fatigueScore += 1
    }

    // Check ROAS drop (NEW)
    const roasDrop = baseline.avg_roas > 0
      ? ((baseline.avg_roas - current.avg_roas) / baseline.avg_roas) * 100
      : 0
    const roasDropped = roasDrop > thresholds.roasDropWarning
    if (roasDropped) {
      fatigueScore += 3 // ROAS is most important
    }

    // Check CPA increase (NEW)
    const cpaIncrease = baseline.avg_cpa > 0
      ? ((current.avg_cpa - baseline.avg_cpa) / baseline.avg_cpa) * 100
      : 0
    const cpaIncreased = cpaIncrease > thresholds.cpaIncreaseWarning
    if (cpaIncreased) {
      fatigueScore += 2
    }

    // Check reach plateau (NEW)
    const reachGrowth = baseline.total_reach > 0
      ? ((current.total_reach - baseline.total_reach) / baseline.total_reach) * 100
      : 100
    const reachPlateau = reachGrowth < thresholds.reachPlateau && frequencyHigh

    // Determine if fatigued (need at least 3 points or frequency + major issue)
    const isFatigued = fatigueScore >= 3 || (frequencyHigh && (roasDropped || cpaIncreased))

    if (!isFatigued) return null

    // Build detailed reasons and specific actions (with client targets)
    if (frequencyHigh) {
      reasons.push(
        `Frequency te hoog: ${current.avg_frequency.toFixed(1)}x (max: ${maxFrequency})`
      )
      if (current.avg_frequency > 4) {
        actions.push('🚨 Voeg minimaal 3-5 nieuwe creatives toe')
        actions.push('Vergroot doelgroep met 30-50% via lookalike expansion')
      } else {
        actions.push('Voeg 2-3 nieuwe creative variaties toe')
        actions.push('Test andere doelgroepsegmenten')
      }
    }

    if (ctrDropped) {
      reasons.push(
        `CTR gedaald met ${ctrDrop.toFixed(1)}% (nu: ${current.avg_ctr.toFixed(2)}%)`
      )
      actions.push('Test nieuwe hooks in de eerste 3 seconden')
      actions.push('A/B test verschillende thumbnails/afbeeldingen')
    }

    if (cpcIncreased) {
      reasons.push(
        `CPC gestegen met ${cpcIncrease.toFixed(1)}% naar €${current.avg_cpc.toFixed(2)}`
      )
      actions.push('Controleer auction competition in Ads Manager')
      actions.push('Overweeg andere plaatsingen (Stories, Reels)')
    }

    if (roasDropped) {
      const roasContext = minROAS > 1 ? ` (min: ${minROAS})` : ''
      reasons.push(
        `⚠️ ROAS gedaald met ${roasDrop.toFixed(1)}% (nu: ${current.avg_roas.toFixed(2)}${roasContext})`
      )
      actions.push('Verlaag budget tot ROAS stabiliseert')
      actions.push('Analyseer welke audiences nog wel converteren')
      actions.push('Check landing page performance')
    }

    if (cpaIncreased) {
      const cpaContext = targetCPA ? ` (max: €${targetCPA})` : ''
      reasons.push(
        `💰 CPA gestegen met ${cpaIncrease.toFixed(1)}% naar €${current.avg_cpa.toFixed(2)}${cpaContext}`
      )
      if (targetCPA && current.avg_cpa > targetCPA) {
        actions.push(`⚠️ CPA €${current.avg_cpa.toFixed(0)} boven max €${targetCPA}`)
      }
      actions.push('Evalueer of CPA nog binnen marge past')
      actions.push('Test value-based bidding strategie')
    }

    if (reachPlateau) {
      reasons.push('Bereik groeit niet meer - audience verzadigd')
      actions.push('Breid doelgroep uit met nieuwe interests')
      actions.push('Test broad targeting met algorithmic optimization')
    }

    // Determine severity based on impact and spend
    let severity: MetaFatigueSeverity = 'low'
    const spendWeight = Math.min(current.total_spend / 100, 2) // Higher spend = more critical

    if (fatigueScore >= 6 || (roasDropped && cpaIncreased)) {
      severity = 'critical'
    } else if (fatigueScore >= 4 || roasDropped) {
      severity = 'high'
    } else if (fatigueScore >= 3 || (frequencyHigh && ctrDropped)) {
      severity = 'medium'
    }

    // Increase severity for high spend
    if (spendWeight > 1 && severity !== 'critical') {
      const severities: MetaFatigueSeverity[] = ['low', 'medium', 'high', 'critical']
      const currentIndex = severities.indexOf(severity)
      severity = severities[Math.min(currentIndex + 1, 3)]
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
let cronDetectorInstance: MetaFatigueDetector | null = null

/**
 * Get fatigue detector for user-authenticated API routes
 */
export function getMetaFatigueDetector(): MetaFatigueDetector {
  if (!detectorInstance) {
    detectorInstance = new MetaFatigueDetector({ useServiceRole: false })
  }
  return detectorInstance
}

/**
 * Get fatigue detector for cron jobs (uses service role key, bypasses RLS)
 */
export function getMetaCronFatigueDetector(): MetaFatigueDetector {
  if (!cronDetectorInstance) {
    cronDetectorInstance = new MetaFatigueDetector({ useServiceRole: true })
  }
  return cronDetectorInstance
}
