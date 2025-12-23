import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

/**
 * Check for sudden CPC increases
 * Could indicate competition changes or bidding issues
 */
export class CpcSpikeCheck extends BaseGoogleAdsCheck {
  id = 'cpc_spike';
  name = 'CPC Stijging';
  description = 'Detecteert plotselinge stijging in kosten per klik';

  private static GAQL_QUERY = `
    SELECT
      campaign.id,
      campaign.name,
      segments.date,
      metrics.average_cpc,
      metrics.clicks,
      metrics.cost_micros
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND segments.date DURING LAST_14_DAYS
      AND metrics.clicks > 0
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      const response = await client.query(CpcSpikeCheck.GAQL_QUERY);

      // Group by campaign and calculate daily CPC
      const campaignData = new Map<string, { name: string; dailyCpc: Map<string, number> }>();

      for (const row of response.results as any[]) {
        const id = row.campaign?.id;
        const date = row.segments?.date;
        if (!id || !date) continue;

        const cpc = parseInt(row.metrics?.averageCpc || '0', 10) / 1_000_000;
        if (cpc === 0) continue;

        let campaign = campaignData.get(id);
        if (!campaign) {
          campaign = { name: row.campaign?.name || 'Unknown', dailyCpc: new Map() };
          campaignData.set(id, campaign);
        }
        campaign.dailyCpc.set(date, cpc);
      }

      // Find campaigns with significant CPC spike (last 3 days vs previous 7 days)
      const spikes: Array<{ campaignId: string; campaignName: string; oldCpc: number; newCpc: number; increase: number }> = [];

      for (const [id, data] of campaignData) {
        const dates = Array.from(data.dailyCpc.keys()).sort();
        if (dates.length < 10) continue;

        const recentDates = dates.slice(-3);
        const olderDates = dates.slice(-10, -3);

        const recentCpc = recentDates.reduce((sum, d) => sum + (data.dailyCpc.get(d) || 0), 0) / recentDates.length;
        const olderCpc = olderDates.reduce((sum, d) => sum + (data.dailyCpc.get(d) || 0), 0) / olderDates.length;

        if (olderCpc > 0 && recentCpc > olderCpc * 1.3) { // 30% increase threshold
          spikes.push({
            campaignId: id,
            campaignName: data.name,
            oldCpc: olderCpc,
            newCpc: recentCpc,
            increase: ((recentCpc - olderCpc) / olderCpc) * 100,
          });
        }
      }

      if (spikes.length === 0) {
        return this.okResult({ message: 'Geen significante CPC stijgingen' });
      }

      spikes.sort((a, b) => b.increase - a.increase);
      const count = spikes.length;
      const maxIncrease = spikes[0].increase;

      return this.errorResult(
        count,
        {
          title: 'Google Ads: CPC stijging gedetecteerd',
          shortDescription: `${count} campagne${count > 1 ? 's' : ''} met CPC stijging tot +${maxIncrease.toFixed(0)}%`,
          impact: 'Hogere kosten per klik verlagen je ROI',
          suggestedActions: [
            'Analyseer competitie veranderingen',
            'Controleer biedstrategie instellingen',
            'Bekijk Quality Score trends',
            'Overweeg bid adjustments',
          ],
          severity: maxIncrease > 50 ? 'critical' : 'high',
          details: {
            campaignCount: count,
            maxIncrease: `+${maxIncrease.toFixed(1)}%`,
          },
        },
        { spikes: spikes.slice(0, 10) }
      );
    } catch (error) {
      logger.error(`Error running ${this.id} check`, { error: (error as Error).message });
      throw error;
    }
  }
}
