import { createClient } from '@supabase/supabase-js';
import type { ClientSettings, GoogleAdsConnectionStatus, AlertChannel, Alert } from '@/types';

export interface MonitoringStatus {
  google_ads: GoogleAdsConnectionStatus;
  meta: 'connected' | 'pending' | 'not_connected';
  ga4: 'connected' | 'pending' | 'not_connected';
  search_console: 'connected' | 'pending' | 'not_connected';
}

export interface ActiveAlertSummary {
  total: number;
  critical: number;
  high: number;
  by_channel: Partial<Record<AlertChannel, number>>;
  summary: string;
}

export interface MonitoringContext {
  status: MonitoringStatus;
  activeAlerts?: ActiveAlertSummary;
  lastChecks?: {
    google_ads?: string;
    meta?: string;
    ga4?: string;
  };
}

/**
 * Get monitoring status from client settings
 */
export function getMonitoringStatus(settings: ClientSettings): MonitoringStatus {
  return {
    google_ads: settings.googleAds?.status || 'not_connected',
    meta: settings.meta?.enabled ? 'connected' : 'not_connected',
    ga4: settings.ga4Monitoring?.enabled && settings.ga4Monitoring?.propertyId
      ? 'connected'
      : 'not_connected',
    search_console: settings.searchConsole?.enabled && settings.searchConsole?.siteUrl
      ? 'connected'
      : 'not_connected',
  };
}

/**
 * Get active alerts summary for a client
 */
export async function getActiveAlertsSummary(
  clientId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<ActiveAlertSummary> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: alerts } = await supabase
    .from('alerts')
    .select('id, channel, severity')
    .eq('client_id', clientId)
    .eq('status', 'open')
    .eq('type', 'fundamental');

  if (!alerts || alerts.length === 0) {
    return {
      total: 0,
      critical: 0,
      high: 0,
      by_channel: {},
      summary: 'Geen actieve monitoring alerts.',
    };
  }

  const critical = alerts.filter(a => a.severity === 'critical').length;
  const high = alerts.filter(a => a.severity === 'high').length;

  const byChannel: Partial<Record<AlertChannel, number>> = {};
  for (const alert of alerts) {
    const channel = alert.channel as AlertChannel;
    byChannel[channel] = (byChannel[channel] || 0) + 1;
  }

  // Build summary text
  const parts: string[] = [];
  if (byChannel.google_ads) {
    parts.push(`${byChannel.google_ads} Google Ads issue(s)`);
  }
  if (byChannel.meta) {
    parts.push(`${byChannel.meta} Meta Ads issue(s)`);
  }
  if (byChannel.website) {
    parts.push(`${byChannel.website} website issue(s)`);
  }
  if (byChannel.tracking) {
    parts.push(`${byChannel.tracking} tracking issue(s)`);
  }

  const summary = parts.length > 0
    ? `Er zijn ${alerts.length} actieve monitoring alerts: ${parts.join(', ')}.`
    : 'Geen actieve monitoring alerts.';

  return {
    total: alerts.length,
    critical,
    high,
    by_channel: byChannel,
    summary,
  };
}

/**
 * Build full monitoring context for a client
 */
export async function buildMonitoringContext(
  clientId: string,
  settings: ClientSettings,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<MonitoringContext> {
  const status = getMonitoringStatus(settings);

  // Get active alerts if any monitoring is connected
  const hasAnyMonitoring =
    status.google_ads === 'connected' ||
    status.meta === 'connected' ||
    status.ga4 === 'connected';

  let activeAlerts: ActiveAlertSummary | undefined;
  if (hasAnyMonitoring) {
    activeAlerts = await getActiveAlertsSummary(
      clientId,
      supabaseUrl,
      supabaseServiceKey
    );
  }

  return {
    status,
    activeAlerts,
    lastChecks: {
      google_ads: settings.googleAds?.lastCheckAt,
      meta: settings.meta?.lastSyncAt,
    },
  };
}

/**
 * Format monitoring context for chat system prompt
 */
export function formatMonitoringContextForChat(context: MonitoringContext): string {
  const lines: string[] = ['## Monitoring Status'];

  // Status
  lines.push('');
  lines.push('### Gekoppelde Platformen');
  lines.push(`- Google Ads: ${formatStatus(context.status.google_ads)}`);
  lines.push(`- Meta Ads: ${formatStatus(context.status.meta)}`);
  lines.push(`- GA4 Monitoring: ${formatStatus(context.status.ga4)}`);
  lines.push(`- Search Console: ${formatStatus(context.status.search_console)}`);

  // Active alerts
  if (context.activeAlerts && context.activeAlerts.total > 0) {
    lines.push('');
    lines.push('### Actieve Alerts');
    lines.push(context.activeAlerts.summary);

    if (context.activeAlerts.critical > 0) {
      lines.push(`⚠️ ${context.activeAlerts.critical} kritieke issue(s) vereisen aandacht.`);
    }
  }

  return lines.join('\n');
}

function formatStatus(status: string): string {
  switch (status) {
    case 'connected':
      return '✅ Gekoppeld';
    case 'pending':
      return '⏳ In behandeling';
    default:
      return '❌ Niet gekoppeld';
  }
}
