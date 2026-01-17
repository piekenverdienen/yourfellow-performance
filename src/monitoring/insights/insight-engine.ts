import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';
import type { InsightScope, InsightType, InsightImpact, InsightConfidence, InsightEffort, InsightUrgency, Insight } from '@/types';

export interface InsightRule {
  id: string;
  name: string;
  description: string;
  type: InsightType;
  evaluate: (data: InsightData) => InsightResult | null;
}

export interface InsightData {
  // Account-level metrics
  account: {
    conversions: number;
    previousConversions: number;
    cost: number;
    previousCost: number;
    cpa: number;
    previousCpa: number;
    roas: number;
    previousRoas: number;
    impressionShareLostBudget: number; // percentage
    impressionShareLostRank: number; // percentage
  };
  // Campaign-level data
  campaigns: CampaignData[];
  // Client info
  clientId: string;
  clientName: string;
  currency: string;
}

export interface CampaignData {
  id: string;
  name: string;
  type: string;
  status: string;
  conversions: number;
  previousConversions: number;
  cost: number;
  previousCost: number;
  impressionShareLostBudget: number;
  budgetLimited: boolean;
  budget: number;
  recommendedBudget: number | null;
}

export interface InsightResult {
  ruleId: string;
  scope: InsightScope;
  scopeId?: string;
  scopeName?: string;
  type: InsightType;
  impact: InsightImpact;
  confidence: InsightConfidence;
  // Prioritization fields for media buyer workflow
  effort: InsightEffort;       // How much work to fix: low (quick), medium (some work), high (significant)
  urgency: InsightUrgency;     // Time-sensitivity: low (stable), medium (trending), high (accelerating)
  summary: string;
  explanation: string;
  recommendation: string;
  dataSnapshot: Record<string, unknown>;
}

export interface InsightEngineConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  logger: Logger;
}

export interface InsightCreationResult {
  success: boolean;
  insightId?: string;
  skipped?: boolean;
  skipReason?: 'duplicate' | 'already_exists';
  error?: string;
}

/**
 * Weight mappings for priority score calculation
 * Higher number = more important/urgent/difficult
 */
const IMPACT_WEIGHTS: Record<InsightImpact, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const URGENCY_WEIGHTS: Record<InsightUrgency, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const EFFORT_WEIGHTS: Record<InsightEffort, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * Rule-based Insights Engine
 *
 * This engine evaluates deterministic rules against account/campaign data
 * to generate actionable optimization insights.
 *
 * Key principles:
 * - No ML/black box - all rules are explicit and explainable
 * - Each insight has a clear action
 * - Confidence is based on data quality, not AI certainty
 * - Insights auto-resolve when conditions are no longer met
 *
 * Priority scoring (Phase 2):
 * - priority_score = (impact_weight * urgency_weight) / effort_weight
 * - Range: 0.33 (low/low/high) to 9.0 (high/high/low)
 * - Media buyers should work on highest priority_score first
 */
export class InsightEngine {
  private supabase: SupabaseClient;
  private logger: Logger;
  private rules: InsightRule[] = [];

  constructor(config: InsightEngineConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    this.logger = config.logger;
    this.registerDefaultRules();
  }

  /**
   * Calculate priority score from impact, urgency, and effort
   *
   * Formula: (impact * urgency) / effort
   *
   * This gives us a range from 0.33 to 9.0:
   * - 9.0: high impact, high urgency, low effort (do this NOW)
   * - 0.33: low impact, low urgency, high effort (maybe never)
   *
   * @example
   * - high impact + high urgency + low effort = 9.0 (critical quick win)
   * - high impact + low urgency + high effort = 1.0 (important but can wait)
   * - low impact + low urgency + low effort = 1.0 (small quick win)
   */
  private calculatePriorityScore(
    impact: InsightImpact,
    urgency: InsightUrgency,
    effort: InsightEffort
  ): number {
    const impactWeight = IMPACT_WEIGHTS[impact];
    const urgencyWeight = URGENCY_WEIGHTS[urgency];
    const effortWeight = EFFORT_WEIGHTS[effort];

    return (impactWeight * urgencyWeight) / effortWeight;
  }

