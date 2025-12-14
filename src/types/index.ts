// User types
export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'marketer' | 'client'
  xp: number
  level: number
  // Preferences
  company_name: string | null
  industry: string | null
  preferred_tone: 'professional' | 'casual' | 'friendly' | 'formal' | 'creative'
  preferred_language: string
  target_audience: string | null
  brand_voice: string | null
  // Stats
  total_generations: number
  created_at: string
  updated_at: string
}

// User preferences for profile page
export interface UserPreferences {
  full_name: string | null
  company_name: string | null
  industry: string | null
  preferred_tone: 'professional' | 'casual' | 'friendly' | 'formal' | 'creative'
  target_audience: string | null
  brand_voice: string | null
}

// User stats
export interface UserStats {
  total_generations: number
  generations_today: number
  current_xp: number
  current_level: number
}

// Level info
export interface LevelInfo {
  level: number
  title: string
  minXp: number
  maxXp: number
  progress: number
}

// Usage tracking
export interface UsageRecord {
  id: string
  user_id: string
  tool: ToolType
  tokens_used: number
  created_at: string
}

export type ToolType = 
  | 'google-ads-copy'
  | 'google-ads-feed'
  | 'google-ads-image'
  | 'social-copy'
  | 'social-image'
  | 'seo-content'
  | 'seo-meta'
  | 'cro-analyzer'

// AI Generation types
export interface GenerationRequest {
  tool: ToolType
  prompt: string
  options?: Record<string, unknown>
}

export interface GenerationResponse {
  success: boolean
  result?: string | string[]
  error?: string
  tokens_used: number
}

// Google Ads types
export interface AdCopyRequest {
  product_name: string
  product_description: string
  target_audience: string
  keywords: string[]
  tone: 'professional' | 'casual' | 'urgent' | 'friendly'
  ad_type: 'responsive_search' | 'responsive_display' | 'performance_max'
}

export interface AdCopyResult {
  headlines: string[]
  descriptions: string[]
  call_to_actions?: string[]
}

// Feed Management types
export interface FeedProduct {
  id: string
  title: string
  description: string
  price: number
  image_url: string
  category: string
  brand?: string
  gtin?: string
}

export interface FeedOptimization {
  original: FeedProduct
  optimized: FeedProduct
  changes: string[]
  score_before: number
  score_after: number
}

// Social Media types
export interface SocialPostRequest {
  platform: 'facebook' | 'instagram' | 'linkedin' | 'twitter'
  topic: string
  tone: string
  include_hashtags: boolean
  include_emoji: boolean
  post_type: 'organic' | 'ad'
}

export interface SocialPostResult {
  primary_text: string
  headline?: string
  hashtags?: string[]
  suggested_cta?: string
}

// SEO types
export interface SEOContentRequest {
  topic: string
  keywords: string[]
  content_type: 'blog' | 'product' | 'category' | 'landing'
  word_count: number
  tone: string
}

export interface MetaTagRequest {
  url: string
  page_content: string
  target_keyword: string
}

export interface MetaTagResult {
  title: string
  description: string
  og_title: string
  og_description: string
}

// CRO types
export interface CROAnalysisRequest {
  url: string
}

export interface CialdiniPrinciple {
  name: 'reciprocity' | 'commitment' | 'social_proof' | 'authority' | 'liking' | 'scarcity'
  score: number
  found_elements: string[]
  suggestions: string[]
}

export interface CROAnalysisResult {
  url: string
  overall_score: number
  principles: CialdiniPrinciple[]
  top_improvements: string[]
  screenshot_url?: string
}

// Dashboard types
export interface DashboardStats {
  total_generations: number
  generations_today: number
  tokens_used: number
  xp_earned: number
  level: number
  level_progress: number
}

export interface RecentActivity {
  id: string
  tool: ToolType
  description: string
  created_at: string
}

// Calendar/Marketing events
export interface MarketingEvent {
  id: string
  title: string
  date: string
  type: 'holiday' | 'sale' | 'campaign' | 'deadline'
  color: string
}

// Chat types
export interface Assistant {
  id: string
  slug: string
  name: string
  description: string | null
  avatar_letter: string
  avatar_color: string
  system_prompt: string
  model: string
  max_tokens: number
  temperature: number
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  assistant_id: string
  title: string
  is_archived: boolean
  created_at: string
  updated_at: string
  assistant?: Assistant
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  tokens_used: number
  created_at: string
}

// Integration types
export type IntegrationProvider = 'google_ads' | 'meta_ads' | 'google_analytics' | 'hubspot'

export type ConnectionStatus = 'pending' | 'connected' | 'expired' | 'error'

export type SyncFrequency = 'hourly' | 'daily' | 'weekly' | 'manual'

export interface Integration {
  id: string
  user_id: string
  provider: IntegrationProvider
  access_token?: string
  refresh_token?: string
  token_expires_at?: string
  account_id?: string
  account_name?: string
  scopes?: string[]
  is_active: boolean
  connection_status: ConnectionStatus
  last_error?: string
  last_synced_at?: string
  sync_frequency: SyncFrequency
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface IntegrationLog {
  id: string
  integration_id?: string
  user_id: string
  action: 'connect' | 'disconnect' | 'sync' | 'refresh_token' | 'error'
  provider: IntegrationProvider
  details?: Record<string, unknown>
  created_at: string
}

// Google Ads API types
export interface GoogleAdsCampaign {
  id: string
  name: string
  status: 'ENABLED' | 'PAUSED' | 'REMOVED'
  budget: number
  impressions: number
  clicks: number
  cost: number
  conversions: number
  ctr: number
  cpc: number
}

export interface GoogleAdsMetrics {
  date_range: string
  total_impressions: number
  total_clicks: number
  total_cost: number
  total_conversions: number
  avg_ctr: number
  avg_cpc: number
  campaigns: GoogleAdsCampaign[]
}

// Meta Ads API types
export interface MetaAdsCampaign {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  objective: string
  reach: number
  impressions: number
  clicks: number
  spend: number
  conversions: number
  cpm: number
  cpc: number
}

export interface MetaAdsMetrics {
  date_range: string
  total_reach: number
  total_impressions: number
  total_clicks: number
  total_spend: number
  total_conversions: number
  avg_cpm: number
  avg_cpc: number
  campaigns: MetaAdsCampaign[]
}
