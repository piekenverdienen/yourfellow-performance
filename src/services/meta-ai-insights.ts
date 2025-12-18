/**
 * Meta Ads AI Insights Service
 *
 * Generates AI-powered performance insights using Claude.
 * Provides executive summaries, problem detection, and recommendations.
 */

import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { getMetaAdsSyncService } from './meta-ads-sync'
import { getMetaFatigueDetector } from './meta-fatigue-detector'
import type { MetaAIInsight, MetaFatigueSignal } from '@/types/meta-ads'

// ============================================
// Types
// ============================================

interface InsightGenerationRequest {
  clientId: string
  adAccountId: string
  insightType: 'daily' | 'weekly' | 'monthly'
  periodStart: string
  periodEnd: string
}

interface PerformanceData {
  kpis: {
    total_spend: number
    total_impressions: number
    total_clicks: number
    total_conversions: number
    avg_ctr: number
    avg_cpc: number
    avg_roas: number
  }
  fatigueSignals: MetaFatigueSignal[]
  previousPeriodKpis?: {
    total_spend: number
    total_impressions: number
    total_clicks: number
    total_conversions: number
    avg_ctr: number
    avg_cpc: number
    avg_roas: number
  }
}

// ============================================
// AI Prompt Template
// ============================================

const SYSTEM_PROMPT = `Je bent een ervaren Performance Marketing Analyst die Meta Ads (Facebook & Instagram) analyseert.
Je genereert heldere, actionable insights voor marketing teams.

STIJL:
- Schrijf in het Nederlands
- Wees concreet en specifiek, geen vage algemeenheden
- Focus op wat belangrijk is, geen marketing fluff
- Geef praktische aanbevelingen die direct uitvoerbaar zijn

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug in exact dit formaat (geen markdown codeblocks):
{
  "executive_summary": "2-3 zinnen kernpunten",
  "top_performers": [
    {
      "entity_type": "ad|adset|campaign",
      "entity_id": "id",
      "entity_name": "naam",
      "metric": "welke metric opvalt",
      "value": 123,
      "insight": "waarom dit goed is"
    }
  ],
  "problems": [
    {
      "severity": "low|medium|high",
      "title": "korte titel",
      "description": "wat is het probleem",
      "affected_entities": ["namen"],
      "impact": "geschatte impact in EUR of %"
    }
  ],
  "opportunities": [
    {
      "title": "korte titel",
      "description": "wat is de kans",
      "potential_impact": "geschatte impact",
      "effort": "low|medium|high"
    }
  ],
  "recommended_actions": [
    {
      "priority": 1,
      "action": "concrete actie",
      "rationale": "waarom dit doen",
      "expected_outcome": "verwacht resultaat"
    }
  ]
}`

const USER_PROMPT_TEMPLATE = `Analyseer deze Meta Ads performance data en genereer insights.

PERIODE: {{period_start}} t/m {{period_end}} ({{insight_type}})

HUIDIGE PERIODE KPIs:
- Spend: €{{spend}}
- Impressies: {{impressions}}
- Clicks: {{clicks}}
- CTR: {{ctr}}%
- CPC: €{{cpc}}
- Conversies: {{conversions}}
- ROAS: {{roas}}

{{previous_comparison}}

FATIGUE ALERTS ({{fatigue_count}}):
{{fatigue_details}}

Genereer een complete analyse met:
1. Executive summary (max 3 zinnen)
2. Top performers (max 3)
3. Problemen (prioriteer op impact)
4. Kansen voor optimalisatie
5. Aanbevolen acties (max 5, geprioriteerd)

Focus op actionable insights, niet op het herhalen van cijfers.`

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
    const { clientId, adAccountId, insightType, periodStart, periodEnd } = request

    try {
      // Check for cached insight
      const cached = await this.getCachedInsight(
        clientId,
        adAccountId,
        insightType,
        periodStart,
        periodEnd
      )
      if (cached) return cached

      // Gather performance data
      const data = await this.gatherPerformanceData(
        clientId,
        adAccountId,
        periodStart,
        periodEnd
      )

      // Generate prompt
      const userPrompt = this.buildUserPrompt(
        insightType,
        periodStart,
        periodEnd,
        data
      )

      // Call Claude
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        temperature: 0.3,
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

      // Build insight object
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
   * Gather all performance data needed for analysis
   */
  private async gatherPerformanceData(
    clientId: string,
    adAccountId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<PerformanceData> {
    const syncService = getMetaAdsSyncService()
    const fatigueDetector = getMetaFatigueDetector()

    // Get current period KPIs
    const kpis = await syncService.getKPISummary(
      clientId,
      adAccountId,
      periodStart,
      periodEnd
    )

    // Get fatigue signals
    const fatigueSignals = await fatigueDetector.getActiveSignals(clientId)

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

    return {
      kpis,
      fatigueSignals,
      previousPeriodKpis,
    }
  }

  /**
   * Build user prompt with data
   */
  private buildUserPrompt(
    insightType: string,
    periodStart: string,
    periodEnd: string,
    data: PerformanceData
  ): string {
    let prompt = USER_PROMPT_TEMPLATE
      .replace('{{period_start}}', periodStart)
      .replace('{{period_end}}', periodEnd)
      .replace('{{insight_type}}', insightType)
      .replace('{{spend}}', data.kpis.total_spend.toFixed(2))
      .replace('{{impressions}}', data.kpis.total_impressions.toLocaleString())
      .replace('{{clicks}}', data.kpis.total_clicks.toLocaleString())
      .replace('{{ctr}}', data.kpis.avg_ctr.toFixed(2))
      .replace('{{cpc}}', data.kpis.avg_cpc.toFixed(2))
      .replace('{{conversions}}', data.kpis.total_conversions.toString())
      .replace('{{roas}}', data.kpis.avg_roas.toFixed(2))
      .replace('{{fatigue_count}}', data.fatigueSignals.length.toString())

    // Add previous period comparison
    if (data.previousPeriodKpis && data.previousPeriodKpis.total_spend > 0) {
      const spendChange = this.calculateChange(
        data.kpis.total_spend,
        data.previousPeriodKpis.total_spend
      )
      const convChange = this.calculateChange(
        data.kpis.total_conversions,
        data.previousPeriodKpis.total_conversions
      )
      const roasChange = this.calculateChange(
        data.kpis.avg_roas,
        data.previousPeriodKpis.avg_roas
      )

      prompt = prompt.replace(
        '{{previous_comparison}}',
        `VERGELIJKING MET VORIGE PERIODE:
- Spend: ${spendChange > 0 ? '+' : ''}${spendChange.toFixed(1)}%
- Conversies: ${convChange > 0 ? '+' : ''}${convChange.toFixed(1)}%
- ROAS: ${roasChange > 0 ? '+' : ''}${roasChange.toFixed(1)}%`
      )
    } else {
      prompt = prompt.replace('{{previous_comparison}}', 'Geen data van vorige periode beschikbaar.')
    }

    // Add fatigue details
    if (data.fatigueSignals.length > 0) {
      const fatigueDetails = data.fatigueSignals
        .slice(0, 5)
        .map(
          (s) =>
            `- ${s.entity_name} (${s.severity}): frequency ${s.current_frequency.toFixed(1)}, CTR drop ${Math.abs(s.ctr_change).toFixed(1)}%`
        )
        .join('\n')
      prompt = prompt.replace('{{fatigue_details}}', fatigueDetails)
    } else {
      prompt = prompt.replace('{{fatigue_details}}', 'Geen fatigue alerts gedetecteerd.')
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
