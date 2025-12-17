import { z } from 'zod';

// Metric types we track
export const MetricType = z.enum([
  'sessions',
  'totalUsers',
  'engagementRate',
  'conversions',
  'purchaseRevenue'
]);

export type MetricType = z.infer<typeof MetricType>;

// Severity levels
export const Severity = z.enum(['WARNING', 'CRITICAL']);
export type Severity = z.infer<typeof Severity>;

// Threshold configuration per metric
export const ThresholdConfig = z.object({
  warning: z.number().min(0).max(100).default(20),
  critical: z.number().min(0).max(100).default(40),
  minBaseline: z.number().min(0).default(20)
});

export type ThresholdConfig = z.infer<typeof ThresholdConfig>;

// Client configuration
export const ClientConfig = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ga4PropertyId: z.string().regex(/^\d+$/, 'GA4 property ID must be numeric'),
  timezone: z.string().default('Europe/Amsterdam'),

  // Metrics configuration
  metrics: z.object({
    sessions: z.boolean().default(true),
    totalUsers: z.boolean().default(true),
    engagementRate: z.boolean().default(true),
    conversions: z.boolean().default(false),
    purchaseRevenue: z.boolean().default(false)
  }),

  // Key event for conversions (required if conversions enabled)
  keyEventName: z.string().optional(),

  // E-commerce flag
  isEcommerce: z.boolean().default(false),

  // Threshold overrides per metric
  thresholds: z.record(MetricType, ThresholdConfig.partial()).optional(),

  // ClickUp configuration
  clickup: z.object({
    listId: z.string().min(1),
    assigneeId: z.string().optional(),
    tags: z.array(z.string()).optional()
  })
}).refine(
  (data) => !data.metrics.conversions || data.keyEventName,
  { message: 'keyEventName is required when conversions metric is enabled' }
);

export type ClientConfig = z.infer<typeof ClientConfig>;

// Rate limiting configuration
export const RateLimitingConfig = z.object({
  requestsPerMinute: z.number().default(60),
  retryAttempts: z.number().default(2),
  retryDelayMs: z.number().default(1000)
});

// Default thresholds configuration
export const DefaultThresholdsConfig = z.object({
  warning: z.number().default(20),
  critical: z.number().default(40),
  minBaseline: z.number().default(20)
});

// ClickUp global configuration
export const ClickUpGlobalConfig = z.object({
  defaultListId: z.string().optional(),
  errorAlertListId: z.string().optional()
});

// Global configuration
export const GlobalConfig = z.object({
  // Default thresholds
  defaultThresholds: DefaultThresholdsConfig.default({
    warning: 20,
    critical: 40,
    minBaseline: 20
  }),

  // Baseline window in days
  baselineWindowDays: z.number().min(3).max(30).default(7),

  // Minimum days required for percentage-based alerts
  minDaysForPercentageAlerts: z.number().min(1).max(7).default(3),

  // Rate limiting
  rateLimiting: RateLimitingConfig.default({
    requestsPerMinute: 60,
    retryAttempts: 2,
    retryDelayMs: 1000
  }),

  // ClickUp defaults
  clickup: ClickUpGlobalConfig.optional()
});

export type GlobalConfig = z.infer<typeof GlobalConfig>;

// Complete configuration file
export const MonitoringConfig = z.object({
  global: GlobalConfig.default({
    defaultThresholds: { warning: 20, critical: 40, minBaseline: 20 },
    baselineWindowDays: 7,
    minDaysForPercentageAlerts: 3,
    rateLimiting: { requestsPerMinute: 60, retryAttempts: 2, retryDelayMs: 1000 }
  }),
  clients: z.array(ClientConfig).min(1)
});

export type MonitoringConfig = z.infer<typeof MonitoringConfig>;

// Environment variables schema
export const EnvConfig = z.object({
  GA4_CREDENTIALS: z.string().min(1, 'GA4_CREDENTIALS is required'),
  CLICKUP_TOKEN: z.string().min(1, 'CLICKUP_TOKEN is required'),
  STORE_PATH: z.string().default('./data/fingerprints.json'),
  DRY_RUN: z.string().transform(v => v === 'true').default(false),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export type EnvConfig = z.infer<typeof EnvConfig>;
