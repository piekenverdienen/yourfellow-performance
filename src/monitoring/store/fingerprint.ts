import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { MetricType, Severity } from '../config';
import { Logger } from '../utils/logger';

/**
 * Alert fingerprint data
 */
export interface AlertFingerprint {
  clientId: string;
  metric: MetricType;
  date: string;
  severity: Severity;
  createdAt: string;
  taskId?: string;
  taskUrl?: string;
}

/**
 * Fingerprint store data structure
 */
interface FingerprintStoreData {
  version: number;
  fingerprints: Record<string, AlertFingerprint>;
  lastUpdated: string;
}

/**
 * Generate fingerprint key from alert components
 */
export function generateFingerprintKey(
  clientId: string,
  metric: MetricType,
  date: string,
  severity: Severity
): string {
  return `${clientId}:${metric}:${date}:${severity}`;
}

/**
 * Fingerprint store for idempotent alert handling
 */
export class FingerprintStore {
  private filePath: string;
  private data: FingerprintStoreData;
  private logger: Logger;
  private isDirty: boolean = false;

  constructor(filePath: string, logger: Logger) {
    this.filePath = filePath;
    this.logger = logger;
    this.data = this.load();
  }

  /**
   * Load fingerprints from file
   */
  private load(): FingerprintStoreData {
    if (!existsSync(this.filePath)) {
      this.logger.debug('Fingerprint store not found, creating new store');
      return {
        version: 1,
        fingerprints: {},
        lastUpdated: new Date().toISOString()
      };
    }

    try {
      const content = readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(content) as FingerprintStoreData;
      this.logger.debug(`Loaded ${Object.keys(data.fingerprints).length} fingerprints`);
      return data;
    } catch (error) {
      this.logger.warn('Failed to load fingerprint store, starting fresh', {
        error: (error as Error).message
      });
      return {
        version: 1,
        fingerprints: {},
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Check if a fingerprint exists
   */
  exists(
    clientId: string,
    metric: MetricType,
    date: string,
    severity: Severity
  ): boolean {
    const key = generateFingerprintKey(clientId, metric, date, severity);
    return key in this.data.fingerprints;
  }

  /**
   * Get an existing fingerprint
   */
  get(
    clientId: string,
    metric: MetricType,
    date: string,
    severity: Severity
  ): AlertFingerprint | undefined {
    const key = generateFingerprintKey(clientId, metric, date, severity);
    return this.data.fingerprints[key];
  }

  /**
   * Store a new fingerprint
   */
  set(
    clientId: string,
    metric: MetricType,
    date: string,
    severity: Severity,
    taskId?: string,
    taskUrl?: string
  ): void {
    const key = generateFingerprintKey(clientId, metric, date, severity);
    this.data.fingerprints[key] = {
      clientId,
      metric,
      date,
      severity,
      createdAt: new Date().toISOString(),
      taskId,
      taskUrl
    };
    this.isDirty = true;

    this.logger.debug(`Stored fingerprint: ${key}`);
  }

  /**
   * Remove old fingerprints (cleanup)
   */
  cleanup(daysToKeep: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    let removed = 0;
    const keys = Object.keys(this.data.fingerprints);

    for (const key of keys) {
      const fingerprint = this.data.fingerprints[key];
      if (fingerprint.date < cutoffStr) {
        delete this.data.fingerprints[key];
        removed++;
      }
    }

    if (removed > 0) {
      this.isDirty = true;
      this.logger.info(`Cleaned up ${removed} old fingerprints`);
    }

    return removed;
  }

  /**
   * Save fingerprints to file
   */
  save(): void {
    if (!this.isDirty) {
      return;
    }

    // Ensure directory exists
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.data.lastUpdated = new Date().toISOString();

    try {
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
      this.isDirty = false;
      this.logger.debug(`Saved fingerprints to ${this.filePath}`);
    } catch (error) {
      this.logger.error('Failed to save fingerprint store', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get total fingerprint count
   */
  get count(): number {
    return Object.keys(this.data.fingerprints).length;
  }
}
