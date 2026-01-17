import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsClient } from '@/monitoring/google-ads';
import { InsightEngine } from '@/monitoring/insights/insight-engine';
import { createLogger } from '@/monitoring/utils/logger';
import type { InsightData, CampaignData } from '@/monitoring/insights/insight-engine';

const logger = createLogger('google-ads-insights');

interface MetricsRow {
  metrics: {
    conversions: string;
    conversionsValue: string;
    costMicros: string;
    clicks: string;
    impressions: string;
    searchImpressionShare?: string;
    searchBudgetLostImpressionShare?: string;
    searchRankLostImpressionShare?: string;
  };
}

interface CampaignRow {
  campaign: {
    id: string;
    name: string;
    advertisingChannelType: string;
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
    searchBudgetLostImpressionShare?: string;
  };
}

// GET: Fetch insights for a client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status')?.split(',') || ['new', 'picked_up'];
  const type = searchParams.get('type') || undefined;
  const impact = searchParams.get('impact') || undefined;
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    let query = supabase
      .from('insights')
      .select('*')
      .eq('client_id', clientId)
      .in('status', status)
      .order('impact', { ascending: false })
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq('type', type);
    }
    if (impact) {
      query = query.eq('impact', impact);
    }

    const { data: insights, error } = await query;

    if (error) {
      throw error;
    }

    // Calculate summary
    const summary = {
      total: insights?.length || 0,
      by_type: {} as Record<string, number>,
      by_impact: {} as Record<string, number>,
      new_count: insights?.filter(i => i.status === 'new').length || 0,
    };

    for (const insight of insights || []) {
      summary.by_type[insight.type] = (summary.by_type[insight.type] || 0) + 1;
      summary.by_impact[insight.impact] = (summary.by_impact[insight.impact] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      insights: insights || [],
      summary,
    });
  } catch (error) {
    logger.error('Error fetching insights', {
      error: (error as Error).message,
      clientId,
    });
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST: Generate new insights
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;

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

    // Fetch account-level metrics for current and previous period
    const accountCurrentQuery = `
      SELECT
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.search_impression_share,
        metrics.search_budget_lost_impression_share,
        metrics.search_rank_lost_impression_share
      FROM customer
      WHERE segments.date DURING LAST_7_DAYS
    `;

    const accountPreviousQuery = `
      SELECT
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_micros
      FROM customer
      WHERE segments.date DURING LAST_14_DAYS
    `;

    const campaignsQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.advertising_channel_type,
        campaign.status,
        campaign.serving_status,
        campaign_budget.amount_micros,
        campaign_budget.recommended_budget_amount_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_micros,
        metrics.search_budget_lost_impression_share
      FROM campaign
      WHERE campaign.status = 'ENABLED'
        AND segments.date DURING LAST_7_DAYS
    `;

    const campaignsPreviousQuery = `
      SELECT
        campaign.id,
        metrics.conversions,
        metrics.cost_micros
      FROM campaign
      WHERE campaign.status = 'ENABLED'
        AND segments.date DURING LAST_14_DAYS
    `;

    const [
      accountCurrentRes,
      accountFullRes,
      campaignsCurrentRes,
      campaignsFullRes,
    ] = await Promise.all([
      googleAdsClient.query(accountCurrentQuery),
      googleAdsClient.query(accountPreviousQuery),
      googleAdsClient.query(campaignsQuery),
      googleAdsClient.query(campaignsPreviousQuery),
    ]);

    // Aggregate account metrics
    const accountCurrent = aggregateAccountMetrics(accountCurrentRes.results as unknown as MetricsRow[]);
    const accountFull = aggregateAccountMetrics(accountFullRes.results as unknown as MetricsRow[]);
    const accountPrevious = {
      conversions: accountFull.conversions - accountCurrent.conversions,
      cost: accountFull.cost - accountCurrent.cost,
    };

    // Process campaign data
    const campaignsCurrent = new Map<string, CampaignData>();
    for (const row of campaignsCurrentRes.results as unknown as CampaignRow[]) {
      const campaignId = row.campaign?.id || 'unknown';
      const existing = campaignsCurrent.get(campaignId);

      const conversions = parseFloat(row.metrics?.conversions || '0');
      const cost = parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
      const budget = parseInt(row.campaignBudget?.amountMicros || '0', 10) / 1_000_000;
      const recommendedBudget = row.campaignBudget?.recommendedBudgetAmountMicros
        ? parseInt(row.campaignBudget.recommendedBudgetAmountMicros, 10) / 1_000_000
        : null;
      const impressionShareLostBudget = parseFloat(row.metrics?.searchBudgetLostImpressionShare || '0') * 100;

      if (existing) {
        existing.conversions += conversions;
        existing.cost += cost;
      } else {
        campaignsCurrent.set(campaignId, {
          id: campaignId,
          name: row.campaign?.name || 'Unknown',
          type: row.campaign?.advertisingChannelType || 'UNKNOWN',
          status: row.campaign?.status || 'UNKNOWN',
          conversions,
          previousConversions: 0, // Will be set later
          cost,
          previousCost: 0,
          impressionShareLostBudget,
          budgetLimited: row.campaign?.servingStatus === 'ELIGIBLE_LIMITED' ||
            (recommendedBudget !== null && recommendedBudget > budget * 1.2),
          budget,
          recommendedBudget,
        });
      }
    }

    // Process previous campaign data
    const campaignsPrevious = new Map<string, { conversions: number; cost: number }>();
    for (const row of campaignsFullRes.results as unknown as { campaign: { id: string }; metrics: { conversions: string; costMicros: string } }[]) {
      const campaignId = row.campaign?.id || 'unknown';
      const existing = campaignsPrevious.get(campaignId);

      const conversions = parseFloat(row.metrics?.conversions || '0');
      const cost = parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;

      if (existing) {
        existing.conversions += conversions;
        existing.cost += cost;
      } else {
        campaignsPrevious.set(campaignId, { conversions, cost });
      }
    }

    // Calculate previous period for campaigns (full - current)
    for (const [id, campaign] of campaignsCurrent) {
      const fullData = campaignsPrevious.get(id);
      if (fullData) {
        campaign.previousConversions = fullData.conversions - campaign.conversions;
        campaign.previousCost = fullData.cost - campaign.cost;
      }
    }

    // Build insight data
    const insightData: InsightData = {
      account: {
        conversions: accountCurrent.conversions,
        previousConversions: accountPrevious.conversions,
        cost: accountCurrent.cost,
        previousCost: accountPrevious.cost,
        cpa: accountCurrent.conversions > 0 ? accountCurrent.cost / accountCurrent.conversions : 0,
        previousCpa: accountPrevious.conversions > 0 ? accountPrevious.cost / accountPrevious.conversions : 0,
        roas: accountCurrent.cost > 0 ? accountCurrent.conversionsValue / accountCurrent.cost : 0,
        previousRoas: 0, // Would need conversion value for previous period
        impressionShareLostBudget: accountCurrent.impressionShareLostBudget,
        impressionShareLostRank: accountCurrent.impressionShareLostRank,
      },
      campaigns: Array.from(campaignsCurrent.values()),
      clientId,
      clientName: client.name,
      currency,
    };

    // Create insight engine and generate insights
    const insightEngine = new InsightEngine({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!,
      logger,
    });

    const insights = await insightEngine.generateInsights(insightData);
    const { created, skipped } = await insightEngine.saveInsights(clientId, insights);

    // Auto-resolve insights that no longer apply
    const activeRuleIds = insights.map(i => i.ruleId);
    const resolved = await insightEngine.autoResolveStaleInsights(clientId, activeRuleIds);

    return NextResponse.json({
      success: true,
      generated: insights.length,
      created,
      skipped,
      resolved,
    });
  } catch (error) {
    logger.error('Error generating insights', {
      error: (error as Error).message,
      clientId,
    });
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

function aggregateAccountMetrics(rows: MetricsRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.conversions += parseFloat(row.metrics?.conversions || '0');
      acc.conversionsValue += parseFloat(row.metrics?.conversionsValue || '0');
      acc.cost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
      // Take max for impression share metrics (they're already percentages)
      const isLostBudget = parseFloat(row.metrics?.searchBudgetLostImpressionShare || '0') * 100;
      const isLostRank = parseFloat(row.metrics?.searchRankLostImpressionShare || '0') * 100;
      if (isLostBudget > acc.impressionShareLostBudget) acc.impressionShareLostBudget = isLostBudget;
      if (isLostRank > acc.impressionShareLostRank) acc.impressionShareLostRank = isLostRank;
      return acc;
    },
    { conversions: 0, conversionsValue: 0, cost: 0, impressionShareLostBudget: 0, impressionShareLostRank: 0 }
  );
}
