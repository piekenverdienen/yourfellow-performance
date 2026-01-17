import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsClient } from '@/monitoring/google-ads';
import { createLogger } from '@/monitoring/utils/logger';

const logger = createLogger('google-ads-performance');

// Comparison modes
type ComparisonMode = 'today_vs_yesterday' | 'last_7_vs_previous_7' | 'mtd_vs_previous_month';
type BreakdownDimension = 'campaign' | 'campaign_type' | 'brand_nonbrand' | 'device';

interface PerformanceMetrics {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionsValue: number;
}

interface BreakdownItem {
  id: string;
  name: string;
  current: PerformanceMetrics;
  previous: PerformanceMetrics;
  change: {
    conversions: number;
    conversionsPercent: number;
    cost: number;
    costPercent: number;
  };
  impact: number; // Absolute conversion change for sorting
}

interface PerformanceResponse {
  success: boolean;
  data?: {
    comparisonMode: ComparisonMode;
    period: {
      current: { start: string; end: string; label: string };
      previous: { start: string; end: string; label: string };
    };
    totals: {
      current: PerformanceMetrics & { cpa: number; roas: number; ctr: number; cvr: number };
      previous: PerformanceMetrics & { cpa: number; roas: number; ctr: number; cvr: number };
      change: {
        spend: number;
        spendPercent: number;
        conversions: number;
        conversionsPercent: number;
        conversionsValue: number;
        conversionsValuePercent: number;
        cpa: number;
        cpaPercent: number;
        roas: number;
        roasPercent: number;
        ctr: number;
        ctrPercent: number;
        cvr: number;
        cvrPercent: number;
      };
    };
    autoHighlight: string | null;
    breakdown?: BreakdownItem[];
    winners?: BreakdownItem[];
    losers?: BreakdownItem[];
    accountName: string;
    currency: string;
  };
  error?: string;
}

interface MetricsRow {
  campaign?: {
    id: string;
    name: string;
    advertisingChannelType?: string;
  };
  segments?: {
    device?: string;
    date?: string;
  };
  metrics: {
    costMicros: string;
    conversions: string;
    conversionsValue: string;
    clicks: string;
    impressions: string;
  };
}

function getDateRanges(mode: ComparisonMode): { current: { gaql: string; start: Date; end: Date }; previous: { gaql: string; start: Date; end: Date } } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (mode) {
    case 'today_vs_yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const dayBefore = new Date(yesterday);
      dayBefore.setDate(dayBefore.getDate() - 1);

      return {
        current: {
          gaql: 'YESTERDAY',
          start: yesterday,
          end: yesterday,
        },
        previous: {
          gaql: `segments.date = '${formatDateForGaql(dayBefore)}'`,
          start: dayBefore,
          end: dayBefore,
        },
      };
    }
    case 'last_7_vs_previous_7': {
      const currentEnd = new Date(today);
      currentEnd.setDate(currentEnd.getDate() - 1);
      const currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() - 6);
      const previousEnd = new Date(currentStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
      const previousStart = new Date(previousEnd);
      previousStart.setDate(previousStart.getDate() - 6);

      return {
        current: { gaql: 'LAST_7_DAYS', start: currentStart, end: currentEnd },
        previous: {
          gaql: `segments.date BETWEEN '${formatDateForGaql(previousStart)}' AND '${formatDateForGaql(previousEnd)}'`,
          start: previousStart,
          end: previousEnd,
        },
      };
    }
    case 'mtd_vs_previous_month': {
      const currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const currentEnd = new Date(today);
      currentEnd.setDate(currentEnd.getDate() - 1);
      const previousStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const previousEnd = new Date(today.getFullYear(), today.getMonth(), 0); // Last day of previous month
      // Match same number of days
      const daysInCurrentPeriod = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const adjustedPreviousEnd = new Date(previousStart);
      adjustedPreviousEnd.setDate(adjustedPreviousEnd.getDate() + daysInCurrentPeriod - 1);

      return {
        current: {
          gaql: `segments.date BETWEEN '${formatDateForGaql(currentStart)}' AND '${formatDateForGaql(currentEnd)}'`,
          start: currentStart,
          end: currentEnd,
        },
        previous: {
          gaql: `segments.date BETWEEN '${formatDateForGaql(previousStart)}' AND '${formatDateForGaql(adjustedPreviousEnd)}'`,
          start: previousStart,
          end: adjustedPreviousEnd,
        },
      };
    }
  }
}

function formatDateForGaql(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (start.getTime() === end.getTime()) {
    return start.toLocaleDateString('nl-NL', options);
  }
  return `${start.toLocaleDateString('nl-NL', options)} - ${end.toLocaleDateString('nl-NL', options)}`;
}

