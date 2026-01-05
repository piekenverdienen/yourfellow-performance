/**
 * Meta Ads Types
 *
 * TypeScript types for Meta (Facebook/Instagram) Ads integration.
 * Follows existing patterns from src/types/index.ts
 */

// ============================================
// Enums & Constants
// ============================================

export type MetaEntityType = 'account' | 'campaign' | 'adset' | 'ad'

export type MetaCampaignObjective =
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_SALES'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_APP_PROMOTION'

export type MetaCampaignStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'DELETED'
  | 'ARCHIVED'

export type MetaAdStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'DELETED'
  | 'ARCHIVED'
  | 'PENDING_REVIEW'
  | 'DISAPPROVED'
  | 'PREAPPROVED'
  | 'PENDING_BILLING_INFO'
  | 'CAMPAIGN_PAUSED'
  | 'ADSET_PAUSED'
  | 'IN_PROCESS'
  | 'WITH_ISSUES'

export type MetaFatigueSeverity = 'low' | 'medium' | 'high' | 'critical'

// ============================================
// Settings Types (stored in clients.settings.meta)
// ============================================

/**
 * Performance targets - what this client considers "good"
 * All values are optional; system uses historical averages as fallback
 */
export interface MetaPerformanceTargets {
  // Cost targets
  targetCPA?: number            // Target cost per acquisition (EUR)
  maxCPA?: number               // Maximum acceptable CPA before alert
  targetCPC?: number            // Target cost per click

  // Return targets
  targetROAS?: number           // Target return on ad spend (e.g., 3.0 = 3x return)
  minROAS?: number              // Minimum acceptable ROAS before alert

  // Efficiency targets
  targetCTR?: number            // Target click-through rate (%)
  minCTR?: number               // Minimum CTR before concern

  // Budget
  dailyBudget?: number          // Daily spend target (EUR)
  monthlyBudget?: number        // Monthly spend budget (EUR)

  // Frequency
  maxFrequency?: number         // Max frequency before fatigue (default: 2.5)
  optimalFrequency?: number     // Optimal frequency range max (default: 2.0)
}

/**
 * Client context - helps AI understand the business
 */
export interface MetaClientContext {
  industry?: string             // e.g., 'E-commerce', 'SaaS', 'Lead Gen'
  businessModel?: string        // e.g., 'D2C', 'B2B', 'Marketplace'
  averageOrderValue?: number    // Average order value (EUR)
  targetMargin?: number         // Target profit margin (%)
  conversionWindow?: string     // e.g., '7-day click', '1-day view'
  seasonality?: string          // e.g., 'Q4 peak', 'Summer slow'
  notes?: string                // Free-form notes for AI context
}

/**
 * Alert thresholds - when to trigger warnings
 * These are percentage changes from baseline/target
 */
export interface MetaAlertThresholds {
  // CPA alerts
  cpaIncreaseWarning?: number   // % increase to trigger warning (default: 20)
  cpaIncreaseCritical?: number  // % increase to trigger critical (default: 50)

  // ROAS alerts
  roasDropWarning?: number      // % drop to trigger warning (default: 20)
  roasDropCritical?: number     // % drop to trigger critical (default: 40)

  // CTR alerts
  ctrDropWarning?: number       // % drop to trigger warning (default: 30)

  // CPC alerts
  cpcIncreaseWarning?: number   // % increase to trigger warning (default: 25)

  // Frequency
  frequencyWarning?: number     // Absolute frequency threshold (default: 2.5)
  frequencyCritical?: number    // Critical frequency threshold (default: 4.0)

  // Spend
  minSpendForAlert?: number     // Min spend to trigger any alert (default: 10 EUR)
  overspendWarning?: number     // % over daily budget to warn (default: 20)
}

export interface MetaAdsSettings {
  enabled?: boolean
  adAccountId?: string          // format: act_XXXXX
  accessToken?: string          // encrypted in DB
  businessId?: string           // Business Manager ID
  pixelId?: string              // Meta Pixel ID for tracking
  timezone?: string             // e.g., 'Europe/Amsterdam'
  currency?: string             // e.g., 'EUR'

  // Sync settings
  syncEnabled?: boolean
  lastSyncAt?: string           // ISO timestamp

