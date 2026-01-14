/**
 * Meta Ads AI Insights Service
 *
 * Generates AI-powered performance insights using Claude.
 * Provides executive summaries, problem detection, scaling recommendations,
 * and actionable next steps tailored for media buyers.
 *
 * Enhanced with:
 * - Client context (industry, target CPA, goals)
 * - Top & bottom performer analysis
 * - CPA-focused recommendations
 * - Scaling guidance based on fatigue signals
 */

import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { getMetaAdsSyncService } from './meta-ads-sync'
import { getMetaFatigueDetector, ScalingRecommendation } from './meta-fatigue-detector'
import type {
  MetaAIInsight,
  MetaFatigueSignal,
  MetaPerformanceRow,
  MetaPerformanceTargets,
  MetaClientContext as MetaClientContextType,
  MetaAdsSettings,
  MetaInsightDaily,
} from '@/types/meta-ads'
import type { AIContext, ContextSummary } from '@/lib/context'

// ============================================
// Types
// ============================================

interface InsightGenerationRequest {
  clientId: string
  adAccountId: string
  insightType: 'daily' | 'weekly' | 'monthly'
  periodStart: string
  periodEnd: string
  forceRegenerate?: boolean
}

interface ClientContext {
  name?: string
  // From MetaClientContext
  industry?: string
  businessModel?: string
  averageOrderValue?: number
  targetMargin?: number
  conversionWindow?: string
  seasonality?: string
  notes?: string
  // From MetaPerformanceTargets
  targetCPA?: number
  maxCPA?: number
  targetROAS?: number
  minROAS?: number
  targetCTR?: number
  dailyBudget?: number
  monthlyBudget?: number
  maxFrequency?: number
}

interface EnhancedPerformanceData {
  kpis: {
    total_spend: number
    total_impressions: number
    total_clicks: number
    total_conversions: number
    total_revenue: number
    avg_ctr: number
    avg_cpc: number
    avg_cpa: number
    avg_roas: number
    avg_frequency: number
  }
  previousPeriodKpis?: {
    total_spend: number
    total_impressions: number
    total_clicks: number
    total_conversions: number
    avg_ctr: number
    avg_cpc: number
    avg_cpa: number
    avg_roas: number
  }
  topPerformers: {
    byROAS: MetaInsightDaily[]
    byCPA: MetaInsightDaily[]
    bySpend: MetaInsightDaily[]
  }
  bottomPerformers: {
    byROAS: MetaInsightDaily[]
    byCPA: MetaInsightDaily[]
  }
  fatigueSignals: MetaFatigueSignal[]
  scalingRecommendations: ScalingRecommendation[]
  clientContext: ClientContext
  // Full AI Context from client intake (if available)
  aiContext?: AIContext
  aiContextSummary?: ContextSummary
}

// ============================================
// AI Prompt Template - Media Buyer Focused
// ============================================

