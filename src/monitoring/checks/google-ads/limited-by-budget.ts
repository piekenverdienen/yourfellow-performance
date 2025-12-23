import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

interface CampaignBudgetRow {
  campaign: {
    id: string;
    name: string;
    status: string;
    servingStatus: string;
  };
  campaignBudget: {
    id: string;
    name: string;
    amountMicros: string;
    recommendedBudgetAmountMicros?: string;
    recommendedBudgetEstimatedChangeWeeklyClicks?: string;
    recommendedBudgetEstimatedChangeWeeklyCostMicros?: string;
  };
  metrics: {
    impressions: string;
    clicks: string;
    costMicros: string;
    searchImpressionShare: string;
    searchBudgetLostImpressionShare: string;
  };
}

/**
 * Check for campaigns limited by budget
 *
 * This check identifies campaigns where:
 * - Serving status indicates budget limitation
 * - Search impression share lost to budget is significant (>20%)
 * - Google recommends a higher budget
 */
export class LimitedByBudgetCheck extends BaseGoogleAdsCheck {
  id = 'limited_by_budget';
  name = 'Beperkt door Budget';
  description = 'Detecteert campagnes die kansen missen door onvoldoende budget';

  private static GAQL_QUERY = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.serving_status,
      campaign_budget.id,
      campaign_budget.name,
      campaign_budget.amount_micros,
      campaign_budget.recommended_budget_amount_micros,
      campaign_budget.recommended_budget_estimated_change_weekly_clicks,
      campaign_budget.recommended_budget_estimated_change_weekly_cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.search_impression_share,
      metrics.search_budget_lost_impression_share
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

      if (response.results.length === 0) {
        logger.debug('No search campaigns found');
        return this.okResult({ message: 'Geen zoek campagnes gevonden' });
      }

      // Aggregate data per campaign
      const campaignMap = new Map<string, {
        name: string;
        servingStatus: string;
        budget: number;
        recommendedBudget: number;
        estimatedExtraClicks: number;
        impressions: number;
        clicks: number;
        cost: number;
        impressionShare: number;
        budgetLostIS: number;
      }>();

      for (const row of response.results as CampaignBudgetRow[]) {
        const campaignId = row.campaign?.id || 'unknown';
        const existing = campaignMap.get(campaignId);

        const budgetLostIS = parseFloat(row.metrics?.searchBudgetLostImpressionShare || '0');
        const impressionShare = parseFloat(row.metrics?.searchImpressionShare || '0');

        if (!existing || budgetLostIS > existing.budgetLostIS) {
          campaignMap.set(campaignId, {
            name: row.campaign?.name || 'Unknown',
            servingStatus: row.campaign?.servingStatus || 'UNKNOWN',
            budget: parseInt(row.campaignBudget?.amountMicros || '0', 10) / 1_000_000,
            recommendedBudget: parseInt(row.campaignBudget?.recommendedBudgetAmountMicros || '0', 10) / 1_000_000,
            estimatedExtraClicks: parseInt(row.campaignBudget?.recommendedBudgetEstimatedChangeWeeklyClicks || '0', 10),
            impressions: (existing?.impressions || 0) + parseInt(row.metrics?.impressions || '0', 10),
            clicks: (existing?.clicks || 0) + parseInt(row.metrics?.clicks || '0', 10),
            cost: (existing?.cost || 0) + parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000,
            impressionShare,
            budgetLostIS,
          });
        } else if (existing) {
          // Accumulate metrics
          existing.impressions += parseInt(row.metrics?.impressions || '0', 10);
          existing.clicks += parseInt(row.metrics?.clicks || '0', 10);
          existing.cost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
        }
      }

      // Find budget-limited campaigns
      const limitedCampaigns = Array.from(campaignMap.entries())
        .filter(([, data]) => {
          // Check if limited by budget (IS lost to budget > 20%)
          // Or serving status indicates budget limitation
          return (
            data.budgetLostIS > 0.20 ||
            data.servingStatus === 'ELIGIBLE_LIMITED' ||
            (data.recommendedBudget > 0 && data.recommendedBudget > data.budget * 1.2)
          );
        })
        .map(([id, data]) => ({
          campaignId: id,
          ...data,
          budgetLostISPercent: Math.round(data.budgetLostIS * 100),
          impressionSharePercent: Math.round(data.impressionShare * 100),
          budgetIncrease: data.recommendedBudget > 0
            ? Math.round(((data.recommendedBudget - data.budget) / data.budget) * 100)
            : 0,
        }))
        .sort((a, b) => b.budgetLostISPercent - a.budgetLostISPercent);

      if (limitedCampaigns.length === 0) {
        logger.debug('No budget-limited campaigns found');
        return this.okResult({
          message: 'Geen campagnes beperkt door budget',
          totalCampaigns: campaignMap.size,
        });
      }

      const count = limitedCampaigns.length;
      const totalEstimatedExtraClicks = limitedCampaigns.reduce(
        (sum, c) => sum + c.estimatedExtraClicks, 0
      );
      const avgBudgetLostIS = limitedCampaigns.reduce(
        (sum, c) => sum + c.budgetLostISPercent, 0
      ) / count;

      logger.info(`Found ${count} campaigns limited by budget`, {
        clientName: config.clientName,
        avgBudgetLostIS: `${avgBudgetLostIS.toFixed(0)}%`,
        totalEstimatedExtraClicks,
      });

      return this.errorResult(
        count,
        {
          title: 'Google Ads: campagnes beperkt door budget',
          shortDescription: `${count} campagne${count > 1 ? 's' : ''} missen kansen door budget`,
          impact: totalEstimatedExtraClicks > 0
            ? `Geschat ~${totalEstimatedExtraClicks} extra clicks/week mogelijk met hoger budget. Gemiddeld ${avgBudgetLostIS.toFixed(0)}% impressies verloren aan budget.`
            : `Gemiddeld ${avgBudgetLostIS.toFixed(0)}% van de impressies verloren door budget beperkingen`,
          suggestedActions: [
            'Verhoog budgetten voor goed presterende campagnes',
            'Herbalanceer budget van slecht naar goed presterende campagnes',
            'Optimaliseer biedingen voor efficiënter budgetgebruik',
            'Verfijn targeting om waste te verminderen',
            'Overweeg dayparting om budget te concentreren op piekuren',
            'Analyseer ROI per campagne voor budget prioriteiten',
          ],
          severity: avgBudgetLostIS > 40 || count > 3 ? 'high' : 'medium',
          details: {
            limitedCampaignsCount: count,
            avgBudgetLostIS: Number(avgBudgetLostIS.toFixed(1)),
            totalEstimatedExtraClicks,
          },
        },
        {
          campaigns: limitedCampaigns.slice(0, 10),
          totalCount: count,
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
}
