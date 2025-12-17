import { Severity, MetricType } from '../config';

/**
 * ClickUp task creation request
 */
export interface ClickUpTaskRequest {
  name: string;
  description: string;
  status?: string;
  priority?: number; // 1 = urgent, 2 = high, 3 = normal, 4 = low
  assignees?: string[];
  tags?: string[];
  custom_fields?: ClickUpCustomField[];
}

/**
 * ClickUp custom field
 */
export interface ClickUpCustomField {
  id: string;
  value: string | number | boolean;
}

/**
 * ClickUp task response
 */
export interface ClickUpTaskResponse {
  id: string;
  name: string;
  url: string;
  status: { status: string };
  date_created: string;
  date_updated: string;
}

/**
 * ClickUp list response
 */
export interface ClickUpListResponse {
  id: string;
  name: string;
  space: { id: string; name: string };
}

/**
 * Alert data for ClickUp task creation
 */
export interface AlertData {
  clientId: string;
  clientName: string;
  metric: MetricType;
  date: string;
  severity: Severity;
  baseline: number;
  actual: number;
  deltaPct: number;
  direction: 'increase' | 'decrease' | 'none';
  diagnosisHint: string;
  checklistItems: string[];
  ga4PropertyId: string;
}

/**
 * Result of task creation attempt
 */
export interface TaskCreationResult {
  success: boolean;
  taskId?: string;
  taskUrl?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}
