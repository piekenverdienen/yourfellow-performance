import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsClient } from '@/monitoring/google-ads';
import { createLogger } from '@/monitoring/utils/logger';

const logger = createLogger('google-ads-pmax');

interface AssetGroupPerformance {
  id: string;
  name: string;
  campaignName: string;
  status: string;
  strength: string;
  conversions: number;
  conversionsValue: number;
  cost: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cvr: number;
  roas: number;
}

interface SearchThemePerformance {
  theme: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
}

interface PMaxCampaign {
  id: string;
  name: string;
  status: string;
  budgetLimited: boolean;
  budget: number;
  recommendedBudget: number | null;
  conversions: number;
  conversionsValue: number;
  cost: number;
  roas: number;
  assetGroupCount: number;
}

interface PMaxAnalysisResponse {
  success: boolean;
  data?: {
    campaigns: PMaxCampaign[];
    assetGroups: AssetGroupPerformance[];
    searchThemes: SearchThemePerformance[];
    signals: {
      budgetLimitedCampaigns: number;
      lowStrengthAssetGroups: number;
      topPerformingAssetGroups: AssetGroupPerformance[];
      underperformingAssetGroups: AssetGroupPerformance[];
    };
    summary: {
      totalCampaigns: number;
      totalConversions: number;
      totalCost: number;
      totalRoas: number;
    };
    accountName: string;
    currency: string;
  };
  error?: string;
}

interface CampaignRow {
  campaign: {
    id: string;
    name: string;
    status: string;
    servingStatus: string;
  };
  campaignBudget?: {
    amountMicros: string;
    recommendedBudgetAmountMicros?: string;
  };
  metrics: {
    conversions: string;
    conversionsValue: string;
    costMicros: string;
    clicks: string;
    impressions: string;
  };
}

interface AssetGroupRow {
  assetGroup: {
    id: string;
    name: string;
    status: string;
    adStrength: string;
  };
  campaign: {
    id: string;
    name: string;
  };
  metrics: {
    conversions: string;
    conversionsValue: string;
    costMicros: string;
    clicks: string;
    impressions: string;
  };
}

interface SearchThemeRow {
  assetGroupSearchThemeView?: {
    searchTerm?: string;
  };
  campaign: {
    name: string;
  };
  metrics: {
    impressions: string;
    clicks: string;
    conversions: string;
    costMicros: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Fetch client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, settings')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
    }

    const googleAdsSettings = client.settings?.googleAds;
    if (!googleAdsSettings?.customerId) {
      return NextResponse.json(
        { success: false, error: 'Google Ads not configured' },
        { status: 400 }
      );
    }

    // Fetch credentials
    const { data: appSettings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'google_ads_credentials')
      .single();

    if (!appSettings?.value) {
      return NextResponse.json(
        { success: false, error: 'Google Ads credentials not configured' },
        { status: 500 }
      );
    }

    const credentials = appSettings.value;
    const googleAdsClient = new GoogleAdsClient({
      credentials: {
        type: 'service_account',
        developerToken: credentials.developerToken,
        serviceAccountEmail: credentials.serviceAccountEmail,
        privateKey: credentials.privateKey,
        loginCustomerId: credentials.loginCustomerId,
      },
      customerId: googleAdsSettings.customerId,
      logger,
    });

    const customerInfo = await googleAdsClient.getCustomerInfo();
    const currency = customerInfo?.currencyCode || 'EUR';
    const accountName = customerInfo?.descriptiveName || client.name;

