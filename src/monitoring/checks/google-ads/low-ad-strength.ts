import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

interface RsaAdRow {
  adGroupAd: {
    ad: {
      id: string;
      name: string;
      type: string;
      responsiveSearchAd?: {
        headlines: Array<{ text: string; pinnedField?: string }>;
        descriptions: Array<{ text: string; pinnedField?: string }>;
      };
    };
    adStrength: string;
    status: string;
    policySummary?: {
      approvalStatus: string;
    };
  };
  adGroup: {
    id: string;
    name: string;
  };
  campaign: {
    id: string;
    name: string;
  };
  metrics: {
    impressions: string;
    clicks: string;
    costMicros: string;
  };
}

/**
 * Check for Responsive Search Ads with low ad strength
 *
 * This check identifies RSAs where:
 * - Ad strength is POOR or AVERAGE
 * - The ad is active and receiving impressions
 * - Low ad strength impacts ad performance and costs
 */
export class LowAdStrengthCheck extends BaseGoogleAdsCheck {
  id = 'low_ad_strength';
  name = 'Lage Advertentie Sterkte';
  description = 'Detecteert RSA advertenties met lage ad strength die beter kunnen presteren';

  private static GAQL_QUERY = `
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad.name,
      ad_group_ad.ad.type,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad_strength,
      ad_group_ad.status,
      ad_group_ad.policy_summary.approval_status,
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM ad_group_ad
    WHERE ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
      AND ad_group_ad.status = 'ENABLED'
      AND campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND segments.date DURING LAST_30_DAYS
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      const response = await client.query(LowAdStrengthCheck.GAQL_QUERY);

      if (response.results.length === 0) {
        logger.debug('No RSA ads found');
        return this.okResult({ message: 'Geen actieve RSA advertenties gevonden' });
      }

      // Aggregate data per ad
      const adMap = new Map<string, {
        adName: string;
        adStrength: string;
        adGroupName: string;
        campaignName: string;
        headlineCount: number;
        descriptionCount: number;
        impressions: number;
        clicks: number;
        cost: number;
      }>();

      for (const row of response.results as RsaAdRow[]) {
        const adId = row.adGroupAd?.ad?.id || 'unknown';
        const existing = adMap.get(adId);

        const rsa = row.adGroupAd?.ad?.responsiveSearchAd;

        if (!existing) {
          adMap.set(adId, {
            adName: row.adGroupAd?.ad?.name || `Ad ${adId}`,
            adStrength: row.adGroupAd?.adStrength || 'UNKNOWN',
            adGroupName: row.adGroup?.name || 'Unknown Ad Group',
            campaignName: row.campaign?.name || 'Unknown Campaign',
            headlineCount: rsa?.headlines?.length || 0,
            descriptionCount: rsa?.descriptions?.length || 0,
            impressions: parseInt(row.metrics?.impressions || '0', 10),
            clicks: parseInt(row.metrics?.clicks || '0', 10),
            cost: parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000,
          });
        } else {
          // Accumulate metrics
          existing.impressions += parseInt(row.metrics?.impressions || '0', 10);
          existing.clicks += parseInt(row.metrics?.clicks || '0', 10);
          existing.cost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
        }
      }

      // Filter for ads with POOR or AVERAGE strength that have meaningful impressions
      const lowStrengthAds = Array.from(adMap.entries())
        .filter(([, data]) =>
          ['POOR', 'AVERAGE', 'UNSPECIFIED'].includes(data.adStrength) &&
          data.impressions >= 100
        )
        .map(([id, data]) => ({
          adId: id,
          ...data,
          strengthLabel: this.getStrengthLabel(data.adStrength),
          recommendations: this.getRecommendations(data),
        }))
        .sort((a, b) => b.cost - a.cost);

      if (lowStrengthAds.length === 0) {
        const totalAds = adMap.size;
        const excellentCount = Array.from(adMap.values())
          .filter(a => a.adStrength === 'EXCELLENT').length;

        logger.debug('No low ad strength issues found');
        return this.okResult({
          message: 'Alle actieve RSA advertenties hebben goede ad strength',
          totalAds,
          excellentCount,
        });
      }

      const count = lowStrengthAds.length;
      const poorCount = lowStrengthAds.filter(a => a.adStrength === 'POOR').length;
      const totalSpendOnLowStrength = lowStrengthAds.reduce((sum, a) => sum + a.cost, 0);

      logger.info(`Found ${count} RSA ads with low ad strength`, {
        clientName: config.clientName,
        poorCount,
        totalSpendOnLowStrength: totalSpendOnLowStrength.toFixed(2),
      });

      return this.errorResult(
        count,
        {
          title: 'Google Ads: RSA advertenties met lage sterkte',
          shortDescription: `${count} RSA${count > 1 ? "'s" : ''} met ${poorCount > 0 ? 'POOR/' : ''}AVERAGE sterkte`,
          impact: `€${totalSpendOnLowStrength.toFixed(2)} besteed aan advertenties met lage sterkte (30 dagen). Betere ad strength = meer impressies en lagere kosten.`,
          suggestedActions: [
            'Voeg meer unieke headlines toe (minimaal 8-10 aanbevolen)',
            'Voeg meer descriptions toe (minimaal 3-4 aanbevolen)',
            'Zorg voor variatie in headlines (niet te vergelijkbaar)',
            'Gebruik keywords in headlines voor relevantie',
            'Voeg een sterke CTA toe in minimaal één headline',
            'Vermijd te veel gepinde assets - laat Google optimaliseren',
          ],
          severity: poorCount > 3 || totalSpendOnLowStrength > 500 ? 'high' : 'medium',
          details: {
            lowStrengthCount: count,
            poorCount,
            averageCount: count - poorCount,
            totalSpendOnLowStrength: Number(totalSpendOnLowStrength.toFixed(2)),
          },
        },
        {
          ads: lowStrengthAds.slice(0, 15),
          totalCount: count,
          strengthDistribution: {
            poor: poorCount,
            average: count - poorCount,
          },
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
   * Get human-readable strength label
   */
  private getStrengthLabel(strength: string): string {
    const labels: Record<string, string> = {
      POOR: 'Slecht',
      AVERAGE: 'Gemiddeld',
      GOOD: 'Goed',
      EXCELLENT: 'Uitstekend',
      UNSPECIFIED: 'Onbekend',
    };
    return labels[strength] || strength;
  }

  /**
   * Get specific recommendations based on ad data
   */
  private getRecommendations(data: {
    headlineCount: number;
    descriptionCount: number;
  }): string[] {
    const recs: string[] = [];

    if (data.headlineCount < 8) {
      recs.push(`Voeg ${8 - data.headlineCount} headlines toe (nu ${data.headlineCount})`);
    }
    if (data.headlineCount < 15) {
      recs.push(`Maximaliseer headlines tot 15 voor optimale rotatie`);
    }
    if (data.descriptionCount < 4) {
      recs.push(`Voeg ${4 - data.descriptionCount} descriptions toe (nu ${data.descriptionCount})`);
    }

    return recs;
  }
}
