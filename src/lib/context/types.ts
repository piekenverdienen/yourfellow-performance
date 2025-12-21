/**
 * Database Types for Customer Context Layer
 */

import type { AIContext, ContextSummary, SourceMap } from './schema'

// ===========================================
// DATABASE RECORD TYPES
// ===========================================

export interface AIContextVersion {
  id: string
  client_id: string
  version: number
  context_json: AIContext
  summary_json: ContextSummary | null
  source_map: SourceMap
  generated_by: 'intake' | 'enrichment' | 'manual' | 'merge'
  generated_at: string
  triggered_by_user_id: string | null
  triggered_by_job_id: string | null
  created_at: string
}

export interface ClientContext {
  id: string
  client_id: string
  active_version: number
  current_context_json: AIContext | null
  current_summary_json: ContextSummary | null
  status: 'pending' | 'active' | 'needs_enrichment'
  missing_fields: string[]
  low_confidence_fields: string[]
  suggested_next_inputs: SuggestedInput[]
  created_at: string
  updated_at: string
}

export interface SuggestedInput {
  field: string
  question: string
  priority: 'high' | 'medium' | 'low'
}

// ===========================================
// INTAKE JOB TYPES
// ===========================================

export type IntakeJobType = 'full_intake' | 'scrape_only' | 'enrich_only' | 're_analyze'
export type IntakeJobStatus = 'pending' | 'scraping' | 'analyzing' | 'generating' | 'completed' | 'failed' | 'cancelled'

export interface IntakeJobStep {
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  startedAt?: string
  completedAt?: string
  error?: string
  result?: Record<string, unknown>
}

export interface IntakeJobConfig {
  website_url?: string
  competitor_urls?: string[]
  social_urls?: {
    linkedin?: string
    instagram?: string
    facebook?: string
    twitter?: string
    youtube?: string
  }
  max_pages?: number
  max_competitor_pages?: number
  skip_scraping?: boolean
}

export interface IntakeJob {
  id: string
  client_id: string
  job_type: IntakeJobType
  status: IntakeJobStatus
  progress: number
  steps_completed: IntakeJobStep[]
  current_step: string | null
  config: IntakeJobConfig
  result_version: number | null
  error_message: string | null
  error_details: Record<string, unknown> | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  started_by: string | null
}

// ===========================================
// SCRAPED SOURCE TYPES
// ===========================================

export type ScrapedSourceType =
  | 'website'
  | 'competitor'
  | 'social_linkedin'
  | 'social_instagram'
  | 'social_facebook'
  | 'social_twitter'
  | 'social_youtube'
  | 'review_google'
  | 'review_trustpilot'

export type PageType =
  | 'homepage'
  | 'about'
  | 'product'
  | 'service'
  | 'contact'
  | 'blog'
  | 'pricing'
  | 'team'
  | 'careers'
  | 'faq'
  | 'other'

export interface ScrapedStructuredContent {
  title?: string
  description?: string
  headings?: string[]
  mainContent?: string
  links?: string[]
  images?: { src: string; alt?: string }[]
  metadata?: Record<string, string>
}

export interface ScrapedSource {
  id: string
  client_id: string
  intake_job_id: string | null
  source_type: ScrapedSourceType
  url: string
  title: string | null
  raw_content: string | null
  structured_content: ScrapedStructuredContent | null
  extracted_at: string
  extraction_method: 'firecrawl' | 'playwright' | 'api'
  extraction_success: boolean
  extraction_error: string | null
  page_type: PageType | null
  depth: number
  is_competitor: boolean
  competitor_name: string | null
  created_at: string
}

// ===========================================
// INTAKE ANSWER TYPES
// ===========================================

export type IntakeAnswerSource = 'user_input' | 'form' | 'chat' | 'import'

export interface IntakeAnswer {
  id: string
  client_id: string
  question_key: string
  question_text: string | null
  answer_text: string | null
  answer_json: unknown | null
  source_type: IntakeAnswerSource
  answered_by: string | null
  answered_at: string
  is_active: boolean
  superseded_by: string | null
  created_at: string
}

// ===========================================
// API REQUEST/RESPONSE TYPES
// ===========================================

export interface GetContextResponse {
  success: boolean
  context: AIContext | null
  summary: ContextSummary | null
  version: number
  status: ClientContext['status']
  generatedAt: string | null
  error?: string
}

export interface GenerateContextRequest {
  autoActivate?: boolean
  skipScraping?: boolean
  websiteUrl?: string
  competitorUrls?: string[]
}

export interface GenerateContextResponse {
  success: boolean
  jobId: string
  message: string
  error?: string
}

export interface ActivateVersionRequest {
  version: number
}

export interface ActivateVersionResponse {
  success: boolean
  version: number
  error?: string
}

export interface ContextVersionListItem {
  version: number
  generatedBy: string
  generatedAt: string
  isActive: boolean
  summary?: string
}

export interface GetVersionsResponse {
  success: boolean
  versions: ContextVersionListItem[]
  activeVersion: number
  error?: string
}

export interface StartIntakeRequest {
  jobType?: IntakeJobType
  config?: IntakeJobConfig
}

export interface StartIntakeResponse {
  success: boolean
  jobId: string
  message: string
  error?: string
}

export interface GetIntakeJobResponse {
  success: boolean
  job: IntakeJob | null
  error?: string
}

export interface SubmitIntakeAnswersRequest {
  answers: {
    questionKey: string
    questionText?: string
    answerText?: string
    answerJson?: unknown
  }[]
}

export interface SubmitIntakeAnswersResponse {
  success: boolean
  count: number
  error?: string
}

// ===========================================
// CONTEXT ENRICHMENT TYPES
// ===========================================

export interface EnrichmentSuggestion {
  field: string
  currentValue: unknown
  suggestedValue: unknown
  source: string
  confidence: number
  reason: string
}

export interface ContextEnrichmentResult {
  updatedFields: string[]
  suggestions: EnrichmentSuggestion[]
  newVersion: number
}