  // NEW: Comprehensive targets and thresholds
  targets?: MetaPerformanceTargets
  context?: MetaClientContext
  alertThresholds?: MetaAlertThresholds

  // DEPRECATED: Use alertThresholds instead
  thresholds?: {
    frequencyWarning?: number   // Default: 2.5
    ctrDropWarning?: number     // Default: 30 (%)
    minSpendForAlert?: number   // Default: 10 (EUR)
  }
}

// ============================================
// API Response Types (from Meta Graph API)
// ============================================

export interface MetaAdAccount {
  id: string                    // format: act_XXXXX
  account_id: string            // numeric string
  name: string
  currency: string
  timezone_name: string
  account_status: number        // 1 = ACTIVE, 2 = DISABLED, etc.
  amount_spent: string          // in cents
  business?: {
    id: string
    name: string
  }
}

export interface MetaCampaign {
  id: string
  account_id: string
  name: string
  objective: MetaCampaignObjective
  status: MetaCampaignStatus
  effective_status: MetaCampaignStatus
  daily_budget?: string
  lifetime_budget?: string
  created_time: string
  updated_time: string
}

export interface MetaAdSet {
  id: string
  account_id: string
  campaign_id: string
  name: string
  status: MetaAdStatus
  effective_status: MetaAdStatus
  daily_budget?: string
  lifetime_budget?: string
  targeting?: MetaTargeting
  optimization_goal?: string
  billing_event?: string
  bid_amount?: string
  created_time: string
  updated_time: string
}

export interface MetaAd {
  id: string
  account_id: string
  campaign_id: string
  adset_id: string
  name: string
  status: MetaAdStatus
  effective_status: MetaAdStatus
  creative?: MetaCreative
  created_time: string
  updated_time: string
}

export interface MetaCreative {
  id: string
  name?: string
  title?: string
  body?: string
  call_to_action_type?: string
  image_url?: string
  video_id?: string
  thumbnail_url?: string
  object_story_spec?: {
    page_id?: string
    link_data?: {
      link?: string
      message?: string
      name?: string
      description?: string
      image_hash?: string
      call_to_action?: {
        type: string
        value?: { link?: string }
      }
    }
  }
}

export interface MetaTargeting {
  age_min?: number
  age_max?: number
  genders?: number[]
  geo_locations?: {
    countries?: string[]
    regions?: { key: string; name: string }[]
    cities?: { key: string; name: string }[]
  }
  interests?: { id: string; name: string }[]
  custom_audiences?: { id: string; name: string }[]
  excluded_custom_audiences?: { id: string; name: string }[]
}

// ============================================
// Insights Types (performance data)
// ============================================

export interface MetaInsightDaily {
  id?: string
  client_id: string
  ad_account_id: string
  entity_type: MetaEntityType
  entity_id: string
  entity_name: string
  campaign_id?: string
  campaign_name?: string
  adset_id?: string
  adset_name?: string
  date: string                  // YYYY-MM-DD

  // Core metrics
  impressions: number
  reach: number
  clicks: number
  spend: number                 // in account currency

  // Engagement metrics
  ctr: number                   // click-through rate (%)
  cpc: number                   // cost per click
  cpm: number                   // cost per 1000 impressions
  frequency: number             // avg impressions per user

  // Conversion metrics
  conversions: number
  conversion_value: number
  cost_per_conversion: number
  roas: number                  // return on ad spend

  // Video metrics (optional)
  video_views?: number
  video_p25_watched?: number
  video_p50_watched?: number
  video_p75_watched?: number
  video_p100_watched?: number

  // Timestamps
  created_at?: string
  updated_at?: string
}

// ============================================
// Fatigue Detection Types
// ============================================

export interface MetaFatigueSignal {
  id?: string
  client_id: string
  ad_account_id: string
  entity_type: MetaEntityType
  entity_id: string
  entity_name: string
  campaign_name?: string
  adset_name?: string

  // Current metrics
  current_frequency: number
  current_ctr: number
  current_cpc: number

  // Baseline metrics (7-day average)
  baseline_frequency: number
  baseline_ctr: number
  baseline_cpc: number

