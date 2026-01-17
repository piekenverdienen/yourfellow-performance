import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsClient } from '@/monitoring/google-ads';
import { createLogger } from '@/monitoring/utils/logger';

const logger = createLogger('info');

// Thresholds for status indicators
const STATUS_THRESHOLDS = {
  warning: 0.10, // 10% change = orange
  critical: 0.25, // 25% change = red (for negative) or green (for positive)
};

export type KPIStatus = 'positive' | 'neutral' | 'warning' | 'negative';

export interface KPIData {
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  status: KPIStatus;
  formatted: string;
  previousFormatted: string;
}

export interface GoogleAdsDashboardResponse {
  success: boolean;
  data?: {
    period: {
      current: { start: string; end: string };
      previous: { start: string; end: string };
    };
    kpis: {
      spend: KPIData;
      conversions: KPIData;
      cpa: KPIData;
      roas: KPIData;
      conversionRate: KPIData;
      clicks: KPIData;
      impressions: KPIData;
      ctr: KPIData;
    };
    accountName: string;
    currency: string;
    lastUpdated: string;
  };
  error?: string;
}

interface MetricsRow {
  metrics: {
    costMicros: string;
    conversions: string;
    conversionsValue: string;
    clicks: string;
    impressions: string;
  };
}

function calculateStatus(current: number, previous: number, isLowerBetter: boolean = false): KPIStatus {
  if (previous === 0) return 'neutral';

  const changePercent = (current - previous) / previous;
  const absChange = Math.abs(changePercent);

  // For metrics where lower is better (like CPA), invert the logic
  const isImprovement = isLowerBetter ? current < previous : current > previous;

  if (absChange < STATUS_THRESHOLDS.warning) {
    return 'neutral';
  } else if (absChange < STATUS_THRESHOLDS.critical) {
    return isImprovement ? 'positive' : 'warning';
  } else {
    return isImprovement ? 'positive' : 'negative';
  }
}

function formatCurrency(value: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number, decimals: number = 1): string {
  return new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function createKPI(
  current: number,
  previous: number,
  formatter: (v: number) => string,
  isLowerBetter: boolean = false
): KPIData {
  const change = current - previous;
  const changePercent = previous !== 0 ? (change / previous) * 100 : 0;

  return {
    value: current,
    previousValue: previous,
    change,
    changePercent: Math.round(changePercent * 10) / 10,
    status: calculateStatus(current, previous, isLowerBetter),
    formatted: formatter(current),
    previousFormatted: formatter(previous),
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

    // Fetch client with Google Ads settings
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, settings')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    const googleAdsSettings = client.settings?.googleAds;
    if (!googleAdsSettings?.customerId) {
      return NextResponse.json(
        { success: false, error: 'Google Ads not configured for this client' },
        { status: 400 }
      );
    }

    // Fetch global Google Ads credentials
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

    // Create Google Ads client
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

    // Query for current period (last 7 days)
    const currentQuery = `
      SELECT
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.clicks,
        metrics.impressions
      FROM customer
      WHERE segments.date DURING LAST_7_DAYS
    `;

    // Query for last 14 days to calculate previous 7 days
    const fullQuery = `
      SELECT
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.clicks,
        metrics.impressions
      FROM customer
      WHERE segments.date DURING LAST_14_DAYS
    `;

    // Get customer info for currency
    const customerInfo = await googleAdsClient.getCustomerInfo();
    const currency = customerInfo?.currencyCode || 'EUR';
    const accountName = customerInfo?.descriptiveName || client.name;

    // Execute queries
    const [currentResponse, fullResponse] = await Promise.all([
      googleAdsClient.query(currentQuery),
      googleAdsClient.query(fullQuery),
    ]);

    // Aggregate current period metrics
    const currentMetrics = aggregateMetrics(currentResponse.results as unknown as MetricsRow[]);
    const fullMetrics = aggregateMetrics(fullResponse.results as unknown as MetricsRow[]);

    // Calculate previous period (full - current)
    const previousMetrics = {
      cost: fullMetrics.cost - currentMetrics.cost,
      conversions: fullMetrics.conversions - currentMetrics.conversions,
      conversionsValue: fullMetrics.conversionsValue - currentMetrics.conversionsValue,
      clicks: fullMetrics.clicks - currentMetrics.clicks,
      impressions: fullMetrics.impressions - currentMetrics.impressions,
    };

    // Calculate derived metrics
    const currentCPA = currentMetrics.conversions > 0
      ? currentMetrics.cost / currentMetrics.conversions
      : 0;
    const previousCPA = previousMetrics.conversions > 0
      ? previousMetrics.cost / previousMetrics.conversions
      : 0;

    const currentROAS = currentMetrics.cost > 0
      ? currentMetrics.conversionsValue / currentMetrics.cost
      : 0;
    const previousROAS = previousMetrics.cost > 0
      ? previousMetrics.conversionsValue / previousMetrics.cost
      : 0;

    const currentCVR = currentMetrics.clicks > 0
      ? currentMetrics.conversions / currentMetrics.clicks
      : 0;
    const previousCVR = previousMetrics.clicks > 0
      ? previousMetrics.conversions / previousMetrics.clicks
      : 0;

    const currentCTR = currentMetrics.impressions > 0
      ? currentMetrics.clicks / currentMetrics.impressions
      : 0;
    const previousCTR = previousMetrics.impressions > 0
      ? previousMetrics.clicks / previousMetrics.impressions
      : 0;

    // Calculate date ranges
    const today = new Date();
    const currentEnd = new Date(today);
    currentEnd.setDate(currentEnd.getDate() - 1); // Yesterday
    const currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() - 6); // 7 days ago

    const previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - 6);

    const response: GoogleAdsDashboardResponse = {
      success: true,
      data: {
        period: {
          current: {
            start: currentStart.toISOString().slice(0, 10),
            end: currentEnd.toISOString().slice(0, 10),
          },
          previous: {
            start: previousStart.toISOString().slice(0, 10),
            end: previousEnd.toISOString().slice(0, 10),
          },
        },
        kpis: {
          spend: createKPI(
            currentMetrics.cost,
            previousMetrics.cost,
            (v) => formatCurrency(v, currency),
            true // Lower is better
          ),
          conversions: createKPI(
            currentMetrics.conversions,
            previousMetrics.conversions,
            (v) => formatNumber(v, 1)
          ),
          cpa: createKPI(
            currentCPA,
            previousCPA,
            (v) => formatCurrency(v, currency),
            true // Lower is better
          ),
          roas: createKPI(
            currentROAS,
            previousROAS,
            (v) => formatNumber(v, 2) + 'x'
          ),
          conversionRate: createKPI(
            currentCVR,
            previousCVR,
            formatPercent
          ),
          clicks: createKPI(
            currentMetrics.clicks,
            previousMetrics.clicks,
            (v) => formatNumber(v, 0)
          ),
          impressions: createKPI(
            currentMetrics.impressions,
            previousMetrics.impressions,
            (v) => formatNumber(v, 0)
          ),
          ctr: createKPI(
            currentCTR,
            previousCTR,
            formatPercent
          ),
        },
        accountName,
        currency,
        lastUpdated: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error fetching Google Ads dashboard', {
      error: (error as Error).message,
      clientId,
    });
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

function aggregateMetrics(rows: MetricsRow[]) {
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
