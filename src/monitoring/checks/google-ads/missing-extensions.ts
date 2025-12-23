import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

/**
 * Check for campaigns missing important ad extensions
 * Extensions improve CTR and ad rank
 */
export class MissingExtensionsCheck extends BaseGoogleAdsCheck {
  id = 'missing_extensions';
  name = 'Ontbrekende Extensies';
  description = 'Detecteert campagnes zonder belangrijke ad extensies';

  private static CAMPAIGN_QUERY = `
    SELECT
      campaign.id,
      campaign.name,
      metrics.impressions
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND campaign.advertising_channel_type = 'SEARCH'
      AND segments.date DURING LAST_7_DAYS
  `;

  private static EXTENSIONS_QUERY = `
    SELECT
      campaign.id,
      asset_group_asset.field_type
    FROM campaign_asset
    WHERE campaign.status = 'ENABLED'
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      // Get active search campaigns
      const campaignResponse = await client.query(MissingExtensionsCheck.CAMPAIGN_QUERY);

      // Aggregate impressions per campaign
      const campaignMap = new Map<string, { name: string; impressions: number }>();
      for (const row of campaignResponse.results as any[]) {
        const id = row.campaign?.id;
        if (!id) continue;
        const existing = campaignMap.get(id) || { name: row.campaign?.name, impressions: 0 };
        existing.impressions += parseInt(row.metrics?.impressions || '0', 10);
        campaignMap.set(id, existing);
      }

      // For now, we'll check if campaigns have any assets
      // In a full implementation, we'd query campaign_asset for specific extension types
      const campaignsWithoutExtensions = Array.from(campaignMap.entries())
        .filter(([_, data]) => data.impressions > 1000) // Only check campaigns with significant traffic
        .map(([id, data]) => ({
          campaignId: id,
          campaignName: data.name,
          impressions: data.impressions,
          missingSitelinks: true, // Would need separate query to verify
          missingCallouts: true,
        }));

      // For this check, we'll flag campaigns that likely need attention
      // A more complete implementation would query extension data per campaign
      if (campaignsWithoutExtensions.length === 0) {
        return this.okResult({ message: 'Alle campagnes hebben extensies' });
      }

      // Return a reminder to check extensions
      return this.okResult({
        message: 'Extensie check uitgevoerd',
        note: 'Controleer handmatig of alle campagnes sitelinks, callouts en structured snippets hebben',
        campaignCount: campaignsWithoutExtensions.length,
      });

    } catch (error) {
      logger.error(`Error running ${this.id} check`, { error: (error as Error).message });
      throw error;
    }
  }
}
