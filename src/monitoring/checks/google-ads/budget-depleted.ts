import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

/**
 * Check for campaigns that have exhausted their daily budget
 * Indicates campaigns are limited and missing potential traffic
 */
export class BudgetDepletedCheck extends BaseGoogleAdsCheck {
  id = 'budget_depleted';
  name = 'Budget Uitgeput';
  description = 'Detecteert campagnes waarvan het dagbudget volledig is besteed';

  private static GAQL_QUERY = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign_budget.amount_micros,
      metrics.cost_micros
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND segments.date = TODAY
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      const response = await client.query(BudgetDepletedCheck.GAQL_QUERY);

      const depletedCampaigns = response.results
        .filter((row: any) => {
          const budget = parseInt(row.campaignBudget?.amountMicros || '0', 10);
          const cost = parseInt(row.metrics?.costMicros || '0', 10);
          // Budget is depleted if cost >= 95% of budget
          return budget > 0 && cost >= budget * 0.95;
        })
        .map((row: any) => ({
          campaignId: row.campaign?.id,
          campaignName: row.campaign?.name || 'Unknown',
          budget: parseInt(row.campaignBudget?.amountMicros || '0', 10) / 1_000_000,
          spent: parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000,
        }));

      if (depletedCampaigns.length === 0) {
        return this.okResult({ message: 'Geen campagnes met uitgeput budget' });
      }

      const count = depletedCampaigns.length;
      const totalBudget = depletedCampaigns.reduce((sum: number, c: any) => sum + c.budget, 0);

      return this.errorResult(
        count,
        {
          title: 'Google Ads: budget uitgeput',
          shortDescription: `${count} campagne${count > 1 ? 's' : ''} heeft budget opgemaakt`,
          impact: 'Campagnes missen potentiële vertoningen en conversies',
          suggestedActions: [
            'Verhoog het dagbudget voor deze campagnes',
            'Optimaliseer biedingen om kosten te verlagen',
            'Controleer of dit verwacht gedrag is',
          ],
          severity: count > 2 ? 'critical' : 'high',
          details: {
            campaignCount: count,
            totalBudget: `€${totalBudget.toFixed(2)}`,
          },
        },
        { campaigns: depletedCampaigns.slice(0, 10) }
      );
    } catch (error) {
      logger.error(`Error running ${this.id} check`, { error: (error as Error).message });
      throw error;
    }
  }
}
