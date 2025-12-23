import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';

/**
 * Base interface for Google Ads monitoring checks
 */
export interface GoogleAdsCheck {
  /** Unique identifier for the check */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what the check does */
  description: string;

  /** Run the check for a client */
  run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult>;
}

/**
 * Base class for Google Ads checks with common utilities
 */
export abstract class BaseGoogleAdsCheck implements GoogleAdsCheck {
  abstract id: string;
  abstract name: string;
  abstract description: string;

  abstract run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult>;

  /**
   * Create a fingerprint for deduplication
   */
  protected createFingerprint(clientId: string, date: string): string {
    return `${clientId}:${this.id}:${date}`;
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  protected getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Create a successful (no issues) result
   */
  protected okResult(details: Record<string, unknown> = {}): CheckResult {
    return {
      checkId: this.id,
      status: 'ok',
      count: 0,
      details,
    };
  }

  /**
   * Create an error result with alert data
   */
  protected errorResult(
    count: number,
    alertData: CheckResult['alertData'],
    details: Record<string, unknown> = {}
  ): CheckResult {
    return {
      checkId: this.id,
      status: 'error',
      count,
      details,
      alertData,
    };
  }

  /**
   * Create a warning result with alert data
   */
  protected warningResult(
    count: number,
    alertData: CheckResult['alertData'],
    details: Record<string, unknown> = {}
  ): CheckResult {
    return {
      checkId: this.id,
      status: 'warning',
      count,
      details,
      alertData,
    };
  }
}
