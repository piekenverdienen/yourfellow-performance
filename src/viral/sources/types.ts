/**
 * Viral Signal Source Types
 *
 * Defines the provider interface for different signal sources.
 * This enables adding new sources (YouTube, TikTok, etc.) without changing core logic.
 */

// ============================================
// Source Types
// ============================================

export type ViralSourceType = 'reddit' | 'youtube' | 'tiktok' | 'twitter' | 'hackernews'

export interface ViralSourceConfig {
  id?: string
  type: ViralSourceType
  name?: string
  industry?: string
  isActive?: boolean
}

// ============================================
// Signal Types (Normalized)
// ============================================

export interface NormalizedSignal {
  sourceType: ViralSourceType
  externalId: string
  url: string
  title: string
  author?: string
  community?: string  // e.g., subreddit name
  createdAtExternal?: Date
  metrics: SignalMetrics
  rawExcerpt?: string  // Truncated for compliance
  industry?: string
}

export interface SignalMetrics {
  upvotes?: number
  downvotes?: number
  comments?: number
  shares?: number
  views?: number
  upvoteRatio?: number
  awards?: number
  // Computed
  engagementRate?: number
  velocity?: number  // growth per hour
}

// ============================================
// Provider Interface
// ============================================

export interface SignalSourceProvider {
  type: ViralSourceType
  name: string

  /**
   * Fetch signals from the source
   * @param config - Source-specific configuration
   * @returns Normalized signals
   */
  fetchSignals(config: FetchConfig): Promise<NormalizedSignal[]>

  /**
   * Check if the source is available/configured
   */
  isAvailable(): boolean
}

// ============================================
// Fetch Configuration
// ============================================

export interface FetchConfig {
  // Common
  limit?: number
  industry?: string

  // Reddit-specific
  subreddits?: string[]
  query?: string
  sort?: 'hot' | 'top' | 'new' | 'rising'
  timeFilter?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all'

  // Future: YouTube-specific
  // channels?: string[]
  // searchQuery?: string

  // Future: TikTok-specific
  // hashtags?: string[]
}

// ============================================
// Reddit-Specific Types
// ============================================

export interface RedditPost {
  id: string
  title: string
  author: string
  subreddit: string
  permalink: string
  url: string
  selftext: string
  created_utc: number
  score: number
  upvote_ratio: number
  num_comments: number
  is_self: boolean
  domain: string
  thumbnail?: string
  total_awards_received?: number
}

export interface RedditListing {
  kind: string
  data: {
    after?: string | null
    before?: string | null
    children: Array<{
      kind: string
      data: RedditPost
    }>
  }
}

// ============================================
// Database Types
// ============================================

export interface ViralSignalDB {
  id: string
  source_id?: string
  source_type: ViralSourceType
  external_id: string
  url: string
  title: string
  author?: string
  community?: string
  created_at_external?: string
  metrics: Record<string, unknown>
  raw_excerpt?: string
  is_processed: boolean
  industry?: string
  fetched_at: string
}

export interface ViralSourceDB {
  id: string
  type: ViralSourceType
  name: string
  description?: string
  config: Record<string, unknown>
  industry?: string
  is_active: boolean
  last_fetched_at?: string
  fetch_interval_minutes: number
  created_at: string
  updated_at: string
}