function isBrandCampaign(campaignName: string): boolean {
  const brandKeywords = ['brand', 'merk', 'branded', 'own brand', 'eigen merk'];
  const lowerName = campaignName.toLowerCase();
  return brandKeywords.some(keyword => lowerName.includes(keyword));
}

function getCampaignTypeName(channelType: string): string {
  const typeMap: Record<string, string> = {
    'SEARCH': 'Search',
    'DISPLAY': 'Display',
    'SHOPPING': 'Shopping',
    'VIDEO': 'Video',
    'PERFORMANCE_MAX': 'Performance Max',
    'SMART': 'Smart',
    'LOCAL': 'Local',
    'DISCOVERY': 'Discovery',
    'DEMAND_GEN': 'Demand Gen',
  };
  return typeMap[channelType] || channelType;
}

function aggregateMetrics(rows: MetricsRow[]): PerformanceMetrics {
  return rows.reduce(
    (acc, row) => {
      acc.cost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
      acc.conversions += parseFloat(row.metrics?.conversions || '0');
      acc.conversionsValue += parseFloat(row.metrics?.conversionsValue || '0');
      acc.clicks += parseInt(row.metrics?.clicks || '0', 10);
      acc.impressions += parseInt(row.metrics?.impressions || '0', 10);
      return acc;
    },
    { cost: 0, conversions: 0, conversionsValue: 0, clicks: 0, impressions: 0 }
  );
}

function calculateDerivedMetrics(metrics: PerformanceMetrics) {
  return {
    ...metrics,
    cpa: metrics.conversions > 0 ? metrics.cost / metrics.conversions : 0,
    roas: metrics.cost > 0 ? metrics.conversionsValue / metrics.cost : 0,
    ctr: metrics.impressions > 0 ? metrics.clicks / metrics.impressions : 0,
    cvr: metrics.clicks > 0 ? metrics.conversions / metrics.clicks : 0,
  };
}

function calculateChange(current: number, previous: number): { absolute: number; percent: number } {
  return {
    absolute: current - previous,
    percent: previous !== 0 ? ((current - previous) / previous) * 100 : 0,
  };
}