  /**
   * Register the default insight rules
   */
  private registerDefaultRules(): void {
    // Rule 1: CPA increase with budget limitation
    this.rules.push({
      id: 'cpa_increase_with_budget_limit',
      name: 'CPA stijging bij budget beperking',
      description: 'Detecteert wanneer CPA stijgt terwijl budget de levering beperkt',
      type: 'budget',
      evaluate: (data: InsightData): InsightResult | null => {
        const cpaChange = data.account.previousCpa > 0
          ? ((data.account.cpa - data.account.previousCpa) / data.account.previousCpa) * 100
          : 0;

        // CPA increased by 25%+ AND budget is limiting (>15% IS lost to budget)
        if (cpaChange >= 25 && data.account.impressionShareLostBudget > 15) {
          return {
            ruleId: 'cpa_increase_with_budget_limit',
            scope: 'account',
            type: 'budget',
            impact: 'high',
            confidence: 'high',
            effort: 'low',       // Budget increase is a quick change
            urgency: 'high',     // CPA trending wrong direction
            summary: `CPA +${cpaChange.toFixed(0)}% terwijl budget beperkt`,
            explanation: `De CPA is gestegen met ${cpaChange.toFixed(0)}% t.o.v. de vorige periode. ` +
              `Tegelijkertijd wordt ${data.account.impressionShareLostBudget.toFixed(0)}% van de impressies gemist door budgetbeperkingen. ` +
              `Dit suggereert dat je converteert onder suboptimale omstandigheden.`,
            recommendation: 'Verhoog het dagbudget met 10-20% of versoepel je target CPA om meer conversies tegen lagere kosten te behalen.',
            dataSnapshot: {
              cpa: data.account.cpa,
              previousCpa: data.account.previousCpa,
              cpaChangePercent: cpaChange,
              impressionShareLostBudget: data.account.impressionShareLostBudget,
            },
          };
        }
        return null;
      },
    });

    // Rule 2: High impression share lost to rank
    this.rules.push({
      id: 'high_rank_loss',
      name: 'Hoge impression share verloren aan ranking',
      description: 'Detecteert wanneer veel impressies verloren gaan door lage ranking',
      type: 'bidding',
      evaluate: (data: InsightData): InsightResult | null => {
        if (data.account.impressionShareLostRank > 30) {
          return {
            ruleId: 'high_rank_loss',
            scope: 'account',
            type: 'bidding',
            impact: data.account.impressionShareLostRank > 50 ? 'high' : 'medium',
            confidence: 'high',
            effort: 'medium',    // Requires bid adjustments or QS work
            urgency: 'medium',   // Ongoing issue but not immediately critical
            summary: `${data.account.impressionShareLostRank.toFixed(0)}% impressies verloren aan ranking`,
            explanation: `Je verliest ${data.account.impressionShareLostRank.toFixed(0)}% van je potentiële impressies ` +
              `omdat je advertenties te laag ranken. Dit kan komen door te lage biedingen of een lage Ad Rank.`,
            recommendation: 'Verhoog je biedingen voor belangrijke zoekwoorden of verbeter je Quality Scores door betere advertenties en landingspaginas.',
            dataSnapshot: {
              impressionShareLostRank: data.account.impressionShareLostRank,
            },
          };
        }
        return null;
      },
    });

    // Rule 3: Conversion drop without spend change
    this.rules.push({
      id: 'conversion_drop_stable_spend',
      name: 'Conversie daling bij stabiele uitgaven',
      description: 'Detecteert conversiedaling terwijl uitgaven gelijk blijven',
      type: 'performance',
      evaluate: (data: InsightData): InsightResult | null => {
        const conversionChange = data.account.previousConversions > 0
          ? ((data.account.conversions - data.account.previousConversions) / data.account.previousConversions) * 100
          : 0;
        const costChange = data.account.previousCost > 0
          ? ((data.account.cost - data.account.previousCost) / data.account.previousCost) * 100
          : 0;

        // Conversions dropped 20%+ while spend is within 10%
        if (conversionChange <= -20 && Math.abs(costChange) <= 10) {
          return {
            ruleId: 'conversion_drop_stable_spend',
            scope: 'account',
            type: 'performance',
            impact: conversionChange <= -40 ? 'high' : 'medium',
            confidence: 'medium',
            effort: 'high',      // Requires investigation and potentially multiple changes
            urgency: 'high',     // Conversion drop is actively losing revenue
            summary: `Conversies ${conversionChange.toFixed(0)}% bij stabiele uitgaven`,
            explanation: `Conversies zijn gedaald met ${Math.abs(conversionChange).toFixed(0)}% ` +
              `terwijl de uitgaven vrijwel gelijk zijn gebleven (${costChange > 0 ? '+' : ''}${costChange.toFixed(0)}%). ` +
              `Dit wijst op een efficiëntieprobleem, niet een budgetprobleem.`,
            recommendation: 'Analyseer welke campagnes of zoekwoorden slechter presteren. Controleer ook of conversietracking correct werkt.',
            dataSnapshot: {
              conversions: data.account.conversions,
              previousConversions: data.account.previousConversions,
              conversionChangePercent: conversionChange,
              cost: data.account.cost,
              previousCost: data.account.previousCost,
              costChangePercent: costChange,
            },
          };
        }
        return null;
      },
    });

    // Rule 4: ROAS drop with high spend campaign
    this.rules.push({
      id: 'roas_drop_high_spend_campaign',
      name: 'ROAS daling in hoge spend campagne',
      description: 'Detecteert ROAS daling in campagnes met hoge uitgaven',
      type: 'performance',
      evaluate: (data: InsightData): InsightResult | null => {
        // Find campaigns with significant spend and ROAS issues
        const problematicCampaigns = data.campaigns.filter(c => {
          const convChange = c.previousConversions > 0
            ? ((c.conversions - c.previousConversions) / c.previousConversions) * 100
            : 0;
          // High spend (>20% of total) and conversion drop >30%
          return c.cost > data.account.cost * 0.2 && convChange <= -30;
        });

        if (problematicCampaigns.length > 0) {
          const worstCampaign = problematicCampaigns[0];
          const convChange = worstCampaign.previousConversions > 0
            ? ((worstCampaign.conversions - worstCampaign.previousConversions) / worstCampaign.previousConversions) * 100
            : 0;

          return {
            ruleId: 'roas_drop_high_spend_campaign',
            scope: 'campaign',
            scopeId: worstCampaign.id,
            scopeName: worstCampaign.name,
            type: 'performance',
            impact: 'high',
            confidence: 'high',
            effort: 'medium',    // Requires campaign-level analysis and adjustments
            urgency: 'high',     // High-spend campaigns losing ROAS = significant revenue impact
            summary: `${worstCampaign.name}: conversies ${convChange.toFixed(0)}%`,
            explanation: `Campagne "${worstCampaign.name}" heeft een significante conversiedaling van ${Math.abs(convChange).toFixed(0)}% ` +
              `en is goed voor een groot deel van je uitgaven. Dit heeft directe impact op je totale performance.`,
            recommendation: `Analyseer deze campagne in detail. Bekijk of er veranderingen zijn in zoekwoorden, biedingen, of landingspagina's.`,
            dataSnapshot: {
              campaignId: worstCampaign.id,
              campaignName: worstCampaign.name,
              conversions: worstCampaign.conversions,
              previousConversions: worstCampaign.previousConversions,
              cost: worstCampaign.cost,
              costSharePercent: (worstCampaign.cost / data.account.cost) * 100,
            },
          };
        }
        return null;
      },
    });

    // Rule 5: Budget limited high-performing campaign
    this.rules.push({
      id: 'budget_limited_high_performer',
      name: 'Budget beperking op goed presterende campagne',
      description: 'Detecteert wanneer een goed presterende campagne door budget wordt beperkt',
      type: 'budget',
      evaluate: (data: InsightData): InsightResult | null => {
        // Find campaigns that are budget limited and have good ROAS
        const limitedHighPerformers = data.campaigns.filter(c =>
          c.budgetLimited &&
          c.conversions > 0 &&
          c.cost > 0 &&
          (data.account.cpa === 0 || (c.cost / c.conversions) < data.account.cpa * 0.8) // CPA 20% better than average
        );

        if (limitedHighPerformers.length > 0) {
          const topCandidate = limitedHighPerformers[0];
          const campaignCpa = topCandidate.cost / topCandidate.conversions;

          return {
            ruleId: 'budget_limited_high_performer',
            scope: 'campaign',
            scopeId: topCandidate.id,
            scopeName: topCandidate.name,
            type: 'budget',
            impact: 'high',
            confidence: 'high',
            effort: 'low',       // Just need to increase budget - quick win
            urgency: 'medium',   // Missing out on conversions but not losing money
            summary: `${topCandidate.name} presteert goed maar is budget-beperkt`,
            explanation: `Campagne "${topCandidate.name}" heeft een CPA van ${data.currency} ${campaignCpa.toFixed(2)}, ` +
              `wat ${((1 - (campaignCpa / data.account.cpa)) * 100).toFixed(0)}% beter is dan je account gemiddelde. ` +
              `Deze campagne wordt echter beperkt door budget.`,
            recommendation: topCandidate.recommendedBudget
              ? `Verhoog het budget naar ${data.currency} ${topCandidate.recommendedBudget.toFixed(0)}/dag voor meer conversies.`
              : 'Verhoog het dagbudget met 20-30% om meer conversies te behalen tegen lagere gemiddelde kosten.',
            dataSnapshot: {
              campaignId: topCandidate.id,
              campaignName: topCandidate.name,
              campaignCpa: campaignCpa,
              accountCpa: data.account.cpa,
              currentBudget: topCandidate.budget,
              recommendedBudget: topCandidate.recommendedBudget,
            },
          };
        }
        return null;
      },
    });

    // Rule 6: Zero conversions with spend
    this.rules.push({
      id: 'zero_conversions_with_spend',
      name: 'Geen conversies ondanks uitgaven',
      description: 'Detecteert campagnes zonder conversies die wel budget uitgeven',
      type: 'performance',
      evaluate: (data: InsightData): InsightResult | null => {
        const zeroConversionCampaigns = data.campaigns.filter(c =>
          c.status === 'ENABLED' &&
          c.conversions === 0 &&
          c.cost > 50 // At least €50 spent
        );

        if (zeroConversionCampaigns.length > 0) {
          const totalWaste = zeroConversionCampaigns.reduce((sum, c) => sum + c.cost, 0);

          return {
            ruleId: 'zero_conversions_with_spend',
            scope: 'account',
            type: 'performance',
            impact: totalWaste > 200 ? 'high' : 'medium',
            confidence: 'high',
            effort: 'low',       // Pausing campaigns is a quick action
            urgency: 'high',     // Actively wasting money every day
            summary: `${zeroConversionCampaigns.length} campagnes zonder conversies (${data.currency} ${totalWaste.toFixed(0)} uitgegeven)`,
            explanation: `Er zijn ${zeroConversionCampaigns.length} actieve campagne(s) die samen ${data.currency} ${totalWaste.toFixed(0)} hebben uitgegeven ` +
              `zonder enige conversie te genereren. Dit budget kan mogelijk beter worden ingezet.`,
            recommendation: 'Pauzeer deze campagnes of analyseer waarom ze niet converteren. Controleer landingspaginas en conversietracking.',
            dataSnapshot: {
              campaigns: zeroConversionCampaigns.map(c => ({
                id: c.id,
                name: c.name,
                cost: c.cost,
              })),
              totalWaste: totalWaste,
            },
          };
        }
        return null;
      },
    });

    // Rule 7: Quality Score issues (would need additional data)
    // Rule 8: Search term waste (would need search term data)
    // etc.
  }

