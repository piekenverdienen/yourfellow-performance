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
  | 'fetch-url'

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
export interface LandingPageContent {
  title: string
  metaDescription: string
  headers: string[]
  mainContent: string
  extractedKeywords: string[]
  ogImage?: string
}

export interface AdCopyRequest {
  product_name: string
  product_description: string
  target_audience: string
  keywords: string[]
  tone: 'professional' | 'casual' | 'urgent' | 'friendly'
  ad_type: 'responsive_search' | 'responsive_display' | 'performance_max'
  landing_page_content?: LandingPageContent
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

export interface ClickUpSettings {
  apiKey?: string  // Stored at org level, not per client
  listId?: string  // ClickUp List ID for this client
  spaceId?: string // Optional: ClickUp Space ID
  folderId?: string // Optional: ClickUp Folder ID
}

// GA4 Monitoring Settings per client
export interface GA4MonitoringSettings {
  enabled?: boolean
  propertyId?: string  // GA4 property ID (numeric string)
  timezone?: string    // e.g., 'Europe/Amsterdam'
  metrics?: {
    sessions?: boolean
    totalUsers?: boolean
    engagementRate?: boolean
    conversions?: boolean
    purchaseRevenue?: boolean
  }
  keyEventName?: string  // Required if conversions enabled
  isEcommerce?: boolean
  thresholds?: {
    warning?: number   // Default: 20 (%)
    critical?: number  // Default: 40 (%)
    minBaseline?: number // Default: 20
  }
}

// Search Console Settings per client
export interface SearchConsoleSettings {
  enabled?: boolean
  siteUrl?: string      // Search Console property URL (e.g., https://example.com/ or sc-domain:example.com)
  dateRangeDays?: number // Default: 28
}

// Meta Ads Settings per client
export interface MetaAdsSettings {
  enabled?: boolean
  adAccountId?: string          // format: act_XXXXX
  accessToken?: string          // encrypted/stored securely
  businessId?: string           // Business Manager ID
  pixelId?: string              // Meta Pixel ID for tracking
  timezone?: string             // e.g., 'Europe/Amsterdam'
  currency?: string             // e.g., 'EUR'
  // Sync settings
  syncEnabled?: boolean
  lastSyncAt?: string           // ISO timestamp
  // Thresholds for alerts
  thresholds?: {
    frequencyWarning?: number   // Default: 2.5
    ctrDropWarning?: number     // Default: 30 (%)
    minSpendForAlert?: number   // Default: 10 (EUR)
  }
}

export interface ClientSettings {
  context?: ClientContext
  clickup?: ClickUpSettings
  ga4Monitoring?: GA4MonitoringSettings
  searchConsole?: SearchConsoleSettings
  meta?: MetaAdsSettings
  [key: string]: unknown
}

// ClickUp API Types
export interface ClickUpTask {
  id: string
  name: string
  description?: string
  status: {
    id: string
    status: string
    color: string
    type: string
    orderindex: number
  }
  priority?: {
    id: string
    priority: string
    color: string
    orderindex: string
  } | null
  assignees: ClickUpAssignee[]
  due_date?: string | null
  due_date_time?: boolean
  start_date?: string | null
  time_estimate?: number | null
  url: string
  list: {
    id: string
    name: string
  }
  folder: {
    id: string
    name: string
  }
  space: {
    id: string
  }
  date_created: string
  date_updated: string
  date_closed?: string | null
}

export interface ClickUpAssignee {
  id: number
  username: string
  email: string
  color: string
  profilePicture?: string | null
  initials: string
}

export interface ClickUpStatus {
  id: string
  status: string
  color: string
  type: string
  orderindex: number
}

export interface ClickUpList {
  id: string
  name: string
  statuses: ClickUpStatus[]
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
  content_type?: 'text' | 'multimodal' | 'image_generation' | 'file_analysis'
  tokens_used: number
  created_at: string
  attachments?: MessageAttachment[]
}

// Multimodal Chat Types
export type ChatActionType = 'chat' | 'image_analyze' | 'image_generate' | 'file_analyze'

export interface MessageAttachment {
  id: string
  message_id?: string
  conversation_id: string
  user_id: string
  attachment_type: 'image' | 'document' | 'generated_image'
  file_name: string
  file_type: string
  file_size: number
  file_path: string
  public_url: string
  width?: number
  height?: number
  extracted_text?: string
  generation_prompt?: string
  client_id?: string
  assistant_slug?: string
  created_at: string
}

// Multimodal message content structure (for API)
export interface MultimodalContent {
  type: 'text' | 'image' | 'document'
  text?: string
  image_url?: string
  file_url?: string
  file_name?: string
  file_type?: string
  extracted_text?: string
}

export interface ChatRequest {
  conversationId?: string
  assistantId: string
  message: string
  clientId?: string
  model?: string
  action?: ChatActionType
  attachments?: {
    type: 'image' | 'document'
    url: string
    fileName?: string
    fileType?: string
    extractedText?: string
  }[]
  imagePrompt?: string // For image generation
}

export interface UploadedFile {
  id: string
  file: File
  preview?: string
  status: 'pending' | 'uploading' | 'uploaded' | 'error'
  url?: string
  error?: string
}
