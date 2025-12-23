import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';
import type { AlertType, AlertChannel, AlertSeverity, AlertStatus, Alert } from '@/types';
import type { CheckResult } from '../google-ads';

export interface AlertEngineConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  logger: Logger;
}

export interface CreateAlertInput {
  clientId: string;
  type: AlertType;
  channel: AlertChannel;
  checkId: string;
  severity: AlertSeverity;
  title: string;
  shortDescription: string | null;
  impact: string | null;
  suggestedActions: string[];
  details: Record<string, unknown>;
  fingerprint: string;
}

export interface AlertCreationResult {
  success: boolean;
  alertId?: string;
  skipped?: boolean;
  skipReason?: 'duplicate' | 'already_open';
  error?: string;
}

/**
 * Alert Engine for managing monitoring alerts
 *
 * Handles:
 * - Creating new alerts with deduplication
 * - Auto-resolving alerts when issues are fixed
 * - Updating alert status
 */
export class AlertEngine {
  private supabase: SupabaseClient;
  private logger: Logger;

  constructor(config: AlertEngineConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    this.logger = config.logger;
  }

  /**
   * Create an alert from a check result
   */
  async createAlertFromCheckResult(
    clientId: string,
    clientName: string,
    channel: AlertChannel,
    result: CheckResult
  ): Promise<AlertCreationResult> {
    if (!result.alertData) {
      return { success: true, skipped: true, skipReason: 'duplicate' };
    }

    const today = new Date().toISOString().slice(0, 10);
    const fingerprint = `${result.checkId}:${today}`;

    return this.createAlert({
      clientId,
      type: 'fundamental',
      channel,
      checkId: result.checkId,
      severity: result.alertData.severity,
      title: result.alertData.title,
      shortDescription: result.alertData.shortDescription,
      impact: result.alertData.impact,
      suggestedActions: result.alertData.suggestedActions,
      details: {
        ...result.details,
        clientName,
        checkCount: result.count,
      },
      fingerprint,
    });
  }

  /**
   * Create a new alert with deduplication
   */
  async createAlert(input: CreateAlertInput): Promise<AlertCreationResult> {
    try {
      // Check for existing open alert with same fingerprint
      const { data: existing } = await this.supabase
        .from('alerts')
        .select('id, status')
        .eq('client_id', input.clientId)
        .eq('fingerprint', input.fingerprint)
        .single();

      if (existing) {
        if (existing.status === 'open') {
          this.logger.debug('Alert already exists and is open', {
            alertId: existing.id,
            fingerprint: input.fingerprint,
          });
          return { success: true, skipped: true, skipReason: 'already_open' };
        }

        // If alert was resolved, we might want to reopen it
        // For now, skip if it was resolved today
        return { success: true, skipped: true, skipReason: 'duplicate' };
      }

      // Insert new alert
      const { data: alert, error } = await this.supabase
        .from('alerts')
        .insert({
          client_id: input.clientId,
          type: input.type,
          channel: input.channel,
          check_id: input.checkId,
          severity: input.severity,
          status: 'open',
          title: input.title,
          short_description: input.shortDescription,
          impact: input.impact,
          suggested_actions: input.suggestedActions,
          details: input.details,
          fingerprint: input.fingerprint,
          detected_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        // Handle unique constraint violation (duplicate)
        if (error.code === '23505') {
          this.logger.debug('Alert already exists (constraint)', {
            fingerprint: input.fingerprint,
          });
          return { success: true, skipped: true, skipReason: 'duplicate' };
        }

        throw error;
      }

      this.logger.info('Created new alert', {
        alertId: alert.id,
        title: input.title,
        severity: input.severity,
      });

      return { success: true, alertId: alert.id };
    } catch (error) {
      this.logger.error('Failed to create alert', {
        error: (error as Error).message,
        input,
      });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Auto-resolve alerts for a check that now passes
   */
  async autoResolveIfFixed(
    clientId: string,
    channel: AlertChannel,
    checkId: string
  ): Promise<number> {
    const { data: alerts, error } = await this.supabase
      .from('alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('client_id', clientId)
      .eq('channel', channel)
      .eq('check_id', checkId)
      .eq('status', 'open')
      .select('id');

    if (error) {
      this.logger.error('Failed to auto-resolve alerts', {
        error: error.message,
        checkId,
      });
      return 0;
    }

    if (alerts && alerts.length > 0) {
      this.logger.info(`Auto-resolved ${alerts.length} alert(s)`, {
        checkId,
        clientId,
      });
    }

    return alerts?.length || 0;
  }

  /**
   * Get open alerts for a client
   */
  async getOpenAlerts(
    clientId: string,
    options: {
      channel?: AlertChannel;
      type?: AlertType;
      severity?: AlertSeverity;
    } = {}
  ): Promise<Alert[]> {
    let query = this.supabase
      .from('alerts')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'open')
      .order('detected_at', { ascending: false });

    if (options.channel) {
      query = query.eq('channel', options.channel);
    }
    if (options.type) {
      query = query.eq('type', options.type);
    }
    if (options.severity) {
      query = query.eq('severity', options.severity);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error('Failed to get open alerts', { error: error.message });
      return [];
    }

    return data || [];
  }

  /**
   * Get alert summary for dashboard
   */
  async getAlertSummary(clientId?: string): Promise<{
    totalCritical: number;
    byChannel: Record<AlertChannel, { count: number; items: Partial<Alert>[] }>;
  }> {
    let query = this.supabase
      .from('alerts')
      .select('id, channel, title, short_description, severity, check_id, detected_at')
      .eq('status', 'open')
      .in('type', ['fundamental'])
      .in('severity', ['critical', 'high'])
      .order('detected_at', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data: alerts, error } = await query;

    if (error) {
      this.logger.error('Failed to get alert summary', { error: error.message });
      return { totalCritical: 0, byChannel: {} as Record<AlertChannel, { count: number; items: Partial<Alert>[] }> };
    }

    // Group by channel
    const byChannel: Record<string, { count: number; items: Partial<Alert>[] }> = {};

    for (const alert of alerts || []) {
      const channel = alert.channel as AlertChannel;
      if (!byChannel[channel]) {
        byChannel[channel] = { count: 0, items: [] };
      }
      byChannel[channel].count++;
      if (byChannel[channel].items.length < 3) {
        byChannel[channel].items.push({
          id: alert.id,
          title: alert.title,
          short_description: alert.short_description,
          severity: alert.severity,
          check_id: alert.check_id,
          detected_at: alert.detected_at,
        });
      }
    }

    return {
      totalCritical: alerts?.length || 0,
      byChannel: byChannel as Record<AlertChannel, { count: number; items: Partial<Alert>[] }>,
    };
  }

  /**
   * Update alert status
   */
  async updateAlertStatus(
    alertId: string,
    status: AlertStatus,
    userId?: string
  ): Promise<boolean> {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'acknowledged') {
      updates.acknowledged_at = new Date().toISOString();
    } else if (status === 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('alerts')
      .update(updates)
      .eq('id', alertId);

    if (error) {
      this.logger.error('Failed to update alert status', {
        alertId,
        status,
        error: error.message,
      });
      return false;
    }

    this.logger.info('Updated alert status', { alertId, status });
    return true;
  }
}