  /**
   * Run all rules against the provided data and generate insights
   */
  async generateInsights(data: InsightData): Promise<InsightResult[]> {
    const results: InsightResult[] = [];

    for (const rule of this.rules) {
      try {
        const result = rule.evaluate(data);
        if (result) {
          results.push(result);
          this.logger.debug(`Rule ${rule.id} triggered`, { result });
        }
      } catch (error) {
        this.logger.error(`Error evaluating rule ${rule.id}`, {
          error: (error as Error).message,
        });
      }
    }

    return results;
  }

  /**
   * Save insights to the database with deduplication
   */
  async saveInsights(
    clientId: string,
    insights: InsightResult[]
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const today = new Date().toISOString().slice(0, 10);

    for (const insight of insights) {
      const fingerprint = `${insight.ruleId}:${insight.scopeId || 'account'}:${today}`;

      try {
        // Check for existing insight with same fingerprint
        const { data: existing } = await this.supabase
          .from('insights')
          .select('id, status')
          .eq('client_id', clientId)
          .eq('fingerprint', fingerprint)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        // Calculate priority score for sorting/prioritization
        const priorityScore = this.calculatePriorityScore(
          insight.impact,
          insight.urgency,
          insight.effort
        );

        // Insert new insight
        const { error } = await this.supabase.from('insights').insert({
          client_id: clientId,
          scope: insight.scope,
          scope_id: insight.scopeId,
          scope_name: insight.scopeName,
          rule_id: insight.ruleId,
          type: insight.type,
          impact: insight.impact,
          confidence: insight.confidence,
          effort: insight.effort,
          urgency: insight.urgency,
          priority_score: priorityScore,
          summary: insight.summary,
          explanation: insight.explanation,
          recommendation: insight.recommendation,
          status: 'new',
          data_snapshot: insight.dataSnapshot,
          fingerprint,
          detected_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        });

        if (error) {
          if (error.code === '23505') {
            // Duplicate
            skipped++;
          } else {
            throw error;
          }
        } else {
          created++;
        }
      } catch (error) {
        this.logger.error('Failed to save insight', {
          error: (error as Error).message,
          ruleId: insight.ruleId,
        });
      }
    }

    this.logger.info(`Insights saved: ${created} created, ${skipped} skipped`);
    return { created, skipped };
  }

