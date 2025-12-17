import { MetricType, Severity } from '../config';

/**
 * Result of anomaly evaluation for a single metric
 */
export interface AnomalyResult {
  clientId: string;
  clientName: string;
  metric: MetricType;
  date: string;
  severity: Severity | null; // null = no anomaly
  baseline: number;
  actual: number;
  deltaPct: number;
  direction: 'increase' | 'decrease' | 'none';
  reason: AnomalyReason;
  diagnosisHint: string;
  checklistItems: string[];
}

/**
 * Reason for the anomaly classification
 */
export type AnomalyReason =
  | 'percentage_deviation'
  | 'zero_value'
  | 'no_anomaly'
  | 'insufficient_data'
  | 'below_minimum_baseline';

/**
 * Summary of evaluation for a client
 */
export interface ClientEvaluationSummary {
  clientId: string;
  clientName: string;
  metricsEvaluated: number;
  anomaliesFound: number;
  criticalCount: number;
  warningCount: number;
  results: AnomalyResult[];
}
