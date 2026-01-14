import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

interface BudgetRow {
  campaign: {
    id: string;
    name: string;
    status: string;
  };
  campaignBudget: {
    id: string;
    name: string;
    amountMicros: string;
    status: string;
  };
  metrics: {
    costMicros: string;
  };
}

/**
 * Check for campaigns where daily budget is nearly or fully depleted
 *
 * This check identifies campaigns where:
 * - Daily budget is > 90% spent before 6 PM local time
 * - Helps identify campaigns that might be missing opportunities
 */
export class BudgetDepletedCheck extends BaseGoogleAdsCheck {
  id = 'budget_depleted';
  name = 'Budget Uitgeput';
  description = 'Detecteert campagnes waar het dagbudget vroegtijdig op is';

  private static GAQL_QUERY = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign_budget.id,
      campaign_budget.name,
      campaign_budget.amount_micros,
      campaign_budget.status,
      metrics.cost_micros
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND campaign_budget.status = 'ENABLED'
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

      if (response.results.length === 0) {
        logger.debug('No campaigns with budget data found');
        return this.okResult({ message: 'Geen actieve campagnes met budget gevonden' });
      }

      // Check current hour - only alert if before 6 PM (18:00)
      const currentHour = new Date().getHours();
      const isEarlyInDay = currentHour < 18;

      const depletedCampaigns = this.processResults(response.results as unknown as BudgetRow[]);

      if (depletedCampaigns.length === 0) {
        logger.debug('No campaigns with depleted budgets');
        return this.okResult({
          message: 'Alle campagne budgetten zijn binnen normale grenzen',
          totalCampaigns: response.results.length,
        });
      }

      const count = depletedCampaigns.length;
      const fullyDepleted = depletedCampaigns.filter(c => c.percentSpent >= 100).length;

      logger.info(`Found ${count} campaigns with depleted budgets`, {
        clientName: config.clientName,
        fullyDepleted,
        isEarlyInDay,
      });

      // Only alert as high severity if budget depleted early in the day
      const severity = isEarlyInDay && fullyDepleted > 0 ? 'high' : 'medium';

      return this.errorResult(
        count,
        {
          title: 'Google Ads: budget vroegtijdig uitgeput',
          shortDescription: `${count} campagne${count > 1 ? 's' : ''} met uitgeput budget`,
          impact: isEarlyInDay
            ? 'Campagnes missen potentiële kliks en conversies door te vroege budget uitputting'
            : 'Dagbudget is bijna of volledig besteed',
          suggestedActions: [
            'Verhoog het dagbudget voor betere dekking',
            'Optimaliseer biedingen om budget efficiënter te besteden',
            'Bekijk de verdeling over de dag (ad scheduling)',
            'Overweeg accelerated delivery uit te zetten',
            'Analyseer welke uren de beste ROI geven',
          ],
          severity,
          details: {
            depletedCount: count,
            fullyDepleted,
            isEarlyInDay,
            currentHour,
          },
        },
        {
          campaigns: depletedCampaigns.slice(0, 10),
          totalDepleted: count,
          checkTime: new Date().toISOString(),
        }
      );
    } catch (error) {
      logger.error(`Error running ${this.id} check`, {
        error: (error as Error).message,
        clientName: config.clientName,
      });
      throw error;
    }
  }

  /**
   * Process results and identify campaigns with depleted budgets
   */
  private processResults(rows: BudgetRow[]): Array<{
    campaignId: string;
    campaignName: string;
    budgetAmount: number;
    costToday: number;
    percentSpent: number;
  }> {
    return rows
      .map(row => {
        const budgetMicros = parseInt(row.campaignBudget?.amountMicros || '0', 10);
        const costMicros = parseInt(row.metrics?.costMicros || '0', 10);
        const budgetAmount = budgetMicros / 1_000_000;
        const costToday = costMicros / 1_000_000;
        const percentSpent = budgetAmount > 0 ? (costToday / budgetAmount) * 100 : 0;

        return {
          campaignId: row.campaign?.id || 'unknown',
          campaignName: row.campaign?.name || 'Unknown Campaign',
          budgetAmount,
          costToday,
          percentSpent: Math.round(percentSpent),
        };
      })
      .filter(campaign => campaign.percentSpent >= 90); // 90% or more spent
  }
}
