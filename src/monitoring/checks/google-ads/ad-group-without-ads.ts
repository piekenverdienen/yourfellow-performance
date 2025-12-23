import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

/**
 * Check for enabled ad groups without active ads
 * These ad groups won't show anything
 */
export class AdGroupWithoutAdsCheck extends BaseGoogleAdsCheck {
  id = 'ad_group_without_ads';
  name = 'Ad Groups Zonder Ads';
  description = 'Detecteert actieve ad groups zonder actieve advertenties';

  private static GAQL_QUERY = `
    SELECT
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      ad_group_ad.status
    FROM ad_group_ad
    WHERE campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
  `;

  private static AD_GROUPS_QUERY = `
    SELECT
      ad_group.id,
      ad_group.name,
      campaign.name
    FROM ad_group
    WHERE campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      // Get all enabled ad groups
      const adGroupsResponse = await client.query(AdGroupWithoutAdsCheck.AD_GROUPS_QUERY);

      const allAdGroups = new Map<string, { name: string; campaignName: string }>();
      for (const row of adGroupsResponse.results as any[]) {
        const id = row.adGroup?.id;
        if (id) {
          allAdGroups.set(id, {
            name: row.adGroup?.name || 'Unknown',
            campaignName: row.campaign?.name || 'Unknown',
          });
        }
      }

      // Get ad groups that have enabled ads
      const adsResponse = await client.query(AdGroupWithoutAdsCheck.GAQL_QUERY);

      const adGroupsWithAds = new Set<string>();
      for (const row of adsResponse.results as any[]) {
        const status = row.adGroupAd?.status;
        if (status === 'ENABLED' || status === 'PAUSED') {
          adGroupsWithAds.add(row.adGroup?.id);
        }
      }

      // Find ad groups without any ads
      const adGroupsWithoutAds = Array.from(allAdGroups.entries())
        .filter(([id]) => !adGroupsWithAds.has(id))
        .map(([id, data]) => ({
          adGroupId: id,
          adGroupName: data.name,
          campaignName: data.campaignName,
        }));

      if (adGroupsWithoutAds.length === 0) {
        return this.okResult({ message: 'Alle ad groups hebben actieve ads' });
      }

      const count = adGroupsWithoutAds.length;

      return this.errorResult(
        count,
        {
          title: 'Google Ads: ad groups zonder advertenties',
          shortDescription: `${count} ad group${count > 1 ? 's' : ''} zonder actieve ads`,
          impact: 'Deze ad groups kunnen niet vertonen en verspillen budget aan keywords',
          suggestedActions: [
            'Voeg advertenties toe aan deze ad groups',
            'Of pauzeer de ad groups als ze niet meer nodig zijn',
            'Controleer of ads per ongeluk zijn verwijderd',
          ],
          severity: count > 5 ? 'critical' : 'high',
          details: {
            adGroupCount: count,
          },
        },
        { adGroups: adGroupsWithoutAds.slice(0, 15) }
      );
    } catch (error) {
      logger.error(`Error running ${this.id} check`, { error: (error as Error).message });
      throw error;
    }
  }
}
