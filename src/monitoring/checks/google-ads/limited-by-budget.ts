import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

/**
 * Check for campaigns losing impression share due to budget
 * Indicates opportunities being missed
 */
export class LimitedByBudgetCheck extends BaseGoogleAdsCheck {
  id = 'limited_by_budget';
  name = 'Beperkt Door Budget';
  description = 'Detecteert campagnes die impressies verliezen door budget beperkingen';

  private static GAQL_QUERY = `
    SELECT
      campaign.id,
      campaign.name,
      campaign_budget.amount_micros,
      metrics.search_impression_share,
      metrics.search_budget_lost_impression_share,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND campaign.advertising_channel_type = 'SEARCH'
      AND segments.date DURING LAST_7_DAYS
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      const response = await client.query(LimitedByBudgetCheck.GAQL_QUERY);

      // Aggregate by campaign
      const campaignMap = new Map<string, {
        name: string;
        budget: number;
        impressionShare: number;
        budgetLostShare: number;
        cost: number;
        conversions: number;
        days: number;
      }>();

      for (const row of response.results as any[]) {
        const id = row.campaign?.id;
        if (!id) continue;

        const budgetLostShare = parseFloat(row.metrics?.searchBudgetLostImpressionShare || '0');
        if (budgetLostShare === 0) continue;

        const existing = campaignMap.get(id) || {
          name: row.campaign?.name || 'Unknown',
          budget: parseInt(row.campaignBudget?.amountMicros || '0', 10) / 1_000_000,
          impressionShare: 0,
          budgetLostShare: 0,
          cost: 0,
          conversions: 0,
          days: 0,
        };

        existing.impressionShare += parseFloat(row.metrics?.searchImpressionShare || '0');
        existing.budgetLostShare += budgetLostShare;
        existing.cost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
        existing.conversions += parseFloat(row.metrics?.conversions || '0');
        existing.days += 1;
        campaignMap.set(id, existing);
      }

      // Calculate averages and filter significant budget loss (>10%)
      const limitedCampaigns = Array.from(campaignMap.entries())
        .map(([id, data]) => ({
          campaignId: id,
          campaignName: data.name,
          dailyBudget: data.budget,
          avgBudgetLostShare: data.budgetLostShare / data.days,
          avgImpressionShare: data.impressionShare / data.days,
          totalCost: data.cost,
          conversions: data.conversions,
        }))
        .filter(c => c.avgBudgetLostShare > 0.1) // More than 10% lost
        .sort((a, b) => b.avgBudgetLostShare - a.avgBudgetLostShare);

      if (limitedCampaigns.length === 0) {
        return this.okResult({ message: 'Geen campagnes significant beperkt door budget' });
      }

      const count = limitedCampaigns.length;
      const maxLoss = limitedCampaigns[0].avgBudgetLostShare * 100;

      return this.errorResult(
        count,
        {
          title: 'Google Ads: campagnes beperkt door budget',
          shortDescription: `${count} campagne${count > 1 ? 's' : ''} verliest tot ${maxLoss.toFixed(0)}% impressies`,
          impact: 'Je mist potentiële klanten en conversies',
          suggestedActions: [
            'Verhoog het dagbudget voor deze campagnes',
            'Verlaag biedingen om meer vertoningen te krijgen',
            'Focus budget op best presterende campagnes',
            'Optimaliseer targeting om kosten te verlagen',
          ],
          severity: maxLoss > 30 ? 'critical' : 'high',
          details: {
            campaignCount: count,
            maxImpressionLoss: `${maxLoss.toFixed(1)}%`,
          },
        },
        { campaigns: limitedCampaigns.slice(0, 10) }
      );
    } catch (error) {
      logger.error(`Error running ${this.id} check`, { error: (error as Error).message });
      throw error;
    }
  }
}
