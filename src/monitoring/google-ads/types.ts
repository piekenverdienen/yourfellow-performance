import type { GoogleAdsConnectionStatus, AlertSeverity } from '@/types';

// Google Ads API types
export interface GoogleAdsCredentials {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  loginCustomerId?: string;
}

export interface GoogleAdsClientConfig {
  customerId: string;
  credentials: GoogleAdsCredentials;
}

// GAQL Query Result types
export interface GaqlRow {
  [key: string]: unknown;
}

export interface GaqlResponse {
  results: GaqlRow[];
  fieldMask: string;
  requestId: string;
}

// Ad Group Ad types for disapproved ads check
export interface PolicyTopicEntry {
  topic: string;
  type: string;
}

export interface PolicySummary {
  approvalStatus: string;
  policyTopicEntries?: PolicyTopicEntry[];
  reviewStatus?: string;
}

export interface AdGroupAdResource {
  ad: {
    id: string;
    name?: string;
    type?: string;
  };
  policySummary: PolicySummary;
  status?: string;
}

export interface AdGroupResource {
  id: string;
  name: string;
}

export interface CampaignResource {
  id: string;
  name: string;
  status?: string;
  startDate?: string;
}

export interface MetricsResource {
  impressions?: string;
  clicks?: string;
  cost?: string;
}

export interface DisapprovedAdRow {
  adGroupAd: AdGroupAdResource;
  adGroup: AdGroupResource;
  campaign: CampaignResource;
}

export interface CampaignMetricsRow {
  campaign: CampaignResource;
  metrics: MetricsResource;
}

// Check result types
export interface CheckResult {
  checkId: string;
  status: 'ok' | 'warning' | 'error';
  count: number;
  details: Record<string, unknown>;
  alertData?: AlertData;
}

export interface AlertData {
  title: string;
  shortDescription: string;
  impact: string;
  suggestedActions: string[];
  severity: AlertSeverity;
  details: Record<string, unknown>;
}

// Client configuration for monitoring
export interface GoogleAdsMonitoringClientConfig {
  clientId: string;
  clientName: string;
  customerId: string;
  status: GoogleAdsConnectionStatus;
  credentials: GoogleAdsCredentials;
  thresholds?: {
    noDeliveryHours?: number;
  };
}

// Monitoring run result
export interface MonitoringRunResult {
  success: boolean;
  clientsProcessed: number;
  checksRun: number;
  alertsCreated: number;
  alertsSkipped: number;
  errors: string[];
}

// OAuth types
export interface GoogleAdsOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface GoogleAdsCustomerInfo {
  customerId: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
}
