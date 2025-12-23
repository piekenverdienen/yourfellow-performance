import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

/**
 * Check for ads with landing page issues
 * Based on final URL and policy info
 */
export class LandingPageErrorsCheck extends BaseGoogleAdsCheck {
  id = 'landing_page_errors';
  name = 'Landing Page Problemen';
  description = 'Detecteert advertenties met landingspagina problemen';

  private static GAQL_QUERY = `
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad.final_urls,
      ad_group_ad.policy_summary.approval_status,
      ad_group_ad.policy_summary.policy_topic_entries,
      ad_group.name,
      campaign.name,
      metrics.impressions,
      metrics.clicks
    FROM ad_group_ad
    WHERE campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND ad_group_ad.status = 'ENABLED'
      AND segments.date DURING LAST_7_DAYS
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      const response = await client.query(LandingPageErrorsCheck.GAQL_QUERY);

      // Collect unique final URLs and check for landing page related policy issues
      const landingPageIssues: Array<{
        adId: string;
        url: string;
        adGroupName: string;
        campaignName: string;
        issue: string;
      }> = [];

      for (const row of response.results as any[]) {
        const policyEntries = row.adGroupAd?.policySummary?.policyTopicEntries || [];

        // Check for landing page related policies
        const landingPagePolicies = policyEntries.filter((entry: any) => {
          const topic = entry.topic?.toLowerCase() || '';
          return (
            topic.includes('destination') ||
            topic.includes('landing') ||
            topic.includes('url') ||
            topic.includes('site') ||
            topic.includes('malware') ||
            topic.includes('phishing')
          );
        });

        if (landingPagePolicies.length > 0) {
          const finalUrls = row.adGroupAd?.ad?.finalUrls || [];
          landingPageIssues.push({
            adId: row.adGroupAd?.ad?.id || 'unknown',
            url: finalUrls[0] || 'Unknown URL',
            adGroupName: row.adGroup?.name || 'Unknown',
            campaignName: row.campaign?.name || 'Unknown',
            issue: landingPagePolicies.map((p: any) => p.topic).join(', '),
          });
        }
      }

      if (landingPageIssues.length === 0) {
        return this.okResult({ message: 'Geen landingspagina problemen gedetecteerd' });
      }

      const count = landingPageIssues.length;
      const uniqueUrls = new Set(landingPageIssues.map(i => i.url)).size;

      return this.errorResult(
        count,
        {
          title: 'Google Ads: landingspagina problemen',
          shortDescription: `${count} ad${count > 1 ? 's' : ''} met landing page issues (${uniqueUrls} unieke URLs)`,
          impact: 'Advertenties kunnen niet vertonen of hebben lagere kwaliteit',
          suggestedActions: [
            'Controleer of de landingspaginas bereikbaar zijn',
            'Fix eventuele 404 errors',
            'Zorg dat paginas snel laden',
            'Verifieer dat content voldoet aan Google policies',
          ],
          severity: 'critical',
          details: {
            adCount: count,
            uniqueUrls,
          },
        },
        { issues: landingPageIssues.slice(0, 15) }
      );
    } catch (error) {
      logger.error(`Error running ${this.id} check`, { error: (error as Error).message });
      throw error;
    }
  }
}