const SYSTEM_PROMPT = `Je bent een senior Performance Marketing Strategist met 10+ jaar Meta Ads ervaring.
Je analyseert data voor professionele media buyers en geeft strategisch advies op hoog niveau.

EXPERTISE:
- Diepgaande kennis van Meta algoritmes en auction dynamics
- Ervaring met schalen van €10K-€500K/maand accounts
- Focus op CPA optimalisatie en winstgevendheid
- Begrip van creative fatigue en audience saturation

COMMUNICATIESTIJL:
- Direct en to-the-point, geen marketing fluff
- Concreet met cijfers en percentages
- Prioriteer op impact: wat levert het meeste op?
- Geef specifieke acties, niet vage adviezen
- Schrijf in het Nederlands

BELANGRIJKE CONTEXT:
- Media buyers willen weten: "Wat moet ik NU doen om resultaten te verbeteren?"
- Focus op CPA en ROAS, niet alleen volume metrics
- Benoem risico's EN kansen
- Geef schaal advies: opschalen, afschalen of pauzeren

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug in exact dit formaat (geen markdown codeblocks):
{
  "executive_summary": "3-4 zinnen met kernboodschap. Begin met belangrijkste inzicht.",
  "health_score": 1-10,
  "health_assessment": "kort oordeel over account health",
  "top_performers": [
    {
      "entity_type": "ad|adset|campaign",
      "entity_id": "id",
      "entity_name": "naam",
      "metric": "ROAS|CPA|CTR",
      "value": 123,
      "insight": "waarom dit goed is en wat je ermee kunt",
      "scaling_potential": "high|medium|low"
    }
  ],
  "problems": [
    {
      "severity": "critical|high|medium|low",
      "title": "korte titel",
      "description": "wat is het probleem en waarom is het urgent",
      "affected_entities": ["namen"],
      "estimated_waste": "€X per week/maand",
      "root_cause": "mogelijke oorzaak"
    }
  ],
  "scaling_advice": {
    "scale_up": ["specifieke ads/adsets die je kunt opschalen + waarom"],
    "scale_down": ["specifieke ads/adsets die je moet afschalen + waarom"],
    "pause": ["specifieke ads/adsets die je moet pauzeren + waarom"],
    "test_new": ["wat je zou moeten testen als vervanger"]
  },
  "opportunities": [
    {
      "title": "korte titel",
      "description": "wat is de kans",
      "potential_impact": "€X extra omzet of X% CPA reductie",
      "effort": "low|medium|high",
      "timeframe": "direct|deze week|volgende sprint"
    }
  ],
  "recommended_actions": [
    {
      "priority": 1,
      "action": "concrete actie (specifiek genoeg om direct uit te voeren)",
      "rationale": "waarom dit prioriteit heeft",
      "expected_outcome": "verwacht resultaat in € of %",
      "deadline": "vandaag|morgen|deze week"
    }
  ],
  "cpa_analysis": {
    "current_cpa": 123,
    "target_cpa": 123,
    "status": "on_track|at_risk|over_target",
    "trend": "improving|stable|declining",
    "recommendation": "specifiek advies"
  },
  "budget_recommendation": {
    "current_daily": 123,
    "suggested_daily": 123,
    "reasoning": "waarom deze aanpassing"
  }
}`

const USER_PROMPT_TEMPLATE = `Analyseer deze Meta Ads performance en geef strategisch advies.

===== CLIENT CONTEXT =====
{{client_context}}

===== PERIODE =====
{{period_start}} t/m {{period_end}} ({{insight_type}} rapport)

===== HUIDIGE KPIs =====
- Spend: €{{spend}}
- Conversies: {{conversions}} (omzet: €{{revenue}})
- CPA: €{{cpa}}
- ROAS: {{roas}}
- CTR: {{ctr}}%
- CPC: €{{cpc}}
- Frequentie: {{frequency}}

===== VERGELIJKING VORIGE PERIODE =====
{{previous_comparison}}

===== TOP PERFORMERS (ROAS) =====
{{top_by_roas}}

===== BOTTOM PERFORMERS (CPA) =====
{{bottom_by_cpa}}

===== FATIGUE ALERTS ({{fatigue_count}}) =====
{{fatigue_details}}

===== SCHAAL AANBEVELINGEN =====
{{scaling_recommendations}}

===== OPDRACHT =====
Genereer een complete analyse met focus op:

1. Executive Summary
   - Begin met de belangrijkste conclusie
   - Benoem direct de #1 actie voor vandaag

2. Health Score (1-10)
   - Baseer op CPA vs target, ROAS trend, fatigue niveau

3. Top Performers
   - Welke ads verdienen meer budget?
   - Schat schaal potentieel in

4. Problemen
   - Prioriteer op €-impact
   - Wees specifiek over oorzaken

5. Schaal Advies
   - Wat opschalen? (budget +20-50%)
   - Wat afschalen? (budget -30-50%)
   - Wat pauzeren?

6. CPA Analyse
   - Is CPA on track voor target?
   - Welke ads trekken CPA omhoog?

7. Top 5 Acties
   - Specifiek en direct uitvoerbaar
   - Met verwachte impact en deadline

Wees kritisch. Als iets niet goed gaat, zeg dat direct. Media buyers willen eerlijk advies.`

// ============================================
// Meta AI Insights Service
// ============================================

