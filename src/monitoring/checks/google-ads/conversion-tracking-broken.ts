import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

/**
 * Check for campaigns with spend but no conversions
 * Could indicate broken conversion tracking
 */
export class ConversionTrackingBrokenCheck extends BaseGoogleAdsCheck {
  id = 'conversion_tracking_broken';
  name = 'Conversie Tracking Probleem';
  description = 'Detecteert campagnes met spend maar zonder conversies (mogelijk broken tracking)';

  private static GAQL_QUERY = `
    SELECT
      campaign.id,
      campaign.name,
      metrics.cost_micros,
      metrics.conversions,
      metrics.clicks
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND segments.date DURING LAST_7_DAYS
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      const response = await client.query(ConversionTrackingBrokenCheck.GAQL_QUERY);

      // Aggregate by campaign
      const campaignMap = new Map<string, { name: string; cost: number; conversions: number; clicks: number }>();

      for (const row of response.results as any[]) {
        const id = row.campaign?.id;
        if (!id) continue;

        const existing = campaignMap.get(id) || { name: row.campaign?.name, cost: 0, conversions: 0, clicks: 0 };
        existing.cost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
        existing.conversions += parseFloat(row.metrics?.conversions || '0');
        existing.clicks += parseInt(row.metrics?.clicks || '0', 10);
        campaignMap.set(id, existing);
      }

      // Filter for campaigns with significant spend (>€50) and clicks (>50) but 0 conversions
      const suspectCampaigns = Array.from(campaignMap.entries())
        .filter(([_, data]) => data.cost > 50 && data.clicks > 50 && data.conversions === 0)
        .map(([id, data]) => ({
          campaignId: id,
          campaignName: data.name,
          spend: data.cost,
          clicks: data.clicks,
          conversions: data.conversions,
        }));

      if (suspectCampaigns.length === 0) {
        return this.okResult({ message: 'Conversie tracking lijkt te werken' });
      }

      const count = suspectCampaigns.length;
      const totalSpend = suspectCampaigns.reduce((sum, c) => sum + c.spend, 0);

      return this.errorResult(
        count,
        {
          title: 'Google Ads: mogelijk conversie tracking probleem',
          shortDescription: `${count} campagne${count > 1 ? 's' : ''} met €${totalSpend.toFixed(0)} spend zonder conversies`,
          impact: 'Conversie data ontbreekt, optimalisatie is onmogelijk',
          suggestedActions: [
            'Controleer of de Google Ads tag correct is geïnstalleerd',
            'Verifieer conversie acties in Google Ads',
            'Test de conversie tracking met Tag Assistant',
            'Check of conversies niet vertraagd zijn (attribution window)',
          ],
          severity: 'critical',
          details: {
            campaignCount: count,
            totalSpend: `€${totalSpend.toFixed(2)}`,
            period: 'Laatste 7 dagen',
          },
        },
        { campaigns: suspectCampaigns.slice(0, 10) }
      );
    } catch (error) {
      logger.error(`Error running ${this.id} check`, { error: (error as Error).message });
      throw error;
    }
  }
}
