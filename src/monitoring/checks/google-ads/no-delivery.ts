import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig, CampaignMetricsRow } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

/**
 * Check for campaigns that are enabled but have no delivery
 *
 * This check identifies campaigns that:
 * - Have status ENABLED
 * - Have 0 impressions in the last 24 hours
 * - Were started more than 24 hours ago
 */
export class NoDeliveryCheck extends BaseGoogleAdsCheck {
  id = 'no_delivery';
  name = 'Campagnes Zonder Delivery';
  description = 'Detecteert actieve campagnes die geen impressies genereren';

  private static GAQL_QUERY = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.start_date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND segments.date DURING YESTERDAY
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    const noDeliveryThresholdHours = config.thresholds?.noDeliveryHours ?? 24;

    try {
      const response = await client.query(NoDeliveryCheck.GAQL_QUERY);

      if (response.results.length === 0) {
        logger.debug('No enabled campaigns found');
        return this.okResult({ message: 'Geen actieve campagnes gevonden' });
      }

      // Filter for campaigns with no delivery that are old enough
      const noDeliveryCampaigns = this.processResults(
        response.results as unknown as CampaignMetricsRow[],
        noDeliveryThresholdHours
      );

      if (noDeliveryCampaigns.length === 0) {
        logger.debug('All enabled campaigns have delivery');
        return this.okResult({
          message: 'Alle actieve campagnes hebben impressies',
          totalCampaigns: response.results.length,
        });
      }

      const count = noDeliveryCampaigns.length;

      logger.info(`Found ${count} campaigns without delivery`, {
        clientName: config.clientName,
        campaigns: noDeliveryCampaigns.map(c => c.name),
      });

      return this.errorResult(
        count,
        {
          title: 'Google Ads: campagnes zonder impressies',
          shortDescription: `${count} campagne${count > 1 ? 's' : ''} actief maar geen delivery`,
          impact: 'Budget wordt niet besteed, campagnes bereiken geen publiek',
          suggestedActions: [
            'Controleer de campagne-instellingen',
            'Bekijk of het budget voldoende is',
            'Check de biedingen (zijn ze competitief genoeg?)',
            'Controleer targeting en advertentiegroep status',
            'Verifieer of er geen scheduling beperkingen zijn',
          ],
          severity: count > 3 ? 'critical' : 'high',
          details: {
            noDeliveryCampaigns: count,
            campaignNames: noDeliveryCampaigns.map(c => c.name),
          },
        },
        {
          campaigns: noDeliveryCampaigns.slice(0, 10), // Limit to first 10
          totalNoDelivery: count,
          thresholdHours: noDeliveryThresholdHours,
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
   * Process query results and filter for no-delivery campaigns
   */
  private processResults(
    rows: CampaignMetricsRow[],
    noDeliveryThresholdHours: number
  ): Array<{
    campaignId: string;
    name: string;
    status: string;
    startDate: string;
    impressions: number;
    hoursOld: number;
  }> {
    const now = new Date();

    return rows
      .filter(row => {
        // Check for zero impressions
        const impressions = parseInt(row.metrics?.impressions || '0', 10);
        if (impressions > 0) return false;

        // Check if campaign is old enough
        const startDate = row.campaign?.startDate;
        if (!startDate) return true; // If no start date, include it

        // Parse start date (YYYY-MM-DD format)
        const campaignStart = new Date(startDate);
        const hoursOld = (now.getTime() - campaignStart.getTime()) / (1000 * 60 * 60);

        return hoursOld >= noDeliveryThresholdHours;
      })
      .map(row => {
        const startDate = row.campaign?.startDate || '';
        const campaignStart = startDate ? new Date(startDate) : now;
        const hoursOld = Math.round(
          (now.getTime() - campaignStart.getTime()) / (1000 * 60 * 60)
        );

        return {
          campaignId: row.campaign?.id || 'unknown',
          name: row.campaign?.name || 'Unknown Campaign',
          status: row.campaign?.status || 'UNKNOWN',
          startDate,
          impressions: parseInt(row.metrics?.impressions || '0', 10),
          hoursOld,
        };
      });
  }
}