export class MetaAIInsightsService {
  private anthropic: Anthropic
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required')
    }
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  /**
   * Generate AI insights for a period
   */
  async generateInsights(
    request: InsightGenerationRequest
  ): Promise<MetaAIInsight | null> {
    const { clientId, adAccountId, insightType, periodStart, periodEnd, forceRegenerate } = request

    try {
      // Check for cached insight (skip if forceRegenerate)
      if (!forceRegenerate) {
        const cached = await this.getCachedInsight(
          clientId,
          adAccountId,
          insightType,
          periodStart,
          periodEnd
        )
        if (cached) return cached
      }

      // Gather comprehensive performance data
      const data = await this.gatherEnhancedPerformanceData(
        clientId,
        adAccountId,
        periodStart,
        periodEnd
      )

      // Generate prompt
      const userPrompt = this.buildEnhancedUserPrompt(
        insightType,
        periodStart,
        periodEnd,
        data
      )

      // Call Claude with enhanced model
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        temperature: 0.2, // Lower for more consistent output
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      // Extract content
      const textContent = response.content.find((block) => block.type === 'text')
      let content = textContent ? textContent.text : ''

      // Strip markdown if present
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      // Parse JSON response
      const aiResponse = JSON.parse(content)

      // Build insight object with enhanced data
      const insight: MetaAIInsight = {
        client_id: clientId,
        ad_account_id: adAccountId,
        insight_type: insightType,
        period_start: periodStart,
        period_end: periodEnd,
        executive_summary: aiResponse.executive_summary || '',
        top_performers: aiResponse.top_performers || [],
        problems: aiResponse.problems || [],
        opportunities: aiResponse.opportunities || [],
        recommended_actions: aiResponse.recommended_actions || [],
        metrics_summary: {
          total_spend: data.kpis.total_spend,
          total_impressions: data.kpis.total_impressions,
          total_clicks: data.kpis.total_clicks,
          total_conversions: data.kpis.total_conversions,
          avg_ctr: data.kpis.avg_ctr,
          avg_cpc: data.kpis.avg_cpc,
          avg_roas: data.kpis.avg_roas,
          spend_vs_previous: data.previousPeriodKpis
            ? this.calculateChange(data.kpis.total_spend, data.previousPeriodKpis.total_spend)
            : 0,
          conversions_vs_previous: data.previousPeriodKpis
            ? this.calculateChange(data.kpis.total_conversions, data.previousPeriodKpis.total_conversions)
            : 0,
        },
        generated_at: new Date().toISOString(),
      }

      // Store in database
      await this.storeInsight(insight)

      return insight
    } catch (error) {
      console.error('Failed to generate AI insights:', error)
      return null
    }
  }

  /**
   * Get cached insight if exists
   */
  private async getCachedInsight(
    clientId: string,
    adAccountId: string,
    insightType: string,
    periodStart: string,
    periodEnd: string
  ): Promise<MetaAIInsight | null> {
    const supabase = await this.getSupabase()

    const { data } = await supabase
      .from('meta_ai_insights')
      .select('*')
      .eq('client_id', clientId)
      .eq('ad_account_id', adAccountId)
      .eq('insight_type', insightType)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .single()

    return data as MetaAIInsight | null
  }

  /**
   * Gather comprehensive performance data for analysis
   */
  private async gatherEnhancedPerformanceData(
    clientId: string,
    adAccountId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<EnhancedPerformanceData> {
    const supabase = await this.getSupabase()
    const syncService = getMetaAdsSyncService()
    const fatigueDetector = getMetaFatigueDetector()

    // Get client context and performance targets
    const { data: clientData } = await supabase
      .from('clients')
      .select('name, settings')
      .eq('id', clientId)
      .single()

    const metaSettings = (clientData?.settings?.meta || {}) as MetaAdsSettings
    const targets = metaSettings.targets || {}
    const context = metaSettings.context || {}

    const clientContext: ClientContext = {
      name: clientData?.name,
      // From MetaClientContext
      industry: context.industry,
      businessModel: context.businessModel,
      averageOrderValue: context.averageOrderValue,
      targetMargin: context.targetMargin,
      conversionWindow: context.conversionWindow,
      seasonality: context.seasonality,
      notes: context.notes,
      // From MetaPerformanceTargets
      targetCPA: targets.targetCPA,
      maxCPA: targets.maxCPA,
      targetROAS: targets.targetROAS,
      minROAS: targets.minROAS,
      targetCTR: targets.targetCTR,
      dailyBudget: targets.dailyBudget,
      monthlyBudget: targets.monthlyBudget,
      maxFrequency: targets.maxFrequency,
    }

    // Get current period KPIs
    const kpis = await syncService.getKPISummary(
      clientId,
      adAccountId,
      periodStart,
      periodEnd
    )

    // Get performance data for top/bottom analysis
    const { data: performanceRows } = await syncService.getPerformanceData(
      clientId,
      adAccountId,
      'ad',
      periodStart,
      periodEnd,
      { pageSize: 100, sortBy: 'spend', sortOrder: 'desc' }
    )

    // Sort and filter for top/bottom performers
    const withConversions = performanceRows.filter(r => r.conversions > 0)
    const topByROAS = [...withConversions]
      .sort((a, b) => b.roas - a.roas)
      .slice(0, 5)
    const topByCPA = [...withConversions]
      .filter(r => r.spend > 10)
      .sort((a, b) => {
        const cpA = a.conversions > 0 ? a.spend / a.conversions : Infinity
        const cpB = b.conversions > 0 ? b.spend / b.conversions : Infinity
        return cpA - cpB
      })
      .slice(0, 5)
    const topBySpend = [...performanceRows]
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5)
    const bottomByROAS = [...performanceRows]
      .filter(r => r.spend > 20)
      .sort((a, b) => a.roas - b.roas)
      .slice(0, 5)
    const bottomByCPA = [...performanceRows]
      .filter(r => r.spend > 20 && r.conversions > 0)
      .sort((a, b) => {
        const cpA = a.conversions > 0 ? a.spend / a.conversions : Infinity
        const cpB = b.conversions > 0 ? b.spend / b.conversions : Infinity
        return cpB - cpA
      })
      .slice(0, 5)

    // Get fatigue signals
    const fatigueSignals = await fatigueDetector.getActiveSignals(clientId)

    // Get scaling recommendations
    const scalingRecommendations = await fatigueDetector.getScalingRecommendations(
      clientId,
      adAccountId
    )

    // Calculate previous period dates
    const periodDays = Math.ceil(
      (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) /
        (1000 * 60 * 60 * 24)
    )
    const prevEnd = new Date(new Date(periodStart).getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
    const prevStart = new Date(
      new Date(prevEnd).getTime() - periodDays * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split('T')[0]

    // Get previous period KPIs
    const previousPeriodKpis = await syncService.getKPISummary(
      clientId,
      adAccountId,
      prevStart,
      prevEnd
    )

    // Get full AI Context from client intake (if available)
    const { data: aiContextData } = await supabase
      .from('client_ai_context_active')
      .select('current_context_json, current_summary_json')
      .eq('client_id', clientId)
      .single()

    const aiContext = aiContextData?.current_context_json as AIContext | undefined
    const aiContextSummary = aiContextData?.current_summary_json as ContextSummary | undefined

    // Enrich client context with AI Context data if manual settings are missing
    if (aiContext?.observations) {
      // Use AI Context industry if not manually set
      if (!clientContext.industry && aiContext.observations.industry) {
        clientContext.industry = aiContext.observations.industry
      }
      // Calculate average order value from price range if not set
      if (!clientContext.averageOrderValue && aiContext.economics?.priceRange) {
        const range = aiContext.economics.priceRange
        if (range.min && range.max) {
          clientContext.averageOrderValue = (range.min + range.max) / 2
        }
      }
      // Use AI Context seasonality if not manually set
      if (!clientContext.seasonality && aiContext.economics?.seasonality && aiContext.economics.seasonality.length > 0) {
        const peakPeriods = aiContext.economics.seasonality
          .filter(s => s.impact === 'peak')
          .map(s => s.period)
        if (peakPeriods.length > 0) {
          clientContext.seasonality = `Piek: ${peakPeriods.join(', ')}`
        }
      }
    }

    // Calculate enhanced KPIs
    const avgCPA = kpis.total_conversions > 0
      ? kpis.total_spend / kpis.total_conversions
      : 0
    const prevAvgCPA = previousPeriodKpis && previousPeriodKpis.total_conversions > 0
      ? previousPeriodKpis.total_spend / previousPeriodKpis.total_conversions
      : 0

    return {
      kpis: {
        total_spend: kpis.total_spend,
        total_impressions: kpis.total_impressions,
        total_clicks: kpis.total_clicks,
        total_conversions: kpis.total_conversions,
        total_revenue: kpis.total_conversions * 50, // Estimate based on conversions
        avg_ctr: kpis.avg_ctr,
        avg_cpc: kpis.avg_cpc,
        avg_cpa: avgCPA,
        avg_roas: kpis.avg_roas,
        avg_frequency: 0, // Not available in KPI summary
      },
      previousPeriodKpis: previousPeriodKpis ? {
        total_spend: previousPeriodKpis.total_spend,
        total_impressions: previousPeriodKpis.total_impressions,
        total_clicks: previousPeriodKpis.total_clicks,
        total_conversions: previousPeriodKpis.total_conversions,
        avg_ctr: previousPeriodKpis.avg_ctr,
        avg_cpc: previousPeriodKpis.avg_cpc,
        avg_cpa: prevAvgCPA,
        avg_roas: previousPeriodKpis.avg_roas,
      } : undefined,
      topPerformers: {
        byROAS: topByROAS,
        byCPA: topByCPA,
        bySpend: topBySpend,
      },
      bottomPerformers: {
        byROAS: bottomByROAS,
        byCPA: bottomByCPA,
      },
      fatigueSignals,
      scalingRecommendations,
      clientContext,
      aiContext,
      aiContextSummary,
    }
  }

  /**
   * Build enhanced user prompt with comprehensive data
   */
  private buildEnhancedUserPrompt(
    insightType: string,
    periodStart: string,
    periodEnd: string,
    data: EnhancedPerformanceData
  ): string {
    let prompt = USER_PROMPT_TEMPLATE
      .replace('{{period_start}}', periodStart)
      .replace('{{period_end}}', periodEnd)
      .replace('{{insight_type}}', insightType)
      .replace('{{spend}}', data.kpis.total_spend.toFixed(2))
      .replace('{{conversions}}', data.kpis.total_conversions.toString())
      .replace('{{revenue}}', data.kpis.total_revenue.toFixed(2))
      .replace('{{cpa}}', data.kpis.avg_cpa.toFixed(2))
      .replace('{{roas}}', data.kpis.avg_roas.toFixed(2))
      .replace('{{ctr}}', data.kpis.avg_ctr.toFixed(2))
      .replace('{{cpc}}', data.kpis.avg_cpc.toFixed(2))
      .replace('{{frequency}}', data.kpis.avg_frequency.toFixed(1))
      .replace('{{fatigue_count}}', data.fatigueSignals.length.toString())

    // Add client context with all available targets
    const contextLines: string[] = []
    const ctx = data.clientContext

    // Basic info
    if (ctx.name) contextLines.push(`Klant: ${ctx.name}`)
    if (ctx.industry) contextLines.push(`Industrie: ${ctx.industry}`)
    if (ctx.businessModel) contextLines.push(`Business model: ${ctx.businessModel}`)

    // Performance targets - CRITICAL for AI analysis
    contextLines.push('\n--- PERFORMANCE TARGETS ---')
    if (ctx.targetCPA) contextLines.push(`Target CPA: €${ctx.targetCPA}`)
    if (ctx.maxCPA) contextLines.push(`Max CPA (alert threshold): €${ctx.maxCPA}`)
    if (ctx.targetROAS) contextLines.push(`Target ROAS: ${ctx.targetROAS}`)
    if (ctx.minROAS) contextLines.push(`Min ROAS (alert threshold): ${ctx.minROAS}`)
    if (ctx.targetCTR) contextLines.push(`Target CTR: ${ctx.targetCTR}%`)
    if (ctx.maxFrequency) contextLines.push(`Max Frequency: ${ctx.maxFrequency}`)

    // Budget targets
    if (ctx.dailyBudget || ctx.monthlyBudget) {
      contextLines.push('\n--- BUDGET ---')
      if (ctx.dailyBudget) contextLines.push(`Dagbudget: €${ctx.dailyBudget}`)
      if (ctx.monthlyBudget) contextLines.push(`Maandbudget: €${ctx.monthlyBudget}`)
    }

    // Business context
    if (ctx.averageOrderValue || ctx.targetMargin || ctx.conversionWindow || ctx.seasonality) {
      contextLines.push('\n--- BUSINESS CONTEXT ---')
      if (ctx.averageOrderValue) contextLines.push(`Gem. orderwaarde: €${ctx.averageOrderValue}`)
      if (ctx.targetMargin) contextLines.push(`Doelmarge: ${ctx.targetMargin}%`)
      if (ctx.conversionWindow) contextLines.push(`Conversion window: ${ctx.conversionWindow}`)
      if (ctx.seasonality) contextLines.push(`Seizoenspatroon: ${ctx.seasonality}`)
    }

    // Notes
    if (ctx.notes) {
      contextLines.push('\n--- NOTITIES ---')
      contextLines.push(ctx.notes)
    }

    // Add rich AI Context if available (from client intake)
    if (data.aiContext) {
      const ai = data.aiContext
      contextLines.push('\n--- AI CONTEXT (automatisch gegenereerd) ---')

      // Summary one-liner
      if (data.aiContextSummary?.oneLiner) {
        contextLines.push(`Samenvatting: ${data.aiContextSummary.oneLiner}`)
      }

      // Target audience info for ad messaging insights
      if (ai.observations?.targetAudience) {
        const ta = ai.observations.targetAudience
        if (typeof ta === 'object') {
          if (ta.primary) contextLines.push(`Primaire doelgroep: ${ta.primary}`)
          if (ta.psychographics?.painPoints?.length) {
            contextLines.push(`Pijnpunten doelgroep: ${ta.psychographics.painPoints.slice(0, 3).join(', ')}`)
          }
        } else if (typeof ta === 'string') {
          contextLines.push(`Doelgroep: ${ta}`)
        }
      }

      // Products/services for relevance
      if (ai.observations?.products?.length) {
        const productNames = ai.observations.products.slice(0, 5).map(p => p.name).join(', ')
        contextLines.push(`Producten/diensten: ${productNames}`)
      }

      // USPs for messaging insights
      if (ai.observations?.usps?.length) {
        const usps = ai.observations.usps.slice(0, 3).map(u => u.text).join('; ')
        contextLines.push(`USPs: ${usps}`)
      }

      // Brand voice for communication style
      if (ai.observations?.brandVoice) {
        const bv = ai.observations.brandVoice
        if (bv.toneOfVoice) contextLines.push(`Tone of voice: ${bv.toneOfVoice}`)
        if (bv.personality?.length) contextLines.push(`Brand persoonlijkheid: ${bv.personality.join(', ')}`)
      }

      // Competitors for competitive context
      if (ai.competitors?.direct?.length) {
        const compNames = ai.competitors.direct.slice(0, 3).map(c => c.name).join(', ')
        contextLines.push(`Directe concurrenten: ${compNames}`)
      }

      // Marketing goals
      if (ai.goals?.marketing) {
        const goals = []
        if (ai.goals.marketing.awareness) goals.push('Awareness')
        if (ai.goals.marketing.leads) goals.push('Leads')
        if (ai.goals.marketing.sales) goals.push('Sales')
        if (ai.goals.marketing.retention) goals.push('Retention')
        if (goals.length > 0) {
          contextLines.push(`Marketing focus: ${goals.join(', ')}`)
        }
      }
    }

    prompt = prompt.replace(
      '{{client_context}}',
      contextLines.length > 1 ? contextLines.join('\n') : 'Geen specifieke client context beschikbaar. Gebruik standaard benchmark waardes.'
    )

    // Add previous period comparison
    if (data.previousPeriodKpis && data.previousPeriodKpis.total_spend > 0) {
      const spendChange = this.calculateChange(data.kpis.total_spend, data.previousPeriodKpis.total_spend)
      const convChange = this.calculateChange(data.kpis.total_conversions, data.previousPeriodKpis.total_conversions)
      const roasChange = this.calculateChange(data.kpis.avg_roas, data.previousPeriodKpis.avg_roas)
      const cpaChange = data.previousPeriodKpis.avg_cpa > 0
        ? this.calculateChange(data.kpis.avg_cpa, data.previousPeriodKpis.avg_cpa)
        : 0

      prompt = prompt.replace(
        '{{previous_comparison}}',
        `- Spend: ${spendChange > 0 ? '+' : ''}${spendChange.toFixed(1)}%
- Conversies: ${convChange > 0 ? '+' : ''}${convChange.toFixed(1)}%
- ROAS: ${roasChange > 0 ? '+' : ''}${roasChange.toFixed(1)}%
- CPA: ${cpaChange > 0 ? '+' : ''}${cpaChange.toFixed(1)}% ${cpaChange > 0 ? '(verslechterd)' : '(verbeterd)'}`
      )
    } else {
      prompt = prompt.replace('{{previous_comparison}}', 'Geen data van vorige periode beschikbaar.')
    }

    // Add top performers by ROAS
    if (data.topPerformers.byROAS.length > 0) {
      const topROAS = data.topPerformers.byROAS
        .map(r => `- ${r.entity_name}: ROAS ${r.roas.toFixed(2)}, €${r.spend.toFixed(0)} spend, ${r.conversions} conv`)
        .join('\n')
      prompt = prompt.replace('{{top_by_roas}}', topROAS)
    } else {
      prompt = prompt.replace('{{top_by_roas}}', 'Geen ads met conversies gevonden.')
    }

    // Add bottom performers by CPA
    if (data.bottomPerformers.byCPA.length > 0) {
      const bottomCPA = data.bottomPerformers.byCPA
        .map(r => {
          const cpa = r.conversions > 0 ? r.spend / r.conversions : 0
          return `- ${r.entity_name}: CPA €${cpa.toFixed(2)}, ROAS ${r.roas.toFixed(2)}, €${r.spend.toFixed(0)} spend`
        })
        .join('\n')
      prompt = prompt.replace('{{bottom_by_cpa}}', bottomCPA)
    } else {
      prompt = prompt.replace('{{bottom_by_cpa}}', 'Geen underperformers geïdentificeerd.')
    }

    // Add fatigue details
    if (data.fatigueSignals.length > 0) {
      const fatigueDetails = data.fatigueSignals
        .slice(0, 8)
        .map(s => {
          const reasons = s.reasons.slice(0, 2).join(', ')
          return `- ${s.entity_name} [${s.severity.toUpperCase()}]: ${reasons}`
        })
        .join('\n')
      prompt = prompt.replace('{{fatigue_details}}', fatigueDetails)
    } else {
      prompt = prompt.replace('{{fatigue_details}}', 'Geen fatigue alerts - ads presteren stabiel.')
    }

    // Add scaling recommendations
    if (data.scalingRecommendations.length > 0) {
      const scaleUp = data.scalingRecommendations
        .filter(r => r.recommendation === 'scale_up')
        .slice(0, 3)
        .map(r => `- ${r.entity_name}: ROAS ${r.metrics.roas.toFixed(2)}, freq ${r.metrics.frequency.toFixed(1)} [${r.confidence}]`)
      const scaleDown = data.scalingRecommendations
        .filter(r => r.recommendation === 'scale_down' || r.recommendation === 'pause')
        .slice(0, 3)
        .map(r => `- ${r.entity_name}: ROAS ${r.metrics.roas.toFixed(2)}, ${r.recommendation} [${r.confidence}]`)

      const scalingText = [
        scaleUp.length > 0 ? `OPSCHALEN:\n${scaleUp.join('\n')}` : '',
        scaleDown.length > 0 ? `AFSCHALEN/PAUZEREN:\n${scaleDown.join('\n')}` : '',
      ].filter(Boolean).join('\n\n')

      prompt = prompt.replace('{{scaling_recommendations}}', scalingText || 'Geen specifieke schaal aanbevelingen.')
    } else {
      prompt = prompt.replace('{{scaling_recommendations}}', 'Nog geen schaal analyse uitgevoerd.')
    }

    return prompt
  }

  /**
   * Calculate percentage change
   */
  private calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  /**
   * Store insight in database
   */
  private async storeInsight(insight: MetaAIInsight): Promise<void> {
    const supabase = await this.getSupabase()

    await supabase.from('meta_ai_insights').upsert(insight, {
      onConflict: 'client_id,ad_account_id,insight_type,period_start,period_end',
    })
  }

  /**
   * Get latest insights for a client
   */
  async getLatestInsights(
    clientId: string,
    limit = 5
  ): Promise<MetaAIInsight[]> {
    const supabase = await this.getSupabase()

    const { data } = await supabase
      .from('meta_ai_insights')
      .select('*')
      .eq('client_id', clientId)
      .order('generated_at', { ascending: false })
      .limit(limit)

    return (data || []) as MetaAIInsight[]
  }
}

// ============================================
// Singleton Export
// ============================================

let insightsServiceInstance: MetaAIInsightsService | null = null

export function getMetaAIInsightsService(): MetaAIInsightsService {
  if (!insightsServiceInstance) {
    insightsServiceInstance = new MetaAIInsightsService()
  }
  return insightsServiceInstance
}