  /**
   * Auto-resolve insights that are no longer applicable
   */
  async autoResolveStaleInsights(clientId: string, activeRuleIds: string[]): Promise<number> {
    const { data: resolved, error } = await this.supabase
      .from('insights')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('client_id', clientId)
      .eq('status', 'new')
      .not('rule_id', 'in', `(${activeRuleIds.join(',')})`)
      .select('id');

    if (error) {
      this.logger.error('Failed to auto-resolve insights', { error: error.message });
      return 0;
    }

    if (resolved && resolved.length > 0) {
      this.logger.info(`Auto-resolved ${resolved.length} stale insights`);
    }

    return resolved?.length || 0;
  }

  /**
   * Get active insights for a client
   */
  async getInsights(
    clientId: string,
    options: {
      status?: InsightStatus[];
      type?: InsightType;
      impact?: InsightImpact;
      limit?: number;
      orderBy?: 'priority_score' | 'impact' | 'detected_at';
    } = {}
  ): Promise<Insight[]> {
    let query = this.supabase
      .from('insights')
      .select('*')
      .eq('client_id', clientId);

    // Default to ordering by priority_score (highest first)
    const orderField = options.orderBy || 'priority_score';
    query = query
      .order(orderField, { ascending: false })
      .order('detected_at', { ascending: false });

    if (options.status && options.status.length > 0) {
      query = query.in('status', options.status);
    }
    if (options.type) {
      query = query.eq('type', options.type);
    }
    if (options.impact) {
      query = query.eq('impact', options.impact);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error('Failed to get insights', { error: error.message });
      return [];
    }

    return data || [];
  }

  /**
   * Update insight status
   */
  async updateInsightStatus(
    insightId: string,
    status: InsightStatus,
    userId?: string
  ): Promise<boolean> {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'picked_up') {
      updates.picked_up_at = new Date().toISOString();
      updates.picked_up_by = userId;
    } else if (status === 'resolved') {
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by = userId;
    }

    const { error } = await this.supabase
      .from('insights')
      .update(updates)
      .eq('id', insightId);

    if (error) {
      this.logger.error('Failed to update insight status', {
        insightId,
        status,
        error: error.message,
      });
      return false;
    }

    return true;
  }
}

// Type alias for status
type InsightStatus = 'new' | 'picked_up' | 'ignored' | 'resolved';
