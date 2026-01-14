import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

interface CampaignPerformanceRow {
  campaign: {
    id: string;
    name: string;
    status: string;
  };
  metrics: {
    impressions: string;
    clicks: string;
    conversions: string;
    costMicros: string;
    conversionsValue: string;
  };
}

interface PausedCampaignData {
  campaignId: string;
  campaignName: string;
  status: string;
  conversions: number;
  revenue: number;
  cost: number;
  roas: number;
  cpa: number;
  impressions: number;
  clicks: number;
}

/**
 * Check for paused campaigns that were performing well
 *
 * This check identifies:
 * - Recently paused campaigns with good conversion data
 * - Campaigns that were generating revenue but are now paused
 * - Potential accidental pauses of high-performing campaigns
 */
export class PausedHighPerformersCheck extends BaseGoogleAdsCheck {
  id = 'paused_high_performers';
  name = 'Gepauzeerde Top Presteerders';
  description = 'Detecteert gepauzeerde campagnes die goed presteerden';

  // Get paused campaigns with their historical performance (last 30 days before pause)
  private static GAQL_QUERY = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.conversions_value
    FROM campaign
    WHERE campaign.status = 'PAUSED'
      AND segments.date DURING LAST_30_DAYS
  `;

  // Get enabled campaigns for comparison
  private static ENABLED_QUERY = `
    SELECT
      campaign.id,
      campaign.name,
      metrics.conversions,
      metrics.cost_micros
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND segments.date DURING LAST_30_DAYS
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      // Get paused campaigns
      const pausedResponse = await client.query(PausedHighPerformersCheck.GAQL_QUERY);

      if (pausedResponse.results.length === 0) {
        logger.debug('No paused campaigns found');
        return this.okResult({ message: 'Geen gepauzeerde campagnes gevonden' });
      }

      // Get enabled campaigns for comparison
      let enabledAvgCpa = 0;
      let enabledAvgRoas = 0;

      try {
        const enabledResponse = await client.query(PausedHighPerformersCheck.ENABLED_QUERY);

        if (enabledResponse.results.length > 0) {
          let totalEnabledConversions = 0;
          let totalEnabledCost = 0;

          for (const row of enabledResponse.results as unknown as CampaignPerformanceRow[]) {
            totalEnabledConversions += parseFloat(row.metrics?.conversions || '0');
            totalEnabledCost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
          }

          if (totalEnabledConversions > 0) {
            enabledAvgCpa = totalEnabledCost / totalEnabledConversions;
          }
        }
      } catch (enabledError) {
        logger.debug('Could not get enabled campaign comparison data');
      }

      // Process paused campaigns
      const pausedCampaigns = this.processResults(pausedResponse.results as unknown as CampaignPerformanceRow[]);

      // Filter for high performers (campaigns with good metrics)
      const highPerformers = pausedCampaigns.filter(campaign => {
        // Has conversions
        if (campaign.conversions < 1) return false;

        // Good ROAS (>2) or good CPA (better than average)
        const hasGoodRoas = campaign.roas > 2;
        const hasGoodCpa = enabledAvgCpa > 0 && campaign.cpa < enabledAvgCpa;
        const hasSignificantVolume = campaign.conversions >= 5 || campaign.revenue > 500;

        return (hasGoodRoas || hasGoodCpa) && hasSignificantVolume;
      });

      if (highPerformers.length === 0) {
        const totalPaused = pausedCampaigns.length;
        logger.debug('No high-performing paused campaigns found');
        return this.okResult({
          message: 'Geen goed presterende gepauzeerde campagnes gevonden',
          totalPausedCampaigns: totalPaused,
        });
      }

      const count = highPerformers.length;
      const totalMissedRevenue = highPerformers.reduce((sum, c) => sum + c.revenue, 0);
      const totalConversions = highPerformers.reduce((sum, c) => sum + c.conversions, 0);
      const avgRoas = highPerformers.reduce((sum, c) => sum + c.roas, 0) / count;

      logger.warn(`Found ${count} paused high-performing campaigns`, {
        clientName: config.clientName,
        totalMissedRevenue: totalMissedRevenue.toFixed(2),
        totalConversions: totalConversions.toFixed(0),
        avgRoas: avgRoas.toFixed(2),
      });

      return this.errorResult(
        count,
        {
          title: 'Google Ads: goed presterende campagnes gepauzeerd',
          shortDescription: `${count} winstgevende campagne${count > 1 ? 's' : ''} gepauzeerd`,
          impact: `Gepauzeerde campagnes genereerden €${totalMissedRevenue.toFixed(2)} omzet met ${totalConversions.toFixed(0)} conversies (30 dagen). Gem. ROAS: ${avgRoas.toFixed(1)}x`,
          suggestedActions: [
            'Controleer of deze campagnes per ongeluk zijn gepauzeerd',
            'Bekijk of er een geldige reden is voor de pauze',
            'Overweeg de campagnes opnieuw te activeren',
            'Check of seizoensgebonden pauze bedoeld was',
            'Evalueer of budget elders beter besteed wordt',
          ],
          severity: totalMissedRevenue > 1000 || count > 2 ? 'high' : 'medium',
          details: {
            pausedHighPerformersCount: count,
            totalMissedRevenue: Number(totalMissedRevenue.toFixed(2)),
            totalConversions: Number(totalConversions.toFixed(0)),
            avgRoas: Number(avgRoas.toFixed(2)),
          },
        },
        {
          campaigns: highPerformers.slice(0, 10),
          totalCount: count,
          comparisonCpa: enabledAvgCpa > 0 ? Number(enabledAvgCpa.toFixed(2)) : null,
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
   * Process query results into structured campaign data
   */
  private processResults(rows: CampaignPerformanceRow[]): PausedCampaignData[] {
    // Aggregate by campaign
    const campaignMap = new Map<string, PausedCampaignData>();

    for (const row of rows) {
      const campaignId = row.campaign?.id || 'unknown';
      const existing = campaignMap.get(campaignId);

      const conversions = parseFloat(row.metrics?.conversions || '0');
      const cost = parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
      const revenue = parseFloat(row.metrics?.conversionsValue || '0');
      const impressions = parseInt(row.metrics?.impressions || '0', 10);
      const clicks = parseInt(row.metrics?.clicks || '0', 10);

      if (!existing) {
        campaignMap.set(campaignId, {
          campaignId,
          campaignName: row.campaign?.name || 'Unknown Campaign',
          status: row.campaign?.status || 'UNKNOWN',
          conversions,
          revenue,
          cost,
          roas: cost > 0 ? revenue / cost : 0,
          cpa: conversions > 0 ? cost / conversions : 0,
          impressions,
          clicks,
        });
      } else {
        existing.conversions += conversions;
        existing.revenue += revenue;
        existing.cost += cost;
        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.roas = existing.cost > 0 ? existing.revenue / existing.cost : 0;
        existing.cpa = existing.conversions > 0 ? existing.cost / existing.conversions : 0;
      }
    }

    return Array.from(campaignMap.values())
      .sort((a, b) => b.revenue - a.revenue); // Sort by revenue
  }
}
