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
export type EventType = 'holiday' | 'sale' | 'campaign' | 'deadline' | 'life' | 'launch'

export interface MarketingEvent {
  id: string
  title: string
  description: string | null
  event_date: string
  event_type: EventType
  color: string
  is_global: boolean
  client_id: string | null
  created_by: string | null
  client?: {
    id: string
    name: string
  }
}

// Client types
export type ClientMemberRole = 'owner' | 'admin' | 'editor' | 'viewer'

export type ChannelType = 'google_ads' | 'meta' | 'seo' | 'klaviyo' | 'cro' | 'linkedin'

export interface ClientContext {
  // Business info
  proposition: string
  targetAudience: string
  usps: string[]
  margins?: {
    min: number
    target: number
  }
  seasonality?: string[]
  bestsellers?: string[]

  // Brand voice
  toneOfVoice: string
  brandVoice: string

  // Compliance
  doNots: string[]  // verboden claims/woorden
  mustHaves: string[] // verplichte disclaimers

  // Channels
  activeChannels: ChannelType[]
}

export interface Client {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  settings: ClientSettings
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ClientSettings {
  context?: ClientContext
  [key: string]: unknown
}

export interface ClientMembership {
  id: string
  client_id: string
  user_id: string
  role: ClientMemberRole
  created_at: string
  updated_at: string
  // Joined fields
  client?: Client
  user?: User
}

export interface ClientWithRole extends Client {
  role: ClientMemberRole | 'admin' // 'admin' for org admins
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
  client_id: string | null
  title: string
  is_archived: boolean
  created_at: string
  updated_at: string
  assistant?: Assistant
  client?: Client
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  tokens_used: number
  created_at: string
}