  // Changes
  frequency_change: number      // % change
  ctr_change: number            // % change (negative = drop)
  cpc_change: number            // % change (positive = increase)

  // Detection
  severity: MetaFatigueSeverity
  reasons: string[]             // human-readable reasons
  suggested_actions: string[]   // recommended fixes

  // Status
  is_acknowledged: boolean
  acknowledged_at?: string
  acknowledged_by?: string

  // Timestamps
  detected_at: string
  created_at?: string
  updated_at?: string
}

// ============================================
// AI Insights Types
// ============================================

export interface MetaAIInsight {
  id?: string
  client_id: string
  ad_account_id: string
  insight_type: 'daily' | 'weekly' | 'monthly'
  period_start: string          // YYYY-MM-DD
  period_end: string            // YYYY-MM-DD

  // AI-generated content
  executive_summary: string
  top_performers: {
    entity_type: MetaEntityType
    entity_id: string
    entity_name: string
    metric: string
    value: number
    insight: string
  }[]
  problems: {
    severity: 'low' | 'medium' | 'high'
    title: string
    description: string
    affected_entities: string[]
    impact: string
  }[]
  opportunities: {
    title: string
    description: string
    potential_impact: string
    effort: 'low' | 'medium' | 'high'
  }[]
  recommended_actions: {
    priority: number
    action: string
    rationale: string
    expected_outcome: string
  }[]

  // Metrics summary
  metrics_summary: {
    total_spend: number
    total_impressions: number
    total_clicks: number
    total_conversions: number
    avg_ctr: number
    avg_cpc: number
    avg_roas: number
    spend_vs_previous: number   // % change
    conversions_vs_previous: number
  }

  // Timestamps
  generated_at: string
  created_at?: string
}

// ============================================
// UI/Table Types
// ============================================

export interface MetaPerformanceRow {
  entity_type: MetaEntityType
  entity_id: string
  entity_name: string
  status?: string
  campaign_name?: string
  adset_name?: string

  // Period metrics
  impressions: number
  reach: number
  clicks: number
  spend: number
  ctr: number
  cpc: number
  cpm: number
  frequency: number
  conversions: number
  conversion_value: number
  cost_per_conversion: number
  roas: number

  // Trend indicators
  spend_trend: 'up' | 'down' | 'stable'
  ctr_trend: 'up' | 'down' | 'stable'
  roas_trend: 'up' | 'down' | 'stable'

  // Alerts
  has_fatigue: boolean
  has_fatigue_warning: boolean
  fatigue_severity?: MetaFatigueSeverity
}

export interface MetaDashboardKPIs {
  // Totals
  total_spend: number
  total_impressions: number
  total_reach: number
  total_clicks: number
  total_conversions: number
  total_revenue: number

  // Averages
  avg_ctr: number
  avg_cpc: number
  avg_cpm: number
  avg_frequency: number
  avg_roas: number
  avg_cpa: number

  // Comparisons (vs previous period)
  spend_change: number
  impressions_change: number
  clicks_change: number
  conversions_change: number
  roas_change: number
  cpa_change: number

  // Counts
  active_campaigns: number
  active_adsets: number
  active_ads: number
  fatigued_ads: number
}

// ============================================
// API Request/Response Types
// ============================================

export interface MetaPerformanceRequest {
  clientId: string
  adAccountId?: string
  entityType?: MetaEntityType
  dateStart: string             // YYYY-MM-DD
  dateEnd: string               // YYYY-MM-DD
  campaignIds?: string[]
  adsetIds?: string[]
  // Pagination
  page?: number
  pageSize?: number
  // Sorting
  sortBy?: keyof MetaPerformanceRow
  sortOrder?: 'asc' | 'desc'
  // Filters
  minSpend?: number
  status?: MetaAdStatus[]
}

export interface MetaPerformanceResponse {
  data: MetaPerformanceRow[]
  kpis: MetaDashboardKPIs
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export interface MetaSyncRequest {
  clientId: string
  adAccountId: string
  dateStart?: string
  dateEnd?: string
  entityTypes?: MetaEntityType[]
}

export interface MetaSyncResponse {
  success: boolean
  synced: {
    campaigns: number
    adsets: number
    ads: number
    insights: number
  }
  errors?: string[]
}