function generateAutoHighlight(
  totals: PerformanceResponse['data']['totals'],
  breakdown?: BreakdownItem[]
): string | null {
  const { change } = totals;

  // Find the biggest issue
  if (change.conversionsPercent <= -15) {
    // Significant conversion drop
    let highlight = `Conversies ${change.conversionsPercent.toFixed(0)}%`;

    // Find the biggest contributor to the drop
    if (breakdown && breakdown.length > 0) {
      const worstPerformer = breakdown
        .filter(item => item.change.conversions < 0)
        .sort((a, b) => a.impact - b.impact)[0];

      if (worstPerformer) {
        highlight += `, vooral ${worstPerformer.name} (${worstPerformer.change.conversionsPercent.toFixed(0)}%)`;
      }
    }

    return highlight;
  }

  if (change.cpaPercent >= 20) {
    return `CPA ${change.cpaPercent > 0 ? '+' : ''}${change.cpaPercent.toFixed(0)}% gestegen`;
  }

  if (change.roasPercent <= -15) {
    return `ROAS ${change.roasPercent.toFixed(0)}% gedaald`;
  }

  // Positive highlight
  if (change.conversionsPercent >= 15) {
    return `Conversies +${change.conversionsPercent.toFixed(0)}% gestegen!`;
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const mode = (searchParams.get('mode') || 'last_7_vs_previous_7') as ComparisonMode;
  const dimensionParam = searchParams.get('breakdown') as BreakdownDimension | null;

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

    const dateRanges = getDateRanges(mode);
    const customerInfo = await googleAdsClient.getCustomerInfo();
    const currency = customerInfo?.currencyCode || 'EUR';
    const accountName = customerInfo?.descriptiveName || client.name;

    // Build queries based on breakdown dimension
    let selectFields = `
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.clicks,
      metrics.impressions
    `;

    let groupBy = '';
    if (dimensionParam) {
      switch (dimensionParam) {
        case 'campaign':
        case 'brand_nonbrand':
          selectFields = `campaign.id, campaign.name, ${selectFields}`;
          groupBy = 'campaign';
          break;
        case 'campaign_type':
          selectFields = `campaign.id, campaign.name, campaign.advertising_channel_type, ${selectFields}`;
          groupBy = 'campaign_type';
          break;
        case 'device':
          selectFields = `segments.device, ${selectFields}`;
          groupBy = 'device';
          break;
      }
    }

    // Query current period
    const currentQuery = dimensionParam
      ? `SELECT ${selectFields} FROM campaign WHERE campaign.status = 'ENABLED' AND segments.date DURING ${dateRanges.current.gaql}`
      : `SELECT ${selectFields} FROM customer WHERE segments.date DURING ${dateRanges.current.gaql}`;

    // Query previous period (need date condition in WHERE)
    const previousWhereCondition = dateRanges.previous.gaql.includes('segments.date')
      ? dateRanges.previous.gaql
      : `segments.date DURING ${dateRanges.previous.gaql}`;

    const previousQuery = dimensionParam
      ? `SELECT ${selectFields} FROM campaign WHERE campaign.status = 'ENABLED' AND ${previousWhereCondition}`
      : `SELECT ${selectFields} FROM customer WHERE ${previousWhereCondition}`;

    const [currentResponse, previousResponse] = await Promise.all([
      googleAdsClient.query(currentQuery),
      googleAdsClient.query(previousQuery),
    ]);

    // Calculate totals
    const currentMetrics = aggregateMetrics(currentResponse.results as unknown as MetricsRow[]);
    const previousMetrics = aggregateMetrics(previousResponse.results as unknown as MetricsRow[]);

    const currentWithDerived = calculateDerivedMetrics(currentMetrics);
    const previousWithDerived = calculateDerivedMetrics(previousMetrics);

    const totalsChange = {
      spend: currentMetrics.cost - previousMetrics.cost,
      spendPercent: calculateChange(currentMetrics.cost, previousMetrics.cost).percent,
      conversions: currentMetrics.conversions - previousMetrics.conversions,
      conversionsPercent: calculateChange(currentMetrics.conversions, previousMetrics.conversions).percent,
      conversionsValue: currentMetrics.conversionsValue - previousMetrics.conversionsValue,
      conversionsValuePercent: calculateChange(currentMetrics.conversionsValue, previousMetrics.conversionsValue).percent,
      cpa: currentWithDerived.cpa - previousWithDerived.cpa,
      cpaPercent: calculateChange(currentWithDerived.cpa, previousWithDerived.cpa).percent,
      roas: currentWithDerived.roas - previousWithDerived.roas,
      roasPercent: calculateChange(currentWithDerived.roas, previousWithDerived.roas).percent,
      ctr: currentWithDerived.ctr - previousWithDerived.ctr,
      ctrPercent: calculateChange(currentWithDerived.ctr, previousWithDerived.ctr).percent,
      cvr: currentWithDerived.cvr - previousWithDerived.cvr,
      cvrPercent: calculateChange(currentWithDerived.cvr, previousWithDerived.cvr).percent,
    };

    // Calculate breakdown if requested
    let breakdown: BreakdownItem[] | undefined;
    let winners: BreakdownItem[] | undefined;
    let losers: BreakdownItem[] | undefined;

    if (dimensionParam) {
      const currentRows = currentResponse.results as unknown as MetricsRow[];
      const previousRows = previousResponse.results as unknown as MetricsRow[];

      // Group by dimension
      const currentByDimension = new Map<string, { name: string; metrics: PerformanceMetrics }>();
      const previousByDimension = new Map<string, { name: string; metrics: PerformanceMetrics }>();

      for (const row of currentRows) {
        let key: string;
        let name: string;

        switch (dimensionParam) {
          case 'campaign':
            key = row.campaign?.id || 'unknown';
            name = row.campaign?.name || 'Unknown';
            break;
          case 'campaign_type':
            key = row.campaign?.advertisingChannelType || 'unknown';
            name = getCampaignTypeName(key);
            break;
          case 'brand_nonbrand':
            key = isBrandCampaign(row.campaign?.name || '') ? 'brand' : 'non_brand';
            name = key === 'brand' ? 'Brand' : 'Non-Brand';
            break;
          case 'device':
            key = row.segments?.device || 'unknown';
            name = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
            break;
          default:
            key = 'unknown';
            name = 'Unknown';
        }

        const existing = currentByDimension.get(key);
        if (existing) {
          existing.metrics.cost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
          existing.metrics.conversions += parseFloat(row.metrics?.conversions || '0');
          existing.metrics.conversionsValue += parseFloat(row.metrics?.conversionsValue || '0');
          existing.metrics.clicks += parseInt(row.metrics?.clicks || '0', 10);
          existing.metrics.impressions += parseInt(row.metrics?.impressions || '0', 10);
        } else {
          currentByDimension.set(key, {
            name,
            metrics: {
              cost: parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000,
              conversions: parseFloat(row.metrics?.conversions || '0'),
              conversionsValue: parseFloat(row.metrics?.conversionsValue || '0'),
              clicks: parseInt(row.metrics?.clicks || '0', 10),
              impressions: parseInt(row.metrics?.impressions || '0', 10),
            },
          });
        }
      }

      // Same for previous period
      for (const row of previousRows) {
        let key: string;
        let name: string;

        switch (dimensionParam) {
          case 'campaign':
            key = row.campaign?.id || 'unknown';
            name = row.campaign?.name || 'Unknown';
            break;
          case 'campaign_type':
            key = row.campaign?.advertisingChannelType || 'unknown';
            name = getCampaignTypeName(key);
            break;
          case 'brand_nonbrand':
            key = isBrandCampaign(row.campaign?.name || '') ? 'brand' : 'non_brand';
            name = key === 'brand' ? 'Brand' : 'Non-Brand';
            break;
          case 'device':
            key = row.segments?.device || 'unknown';
            name = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
            break;
          default:
            key = 'unknown';
            name = 'Unknown';
        }

        const existing = previousByDimension.get(key);
        if (existing) {
          existing.metrics.cost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
          existing.metrics.conversions += parseFloat(row.metrics?.conversions || '0');
          existing.metrics.conversionsValue += parseFloat(row.metrics?.conversionsValue || '0');
          existing.metrics.clicks += parseInt(row.metrics?.clicks || '0', 10);
          existing.metrics.impressions += parseInt(row.metrics?.impressions || '0', 10);
        } else {
          previousByDimension.set(key, {
            name,
            metrics: {
              cost: parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000,
              conversions: parseFloat(row.metrics?.conversions || '0'),
              conversionsValue: parseFloat(row.metrics?.conversionsValue || '0'),
              clicks: parseInt(row.metrics?.clicks || '0', 10),
              impressions: parseInt(row.metrics?.impressions || '0', 10),
            },
          });
        }
      }

      // Build breakdown items
      const allKeys = new Set([...currentByDimension.keys(), ...previousByDimension.keys()]);
      breakdown = [];

      for (const key of allKeys) {
        const current = currentByDimension.get(key);
        const previous = previousByDimension.get(key);

        // Skip items with no data in either period
        if (!current && !previous) continue;

        const currentMetrics = current?.metrics || { cost: 0, conversions: 0, conversionsValue: 0, clicks: 0, impressions: 0 };
        const previousMetrics = previous?.metrics || { cost: 0, conversions: 0, conversionsValue: 0, clicks: 0, impressions: 0 };

        const conversionChange = calculateChange(currentMetrics.conversions, previousMetrics.conversions);
        const costChange = calculateChange(currentMetrics.cost, previousMetrics.cost);

        breakdown.push({
          id: key,
          name: current?.name || previous?.name || key,
          current: currentMetrics,
          previous: previousMetrics,
          change: {
            conversions: conversionChange.absolute,
            conversionsPercent: Math.round(conversionChange.percent * 10) / 10,
            cost: costChange.absolute,
            costPercent: Math.round(costChange.percent * 10) / 10,
          },
          impact: conversionChange.absolute, // For sorting by absolute impact
        });
      }

      // Filter out items with 0 data in both periods
      breakdown = breakdown.filter(
        item => item.current.conversions > 0 || item.previous.conversions > 0 || item.current.cost > 0
      );

      // Sort by absolute impact
      breakdown.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

      // Top 5 winners and losers
      winners = breakdown
        .filter(item => item.impact > 0)
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 5);

      losers = breakdown
        .filter(item => item.impact < 0)
        .sort((a, b) => a.impact - b.impact)
        .slice(0, 5);
    }

    const autoHighlight = generateAutoHighlight(
      { current: currentWithDerived, previous: previousWithDerived, change: totalsChange },
      breakdown
    );

    const response: PerformanceResponse = {
      success: true,
      data: {
        comparisonMode: mode,
        period: {
          current: {
            start: formatDateForGaql(dateRanges.current.start),
            end: formatDateForGaql(dateRanges.current.end),
            label: formatDateLabel(dateRanges.current.start, dateRanges.current.end),
          },
          previous: {
            start: formatDateForGaql(dateRanges.previous.start),
            end: formatDateForGaql(dateRanges.previous.end),
            label: formatDateLabel(dateRanges.previous.start, dateRanges.previous.end),
          },
        },
        totals: {
          current: currentWithDerived,
          previous: previousWithDerived,
          change: totalsChange,
        },
        autoHighlight,
        breakdown,
        winners,
        losers,
        accountName,
        currency,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error fetching Google Ads performance', {
      error: (error as Error).message,
      clientId,
    });
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
