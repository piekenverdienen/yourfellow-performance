import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

interface AudienceRow {
  campaignCriterion?: {
    criterionId: string;
    type: string;
    status: string;
    negative: boolean;
    userList?: {
      userList: string;
    };
  };
  campaign: {
    id: string;
    name: string;
    status: string;
  };
  metrics?: {
    impressions: string;
    clicks: string;
    costMicros: string;
  };
}

interface CampaignAudienceStatus {
  campaignId: string;
  campaignName: string;
  hasAudiences: boolean;
  audienceCount: number;
  impressions: number;
  cost: number;
  issues: string[];
}

/**
 * Check for audience targeting issues
 *
 * This check identifies:
 * - Campaigns without any audience signals
 * - Campaigns with very narrow audiences (low impressions)
 * - Potential audience overlap issues
 */
export class AudienceIssuesCheck extends BaseGoogleAdsCheck {
  id = 'audience_issues';
  name = 'Doelgroep Problemen';
  description = 'Detecteert problemen met doelgroep targeting die bereik beperken';

  // Check campaign audiences
  private static AUDIENCES_QUERY = `
    SELECT
      campaign_criterion.criterion_id,
      campaign_criterion.type,
      campaign_criterion.status,
      campaign_criterion.negative,
      campaign_criterion.user_list.user_list,
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM campaign_criterion
    WHERE campaign.status = 'ENABLED'
      AND campaign_criterion.type IN ('USER_LIST', 'USER_INTEREST', 'CUSTOM_AUDIENCE', 'COMBINED_AUDIENCE')
      AND segments.date DURING LAST_7_DAYS
  `;

  // Get campaigns without audience data to compare
  private static CAMPAIGNS_QUERY = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.cost_micros
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND campaign.advertising_channel_type IN ('SEARCH', 'DISPLAY', 'PERFORMANCE_MAX')
      AND segments.date DURING LAST_7_DAYS
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      // Get all active campaigns
      const campaignsResponse = await client.query(AudienceIssuesCheck.CAMPAIGNS_QUERY);

      if (campaignsResponse.results.length === 0) {
        logger.debug('No active campaigns found');
        return this.okResult({ message: 'Geen actieve campagnes gevonden' });
      }

      // Build campaign map
      const campaignMap = new Map<string, CampaignAudienceStatus>();

      for (const row of campaignsResponse.results as unknown as AudienceRow[]) {
        const campaignId = row.campaign?.id || 'unknown';
        const existing = campaignMap.get(campaignId);

        if (!existing) {
          campaignMap.set(campaignId, {
            campaignId,
            campaignName: row.campaign?.name || 'Unknown',
            hasAudiences: false,
            audienceCount: 0,
            impressions: parseInt(row.metrics?.impressions || '0', 10),
            cost: parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000,
            issues: [],
          });
        } else {
          existing.impressions += parseInt(row.metrics?.impressions || '0', 10);
          existing.cost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
        }
      }

      // Get audience data
      try {
        const audienceResponse = await client.query(AudienceIssuesCheck.AUDIENCES_QUERY);

        // Mark campaigns that have audiences
        for (const row of audienceResponse.results as unknown as AudienceRow[]) {
          const campaignId = row.campaign?.id || 'unknown';
          const campaign = campaignMap.get(campaignId);

          if (campaign && !row.campaignCriterion?.negative) {
            campaign.hasAudiences = true;
            campaign.audienceCount++;
          }
        }
      } catch (audienceError) {
        // Audience query may fail - continue with what we have
        logger.debug('Could not query audience data', {
          error: (audienceError as Error).message,
        });
      }

      // Analyze for issues
      const issues: CampaignAudienceStatus[] = [];

      for (const campaign of Array.from(campaignMap.values())) {
        const campaignIssues: string[] = [];

        // Check for Display/PMax campaigns without audiences
        // Note: Search campaigns don't necessarily need audiences
        if (!campaign.hasAudiences && campaign.impressions > 0) {
          // Only flag if it has significant spend
          if (campaign.cost > 50) {
            campaignIssues.push('Geen doelgroep signalen geconfigureerd');
          }
        }

        // Check for very low impressions (possible too narrow targeting)
        if (campaign.hasAudiences && campaign.impressions < 100 && campaign.cost > 0) {
          campaignIssues.push('Zeer weinig impressies - mogelijk te smalle targeting');
        }

        if (campaignIssues.length > 0) {
          campaign.issues = campaignIssues;
          issues.push(campaign);
        }
      }

      if (issues.length === 0) {
        logger.debug('No audience issues found');
        return this.okResult({
          message: 'Geen doelgroep problemen gedetecteerd',
          totalCampaigns: campaignMap.size,
          campaignsWithAudiences: Array.from(campaignMap.values()).filter(c => c.hasAudiences).length,
        });
      }

      const count = issues.length;
      const noAudienceCount = issues.filter(c =>
        c.issues.includes('Geen doelgroep signalen geconfigureerd')
      ).length;
      const narrowTargetingCount = issues.filter(c =>
        c.issues.some(i => i.includes('te smalle targeting'))
      ).length;

      logger.info(`Found ${count} campaigns with audience issues`, {
        clientName: config.clientName,
        noAudienceCount,
        narrowTargetingCount,
      });

      return this.warningResult(
        count,
        {
          title: 'Google Ads: doelgroep targeting issues',
          shortDescription: `${count} campagne${count > 1 ? 's' : ''} met doelgroep problemen`,
          impact: noAudienceCount > 0
            ? 'Campagnes zonder doelgroep signalen kunnen minder effectief targeten'
            : 'Te smalle targeting beperkt het bereik en kan kosten verhogen',
          suggestedActions: [
            'Voeg remarketing lijsten toe als observation audiences',
            'Configureer in-market audiences voor relevante categorieën',
            'Overweeg combined audiences voor betere targeting',
            'Verbreed te smalle audiences voor meer bereik',
            'Gebruik audience insights om nieuwe doelgroepen te vinden',
          ],
          severity: noAudienceCount > 2 ? 'medium' : 'low',
          details: {
            campaignsWithIssues: count,
            noAudienceCount,
            narrowTargetingCount,
          },
        },
        {
          campaigns: issues.slice(0, 10),
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
