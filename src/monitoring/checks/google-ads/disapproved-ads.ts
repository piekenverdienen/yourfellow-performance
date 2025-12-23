import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig, DisapprovedAdRow } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

/**
 * Check for disapproved ads in Google Ads
 *
 * This check queries all ads that are not approved (DISAPPROVED, AREA_OF_INTEREST_ONLY, etc.)
 * and creates an alert if any are found.
 */
export class DisapprovedAdsCheck extends BaseGoogleAdsCheck {
  id = 'disapproved_ads';
  name = 'Afgekeurde Advertenties';
  description = 'Detecteert advertenties die zijn afgekeurd door Google vanwege policy schendingen';

  private static GAQL_QUERY = `
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad.name,
      ad_group_ad.policy_summary.approval_status,
      ad_group_ad.policy_summary.policy_topic_entries,
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name
    FROM ad_group_ad
    WHERE ad_group_ad.policy_summary.approval_status != 'APPROVED'
      AND ad_group_ad.policy_summary.approval_status != 'APPROVED_LIMITED'
      AND ad_group_ad.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
      AND campaign.status != 'REMOVED'
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      const response = await client.query(DisapprovedAdsCheck.GAQL_QUERY);

      if (response.results.length === 0) {
        logger.debug('No disapproved ads found');
        return this.okResult({ message: 'Alle advertenties zijn goedgekeurd' });
      }

      // Process the results
      const disapprovedAds = this.processResults(response.results as DisapprovedAdRow[]);
      const count = disapprovedAds.length;

      // Collect unique policy topics
      const allPolicyTopics = new Set<string>();
      for (const ad of disapprovedAds) {
        for (const topic of ad.policyTopics) {
          allPolicyTopics.add(topic);
        }
      }

      logger.info(`Found ${count} disapproved ads`, {
        clientName: config.clientName,
        policyTopics: Array.from(allPolicyTopics),
      });

      return this.errorResult(
        count,
        {
          title: 'Google Ads: advertenties afgekeurd',
          shortDescription: `${count} advertentie${count > 1 ? 's' : ''} afgekeurd`,
          impact: count > 3
            ? 'Meerdere advertenties leveren niet, campagne-effectiviteit is significant verminderd'
            : 'Advertenties leveren momenteel niet',
          suggestedActions: [
            'Bekijk de afgekeurde advertenties in Google Ads',
            'Controleer welke policy topics zijn geschonden',
            'Pas de advertentietekst of afbeeldingen aan',
            'Dien de advertenties opnieuw in ter review',
          ],
          severity: count > 5 ? 'critical' : 'high',
          details: {
            disapprovedCount: count,
            policyTopics: Array.from(allPolicyTopics),
          },
        },
        {
          disapprovedAds: disapprovedAds.slice(0, 10), // Limit to first 10 for storage
          totalCount: count,
          policyTopics: Array.from(allPolicyTopics),
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
   * Process query results into structured ad data
   */
  private processResults(rows: DisapprovedAdRow[]): Array<{
    adId: string;
    adName: string;
    adGroupName: string;
    campaignName: string;
    approvalStatus: string;
    policyTopics: string[];
  }> {
    return rows.map(row => {
      const policyTopics = (row.adGroupAd?.policySummary?.policyTopicEntries || [])
        .map(entry => entry.topic)
        .filter(Boolean);

      return {
        adId: row.adGroupAd?.ad?.id || 'unknown',
        adName: row.adGroupAd?.ad?.name || 'Unnamed Ad',
        adGroupName: row.adGroup?.name || 'Unknown Ad Group',
        campaignName: row.campaign?.name || 'Unknown Campaign',
        approvalStatus: row.adGroupAd?.policySummary?.approvalStatus || 'UNKNOWN',
        policyTopics,
      };
    });
  }
}
