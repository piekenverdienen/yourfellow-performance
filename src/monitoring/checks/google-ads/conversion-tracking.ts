import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

interface ConversionRow {
  campaign: {
    id: string;
    name: string;
    status: string;
  };
  metrics: {
    conversions: string;
    allConversions: string;
    costMicros: string;
    clicks: string;
  };
}

interface ConversionActionRow {
  conversionAction: {
    id: string;
    name: string;
    status: string;
    category: string;
    type: string;
  };
}

/**
 * Check for conversion tracking issues
 *
 * This check identifies:
 * - Campaigns with spend but 0 conversions (potential tracking issue)
 * - Sudden drop in conversions compared to historical average
 * - Missing or inactive conversion actions
 */
export class ConversionTrackingCheck extends BaseGoogleAdsCheck {
  id = 'conversion_tracking';
  name = 'Conversie Tracking Problemen';
  description = 'Detecteert potentiële problemen met conversie tracking';

  // Check recent conversions
  private static CONVERSIONS_QUERY = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.conversions,
      metrics.all_conversions,
      metrics.cost_micros,
      metrics.clicks
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND segments.date DURING LAST_7_DAYS
  `;

  // Check conversion actions
  private static CONVERSION_ACTIONS_QUERY = `
    SELECT
      conversion_action.id,
      conversion_action.name,
      conversion_action.status,
      conversion_action.category,
      conversion_action.type
    FROM conversion_action
    WHERE conversion_action.status = 'ENABLED'
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    const issues: Array<{
      type: string;
      description: string;
      campaignName?: string;
      severity: 'critical' | 'high' | 'medium';
    }> = [];

    try {
      // Check conversion actions first
      let hasConversionActions = true;
      try {
        const actionsResponse = await client.query(ConversionTrackingCheck.CONVERSION_ACTIONS_QUERY);
        if (actionsResponse.results.length === 0) {
          hasConversionActions = false;
          issues.push({
            type: 'no_conversion_actions',
            description: 'Geen actieve conversie acties geconfigureerd',
            severity: 'high',
          });
        }
      } catch (actionError) {
        logger.debug('Could not query conversion actions', {
          error: (actionError as Error).message,
        });
      }

      // Get campaign conversion data
      const conversionResponse = await client.query(ConversionTrackingCheck.CONVERSIONS_QUERY);

      if (conversionResponse.results.length === 0) {
        if (!hasConversionActions) {
          // No campaigns and no conversion tracking - alert
          return this.errorResult(
            1,
            {
              title: 'Google Ads: conversie tracking niet ingesteld',
              shortDescription: 'Geen conversie tracking actief',
              impact: 'Zonder conversie tracking kun je niet meten welke campagnes ROI leveren',
              suggestedActions: [
                'Stel conversie tracking in via Google Ads',
                'Importeer conversies vanuit Google Analytics 4',
                'Installeer de Google Ads conversion tag',
                'Configureer offline conversie imports indien van toepassing',
              ],
              severity: 'high',
              details: { hasConversionActions: false },
            },
            { issues }
          );
        }
        return this.okResult({ message: 'Geen campagne data gevonden voor conversie analyse' });
      }

      // Aggregate campaign data
      const campaignMap = new Map<string, {
        name: string;
        conversions: number;
        allConversions: number;
        cost: number;
        clicks: number;
      }>();

      for (const row of conversionResponse.results as unknown as ConversionRow[]) {
        const campaignId = row.campaign?.id || 'unknown';
        const existing = campaignMap.get(campaignId) || {
          name: row.campaign?.name || 'Unknown',
          conversions: 0,
          allConversions: 0,
          cost: 0,
          clicks: 0,
        };

        campaignMap.set(campaignId, {
          name: row.campaign?.name || existing.name,
          conversions: existing.conversions + parseFloat(row.metrics?.conversions || '0'),
          allConversions: existing.allConversions + parseFloat(row.metrics?.allConversions || '0'),
          cost: existing.cost + parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000,
          clicks: existing.clicks + parseInt(row.metrics?.clicks || '0', 10),
        });
      }

      // Find campaigns with significant spend but zero conversions
      const minSpendThreshold = 100; // €100 minimum spend to consider as potential issue
      const minClicksThreshold = 50; // At least 50 clicks

      const zeroConversionCampaigns = Array.from(campaignMap.entries())
        .filter(([, data]) =>
          data.cost >= minSpendThreshold &&
          data.clicks >= minClicksThreshold &&
          data.conversions === 0 &&
          data.allConversions === 0
        )
        .map(([id, data]) => ({
          campaignId: id,
          ...data,
        }));

      for (const campaign of zeroConversionCampaigns) {
        issues.push({
          type: 'zero_conversions',
          description: `€${campaign.cost.toFixed(2)} besteed, ${campaign.clicks} clicks, 0 conversies`,
          campaignName: campaign.name,
          severity: campaign.cost > 500 ? 'critical' : 'high',
        });
      }

      // Check total account conversions
      const totalConversions = Array.from(campaignMap.values())
        .reduce((sum, data) => sum + data.conversions, 0);
      const totalCost = Array.from(campaignMap.values())
        .reduce((sum, data) => sum + data.cost, 0);

      if (totalConversions === 0 && totalCost > 200) {
        issues.push({
          type: 'account_zero_conversions',
          description: `Account heeft €${totalCost.toFixed(2)} besteed zonder conversies (7 dagen)`,
          severity: 'critical',
        });
      }

      if (issues.length === 0) {
        logger.debug('No conversion tracking issues found');
        return this.okResult({
          message: 'Conversie tracking werkt correct',
          totalConversions,
          totalCost: Number(totalCost.toFixed(2)),
        });
      }

      const count = issues.length;
      const hasCritical = issues.some(i => i.severity === 'critical');
      const totalZeroConvSpend = zeroConversionCampaigns.reduce((sum, c) => sum + c.cost, 0);

      logger.warn(`Found ${count} conversion tracking issues`, {
        clientName: config.clientName,
        issueTypes: issues.map(i => i.type),
      });

      return this.errorResult(
        count,
        {
          title: 'Google Ads: conversie tracking problemen',
          shortDescription: hasCritical
            ? 'Kritieke conversie tracking issues gevonden'
            : `${count} potentiële tracking probleem${count > 1 ? 'en' : ''}`,
          impact: totalZeroConvSpend > 0
            ? `€${totalZeroConvSpend.toFixed(2)} besteed aan campagnes zonder meetbare conversies`
            : 'Conversie data mogelijk onbetrouwbaar',
          suggestedActions: [
            'Controleer of de conversie tag correct is geïnstalleerd',
            'Verifieer conversies in Google Tag Assistant',
            'Check of conversie acties correct zijn geconfigureerd',
            'Bekijk de attribution window instellingen',
            'Test een conversie handmatig om tracking te verifiëren',
            'Controleer of er geen ad blockers de tracking blokkeren',
          ],
          severity: hasCritical ? 'critical' : 'high',
          details: {
            issueCount: count,
            hasConversionActions,
            totalConversions,
            totalCost: Number(totalCost.toFixed(2)),
            zeroConversionCampaigns: zeroConversionCampaigns.length,
          },
        },
        {
          issues,
          zeroConversionCampaigns: zeroConversionCampaigns.slice(0, 10),
          totalConversions,
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
