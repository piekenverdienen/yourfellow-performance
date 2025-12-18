/**
 * Search Console Types
 * Types for Search Console data, queries, branded keywords, topic clusters, and content groups
 */

// ============================================
// Base Query Types
// ============================================

export interface SearchConsoleQuery {
  id: string
  clientId: string
  query: string

  // Aggregated metrics
  uniqueImpressions: number
  totalClicks: number
  bestPosition: number | null
  averageCtr: number | null

  // Page count
  pageCount: number

  // Classification
  isQuestion: boolean
  isBuyerKeyword: boolean
  isComparisonKeyword: boolean
  isBranded: boolean

  // Tracking
  isWatching: boolean
  hasRelevantPage: boolean
  mentionCount: number

  // Metadata
  firstSeenAt: string
  lastSyncedAt: string

  // Relations (optional, loaded when needed)
  pages?: SearchConsoleQueryPage[]
  history?: SearchConsoleQueryHistory[]
  clusters?: TopicCluster[]
}

export interface SearchConsoleQueryHistory {
  id: string
  queryId: string

  dateStart: string
  dateEnd: string

  impressions: number
  clicks: number
  position: number | null
  ctr: number | null

  syncedAt: string
}

export interface SearchConsoleQueryPage {
  id: string
  queryId: string
  pageUrl: string

  // Metrics
  impressions: number
  clicks: number
  position: number | null
  ctr: number | null

  // Content analysis
  mentionCount: number
  inTitle: boolean
  inH1: boolean
  inH2: boolean

  lastAnalyzedAt: string | null
}

// ============================================
// Branded Keywords
// ============================================

export type BrandedKeywordMatchType = 'contains' | 'exact' | 'starts_with'

export interface BrandedKeyword {
  id: string
  clientId: string
  keyword: string
  matchType: BrandedKeywordMatchType
  createdAt: string
}

export interface BrandedKeywordInput {
  keyword: string
  matchType?: BrandedKeywordMatchType
}

// ============================================
// Topic Clusters
// ============================================

export interface TopicCluster {
  id: string
  clientId: string
  name: string
  description: string | null
  color: string

  // Matching rules
  matchKeywords: string[]
  matchRegex: string | null

  // Aggregated metrics
  queryCount: number
  totalImpressions: number
  totalClicks: number

  createdAt: string
  updatedAt: string

  // Relations (optional)
  queries?: SearchConsoleQuery[]
}

export interface TopicClusterInput {
  name: string
  description?: string
  color?: string
  matchKeywords: string[]
  matchRegex?: string
}

export interface TopicClusterQuery {
  id: string
  clusterId: string
  queryId: string
  matchedBy: 'keyword' | 'regex' | 'manual'
  createdAt: string
}

// ============================================
// Content Groups
// ============================================

export interface ContentGroup {
  id: string
  clientId: string
  name: string
  description: string | null
  color: string

  // Matching rules
  urlPatterns: string[]
  urlRegex: string | null

  // Aggregated metrics
  pageCount: number
  totalImpressions: number
  totalClicks: number

  createdAt: string
  updatedAt: string

  // Relations (optional)
  pages?: ContentGroupPage[]
}

export interface ContentGroupInput {
  name: string
  description?: string
  color?: string
  urlPatterns: string[]
  urlRegex?: string
}

export interface ContentGroupPage {
  id: string
  groupId: string
  pageUrl: string

  impressions: number
  clicks: number

  matchedBy: 'pattern' | 'regex' | 'manual'
  createdAt: string
}

// ============================================
// Query Filters & Sorting
// ============================================

export interface QueryFilters {
  watching?: boolean
  hasRelevantPage?: boolean
  isQuestion?: boolean
  isBuyerKeyword?: boolean
  isComparisonKeyword?: boolean
  isBranded?: boolean
  nonBranded?: boolean // inverse of isBranded
  noMentions?: boolean
  minImpressions?: number
  maxImpressions?: number
  noClicks?: boolean
  positionMin?: number
  positionMax?: number
  clusterId?: string
  search?: string
}

export type QuerySortField =
  | 'query'
  | 'uniqueImpressions'
  | 'totalClicks'
  | 'bestPosition'
  | 'averageCtr'
  | 'mentionCount'
  | 'pageCount'
  | 'firstSeenAt'
  | 'lastSyncedAt'

export type SortOrder = 'asc' | 'desc'

export interface QueryListParams {
  clientId: string
  filters?: QueryFilters
  sortBy?: QuerySortField
  sortOrder?: SortOrder
  limit?: number
  offset?: number
  dateStart?: string
  dateEnd?: string
}

// ============================================
// API Response Types
// ============================================

export interface QueryListResponse {
  queries: SearchConsoleQuery[]
  total: number
  hasMore: boolean
  aggregates: QueryAggregates
}

export interface QueryAggregates {
  totalQueries: number
  totalImpressions: number
  totalClicks: number
  averagePosition: number
  watchingCount: number
  brandedCount: number
  questionsCount: number
  noMentionsCount: number
}

export interface SyncResult {
  success: boolean
  queriesProcessed: number
  queriesAdded: number
  queriesUpdated: number
  pagesProcessed: number
  errors: string[]
  syncedAt: string
}

// ============================================
// Date Range Presets
// ============================================

export type DateRangePreset = '7d' | '28d' | '90d' | 'custom'

export interface DateRange {
  start: string
  end: string
  preset?: DateRangePreset
}

// ============================================
// Query Classification Rules
// ============================================