    // Query PMax campaigns
    const campaignsQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.serving_status,
        campaign_budget.amount_micros,
        campaign_budget.recommended_budget_amount_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions
      FROM campaign
      WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
        AND campaign.status != 'REMOVED'
        AND segments.date DURING LAST_7_DAYS
    `;

    // Query Asset Groups
    const assetGroupsQuery = `
      SELECT
        asset_group.id,
        asset_group.name,
        asset_group.status,
        asset_group.ad_strength,
        campaign.id,
        campaign.name,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions
      FROM asset_group
      WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
        AND campaign.status = 'ENABLED'
        AND segments.date DURING LAST_7_DAYS
    `;

    // Note: Search themes require a different approach in v22
    // We'll query the search_term_view with campaign filter instead
    const searchThemesQuery = `
      SELECT
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros
      FROM campaign
      WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
        AND campaign.status = 'ENABLED'
        AND segments.date DURING LAST_7_DAYS
    `;

    // Execute queries in parallel
    const [campaignsResponse, assetGroupsResponse] = await Promise.all([
      googleAdsClient.query(campaignsQuery).catch(err => {
        logger.warn('Failed to query PMax campaigns', { error: err.message });
        return { results: [] };
      }),
      googleAdsClient.query(assetGroupsQuery).catch(err => {
        logger.warn('Failed to query asset groups', { error: err.message });
        return { results: [] };
      }),
    ]);

    // Process campaigns
    const campaignsMap = new Map<string, PMaxCampaign>();
    for (const row of campaignsResponse.results as unknown as CampaignRow[]) {
      const campaignId = row.campaign?.id || 'unknown';
      const existing = campaignsMap.get(campaignId);

      const conversions = parseFloat(row.metrics?.conversions || '0');
      const conversionsValue = parseFloat(row.metrics?.conversionsValue || '0');
      const cost = parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
      const budget = parseInt(row.campaignBudget?.amountMicros || '0', 10) / 1_000_000;
      const recommendedBudget = row.campaignBudget?.recommendedBudgetAmountMicros
        ? parseInt(row.campaignBudget.recommendedBudgetAmountMicros, 10) / 1_000_000
        : null;

      if (existing) {
        existing.conversions += conversions;
        existing.conversionsValue += conversionsValue;
        existing.cost += cost;
      } else {
        campaignsMap.set(campaignId, {
          id: campaignId,
          name: row.campaign?.name || 'Unknown',
          status: row.campaign?.status || 'UNKNOWN',
          budgetLimited: row.campaign?.servingStatus === 'ELIGIBLE_LIMITED' ||
            (recommendedBudget !== null && recommendedBudget > budget * 1.2),
          budget,
          recommendedBudget,
          conversions,
          conversionsValue,
          cost,
          roas: 0, // Calculate after aggregation
          assetGroupCount: 0, // Will be updated after asset group processing
        });
      }
    }

    // Calculate ROAS for campaigns
    const campaigns: PMaxCampaign[] = Array.from(campaignsMap.values()).map(campaign => ({
      ...campaign,
      roas: campaign.cost > 0 ? campaign.conversionsValue / campaign.cost : 0,
    }));

    // Process asset groups
    const assetGroupsMap = new Map<string, AssetGroupPerformance>();
    const campaignAssetGroupCounts = new Map<string, number>();

    for (const row of assetGroupsResponse.results as unknown as AssetGroupRow[]) {
      const assetGroupId = row.assetGroup?.id || 'unknown';
      const campaignId = row.campaign?.id || 'unknown';

      // Count asset groups per campaign
      campaignAssetGroupCounts.set(
        campaignId,
        (campaignAssetGroupCounts.get(campaignId) || 0) + 1
      );

      const existing = assetGroupsMap.get(assetGroupId);

      const conversions = parseFloat(row.metrics?.conversions || '0');
      const conversionsValue = parseFloat(row.metrics?.conversionsValue || '0');
      const cost = parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
      const clicks = parseInt(row.metrics?.clicks || '0', 10);
      const impressions = parseInt(row.metrics?.impressions || '0', 10);

      if (existing) {
        existing.conversions += conversions;
        existing.conversionsValue += conversionsValue;
        existing.cost += cost;
        existing.clicks += clicks;
        existing.impressions += impressions;
      } else {
        assetGroupsMap.set(assetGroupId, {
          id: assetGroupId,
          name: row.assetGroup?.name || 'Unknown',
          campaignName: row.campaign?.name || 'Unknown',
          status: row.assetGroup?.status || 'UNKNOWN',
          strength: row.assetGroup?.adStrength || 'UNSPECIFIED',
          conversions,
          conversionsValue,
          cost,
          clicks,
          impressions,
          ctr: 0,
          cvr: 0,
          roas: 0,
        });
      }
    }

    // Calculate derived metrics for asset groups
    const assetGroups: AssetGroupPerformance[] = Array.from(assetGroupsMap.values()).map(ag => ({
      ...ag,
      ctr: ag.impressions > 0 ? ag.clicks / ag.impressions : 0,
      cvr: ag.clicks > 0 ? ag.conversions / ag.clicks : 0,
      roas: ag.cost > 0 ? ag.conversionsValue / ag.cost : 0,
    }));

    // Update campaign asset group counts
    campaigns.forEach(campaign => {
      campaign.assetGroupCount = campaignAssetGroupCounts.get(campaign.id) || 0;
    });

    // Generate signals
    const budgetLimitedCampaigns = campaigns.filter(c => c.budgetLimited).length;
    const lowStrengthAssetGroups = assetGroups.filter(ag =>
      ['POOR', 'AVERAGE', 'UNSPECIFIED'].includes(ag.strength)
    ).length;

    const topPerformingAssetGroups = assetGroups
      .filter(ag => ag.conversions > 0)
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 5);

    const underperformingAssetGroups = assetGroups
      .filter(ag => ag.cost > 0 && ag.conversions === 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    // Calculate summary
    const summary = {
      totalCampaigns: campaigns.length,
      totalConversions: campaigns.reduce((sum, c) => sum + c.conversions, 0),
      totalCost: campaigns.reduce((sum, c) => sum + c.cost, 0),
      totalRoas: 0,
    };
    summary.totalRoas = summary.totalCost > 0
      ? campaigns.reduce((sum, c) => sum + c.conversionsValue, 0) / summary.totalCost
      : 0;

    const response: PMaxAnalysisResponse = {
      success: true,
      data: {
        campaigns: campaigns.sort((a, b) => b.conversions - a.conversions),
        assetGroups: assetGroups.sort((a, b) => b.conversions - a.conversions),
        searchThemes: [], // Would need different API access for search themes
        signals: {
          budgetLimitedCampaigns,
          lowStrengthAssetGroups,
          topPerformingAssetGroups,
          underperformingAssetGroups,
        },
        summary,
        accountName,
        currency,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error fetching PMax analysis', {
      error: (error as Error).message,
      clientId,
    });
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
