import { MetricType } from '../config';

/**
 * Raw metric data from GA4
 */
export interface GA4MetricData {
  date: string; // YYYYMMDD format
  value: number;
}

/**
 * Processed data for a single metric
 */
export interface MetricDataPoint {
  metric: MetricType;
  date: string; // YYYY-MM-DD format
  value: number;
}

/**
 * Complete dataset for anomaly detection
 */
export interface MetricDataset {
  clientId: string;
  metric: MetricType;
  yesterday: MetricDataPoint;
  baselineData: MetricDataPoint[];
  daysAvailable: number;
}

/**
 * Result of a GA4 query
 */
export interface GA4QueryResult {
  propertyId: string;
  metrics: Map<MetricType, GA4MetricData[]>;
  error?: string;
}

/**
 * GA4 API metric names mapping
 */
export const GA4_METRIC_MAPPING: Record<MetricType, string> = {
  sessions: 'sessions',
  totalUsers: 'totalUsers',
  engagementRate: 'engagementRate',
  conversions: 'eventCount', // Filtered by event name
  purchaseRevenue: 'purchaseRevenue'
};

/**
 * Format GA4 date (YYYYMMDD) to ISO date (YYYY-MM-DD)
 */
export function formatGA4Date(ga4Date: string): string {
  return `${ga4Date.slice(0, 4)}-${ga4Date.slice(4, 6)}-${ga4Date.slice(6, 8)}`;
}

/**
 * Format ISO date to GA4 date
 */
export function toGA4DateFormat(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}