export const BUYER_KEYWORDS_NL = [
  'kopen',
  'bestellen',
  'prijs',
  'prijzen',
  'goedkoop',
  'goedkoopste',
  'beste',
  'aanbieding',
  'korting',
  'actie',
  'sale',
  'offerte',
  'kosten',
  'waar koop',
  'online bestellen',
]

export const COMPARISON_KEYWORDS_NL = [
  'vs',
  'versus',
  'of',
  'verschil',
  'vergelijk',
  'vergelijken',
  'alternatief',
  'alternatieven',
  'beter dan',
  'review',
  'ervaring',
  'ervaringen',
]

export const QUESTION_STARTERS_NL = [
  'wat',
  'waarom',
  'hoe',
  'wanneer',
  'waar',
  'wie',
  'welke',
  'hoeveel',
  'kan',
  'kun',
  'moet',
  'is',
  'zijn',
]

// ============================================
// Opportunity Types
// ============================================

export type OpportunityType =
  | 'quick_win'      // Position 4-10, high impressions
  | 'page_2'         // Position 11-20, good impressions
  | 'missing_mention'// High impressions, 0 mentions
  | 'low_ctr'        // Good position, low CTR
  | 'buyer_gap'      // Buyer keywords without dedicated content
  | 'brand_monitor'  // Branded queries to watch

export interface Opportunity {
  type: OpportunityType
  query: SearchConsoleQuery
  reason: string
  priority: 'high' | 'medium' | 'low'
  suggestedAction: string
  potentialImpact: string
}

// ============================================
// UI State Types
// ============================================

export interface QueriesPageState {
  filters: QueryFilters
  sortBy: QuerySortField
  sortOrder: SortOrder
  dateRange: DateRange
  selectedQueryId: string | null
  isDrawerOpen: boolean
}

export interface SettingsPageState {
  activeTab: 'branded' | 'clusters' | 'groups'
  editingItemId: string | null
}

// ============================================
// Database Row Types (snake_case for Supabase)
// ============================================

export interface SearchConsoleQueryRow {
  id: string
  client_id: string
  query: string
  unique_impressions: number
  total_clicks: number
  best_position: number | null
  average_ctr: number | null
  page_count: number
  is_question: boolean
  is_buyer_keyword: boolean
  is_comparison_keyword: boolean
  is_branded: boolean
  is_watching: boolean
  has_relevant_page: boolean
  mention_count: number
  first_seen_at: string
  last_synced_at: string
}

export interface SearchConsoleQueryHistoryRow {
  id: string
  query_id: string
  date_start: string
  date_end: string
  impressions: number
  clicks: number
  position: number | null
  ctr: number | null
  synced_at: string
}

export interface SearchConsoleQueryPageRow {
  id: string
  query_id: string
  page_url: string
  impressions: number
  clicks: number
  position: number | null
  ctr: number | null
  mention_count: number
  in_title: boolean
  in_h1: boolean
  in_h2: boolean
  last_analyzed_at: string | null
}

export interface BrandedKeywordRow {
  id: string
  client_id: string
  keyword: string
  match_type: BrandedKeywordMatchType
  created_at: string
}

export interface TopicClusterRow {
  id: string
  client_id: string
  name: string
  description: string | null
  color: string
  match_keywords: string[]
  match_regex: string | null
  query_count: number
  total_impressions: number
  total_clicks: number
  created_at: string
  updated_at: string
}

export interface TopicClusterQueryRow {
  id: string
  cluster_id: string
  query_id: string
  matched_by: string
  created_at: string
}

export interface ContentGroupRow {
  id: string
  client_id: string
  name: string
  description: string | null
  color: string
  url_patterns: string[]
  url_regex: string | null
  page_count: number
  total_impressions: number
  total_clicks: number
  created_at: string
  updated_at: string
}

export interface ContentGroupPageRow {
  id: string
  group_id: string
  page_url: string
  impressions: number
  clicks: number
  matched_by: string
  created_at: string
}

// ============================================
// Utility Functions for Type Conversion
// ============================================

export function queryRowToQuery(row: SearchConsoleQueryRow): SearchConsoleQuery {
  return {
    id: row.id,
    clientId: row.client_id,
    query: row.query,
    uniqueImpressions: row.unique_impressions,
    totalClicks: row.total_clicks,
    bestPosition: row.best_position,
    averageCtr: row.average_ctr,
    pageCount: row.page_count,
    isQuestion: row.is_question,
    isBuyerKeyword: row.is_buyer_keyword,
    isComparisonKeyword: row.is_comparison_keyword,
    isBranded: row.is_branded,
    isWatching: row.is_watching,
    hasRelevantPage: row.has_relevant_page,
    mentionCount: row.mention_count,
    firstSeenAt: row.first_seen_at,
    lastSyncedAt: row.last_synced_at,
  }
}

export function brandedKeywordRowToModel(row: BrandedKeywordRow): BrandedKeyword {
  return {
    id: row.id,
    clientId: row.client_id,
    keyword: row.keyword,
    matchType: row.match_type,
    createdAt: row.created_at,
  }
}

export function topicClusterRowToModel(row: TopicClusterRow): TopicCluster {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    description: row.description,
    color: row.color,
    matchKeywords: row.match_keywords || [],
    matchRegex: row.match_regex,
    queryCount: row.query_count,
    totalImpressions: row.total_impressions,
    totalClicks: row.total_clicks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function contentGroupRowToModel(row: ContentGroupRow): ContentGroup {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    description: row.description,
    color: row.color,
    urlPatterns: row.url_patterns || [],
    urlRegex: row.url_regex,
    pageCount: row.page_count,
    totalImpressions: row.total_impressions,
    totalClicks: row.total_clicks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
