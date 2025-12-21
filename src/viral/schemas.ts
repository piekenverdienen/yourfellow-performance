/**
 * Viral Hub Schemas
 *
 * Zod schemas for validating AI outputs and data structures.
 * These schemas ensure the "feilloos" (predictable, structured) nature of the system.
 */

import { z } from 'zod'

// ============================================
// Brief Status
// ============================================

export const BriefStatusSchema = z.enum(['draft', 'approved', 'rejected', 'superseded'])
export type BriefStatus = z.infer<typeof BriefStatusSchema>

// ============================================
// Canonical Content Brief Schema
// ============================================
// The brief must be readable in < 60 seconds
// Fixed 5 fields + evidence summary + no-go claims

// Search Context Schema (for SEO-driven briefs)
export const SearchContextSchema = z.object({
  // What is the searcher looking for?
  searcher_question: z.string().max(300).describe(
    'What question or need does the searcher have? Written from their perspective.'
  ),

  // What's missing in current top results?
  competitive_gap: z.string().max(300).describe(
    'What is missing in the current top search results that we can provide?'
  ),

  // How do we differentiate?
  our_differentiator: z.string().max(200).describe(
    'One sentence on how we stand out from existing content.'
  ),

  // Primary query we're targeting
  primary_query: z.string().describe('The main search query we are targeting'),

  // Intent classification
  intent: z.enum(['informational', 'commercial', 'transactional']).describe(
    'What type of intent does the searcher have?'
  ),

  // What to avoid
  avoid: z.array(z.string()).default([]).describe(
    'Things to avoid in the content to maintain search relevance.'
  ),
})

export type SearchContext = z.infer<typeof SearchContextSchema>

export const CanonicalBriefSchema = z.object({
  // 1. Core tension: the conflict/frustration/curiosity driving engagement
  core_tension: z.string().min(10).max(500).describe(
    'What is the core conflict, frustration, or curiosity that is driving engagement on this topic?'
  ),

  // 2. Our angle: the stance/POV we take (concise)
  our_angle: z.string().min(10).max(300).describe(
    'What is our unique take or perspective on this topic? Be specific and opinionated.'
  ),

  // 3. Key claim: the one thing we're asserting
  key_claim: z.string().min(10).max(200).describe(
    'What is the single main claim or message we want to convey?'
  ),

  // 4. Proof points: bullets that reference source signals
  proof_points: z.array(z.string().min(5).max(200)).min(2).max(6).describe(
    'Specific evidence from the source signals that support our key claim. Each point should reference a specific Reddit post or comment.'
  ),

  // 5. Why now: why this is timely (grounded in recency/volume)
  why_now: z.string().min(10).max(300).describe(
    'Why is this topic relevant right now? Reference the recency or volume of discussions.'
  ),

  // Guardrails: no-go claims derived from client context
  no_go_claims: z.array(z.string()).default([]).describe(
    'Claims we must NOT make based on client brand guidelines and compliance rules.'
  ),

  // NEW: Search context (optional, for SEO-driven content)
  search_context: SearchContextSchema.optional().describe(
    'Search positioning context - only included for content with search demand.'
  ),

  // NEW: Recommended channel based on scoring
  recommended_channel: z.enum(['blog', 'youtube', 'instagram']).optional().describe(
    'The recommended primary channel based on viral + search scoring.'
  ),

  // NEW: Channel recommendation rationale
  channel_rationale: z.string().max(200).optional().describe(
    'Brief explanation of why this channel was recommended.'
  ),
})

export type CanonicalBrief = z.infer<typeof CanonicalBriefSchema>

// ============================================
// Evidence Schema
// ============================================

export const EvidenceItemSchema = z.object({
  signal_id: z.string().uuid(),
  url: z.string().url(),
  title: z.string(),
  excerpt: z.string().optional(),
  subreddit: z.string().optional(),
  upvotes: z.number().optional(),
  comments: z.number().optional(),
})

export const EvidenceSchema = z.array(EvidenceItemSchema)
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>
export type Evidence = z.infer<typeof EvidenceSchema>

// ============================================
// Source Date Range Schema
// ============================================

export const SourceDateRangeSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
})

export type SourceDateRange = z.infer<typeof SourceDateRangeSchema>

// ============================================
// Full Brief Record (including metadata)
// ============================================

export const BriefRecordSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid().nullable(),
  ideaId: z.string().uuid().nullable(),
  brief: CanonicalBriefSchema,
  evidence: EvidenceSchema,
  sourceDateRange: SourceDateRangeSchema.nullable(),
  status: BriefStatusSchema,
  approvedBy: z.string().uuid().nullable(),
  approvedAt: z.string().datetime().nullable(),
  rejectionReason: z.string().nullable(),
  supersededBy: z.string().uuid().nullable(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type BriefRecord = z.infer<typeof BriefRecordSchema>

// ============================================
// YouTube Script Output Schema
// ============================================

export const YouTubeScriptOutputSchema = z.object({
  // Titles (3 options)
  titles: z.array(z.string().min(10).max(100)).min(1).max(5),

  // Thumbnail text concepts (short, impactful)
  thumbnail_concepts: z.array(z.object({
    text: z.string().max(30),
    visual_description: z.string(),
  })).min(2).max(4),

  // Hook script (first 30 seconds, crucial for retention)
  hook_script: z.string().min(100).describe(
    'The spoken script for the first 30 seconds. Must grab attention immediately.'
  ),

  // Full spoken script
  full_script: z.string().min(500).describe(
    'The complete spoken script with natural transitions.'
  ),

  // Video structure/outline
  outline: z.array(z.object({
    section: z.string(),
    duration: z.string().describe('e.g., "0:30-1:00"'),
    key_points: z.array(z.string()),
  })).min(3),

  // B-roll cues for editor
  broll_cues: z.array(z.object({
    timestamp: z.string(),
    description: z.string(),
    source_suggestion: z.string().optional(),
  })).optional(),

  // Retention beats (keep viewer engaged)
  retention_beats: z.array(z.object({
    timestamp: z.string(),
    technique: z.string().describe('e.g., "pattern interrupt", "question hook", "visual change"'),
    note: z.string(),
  })).optional(),

  // Call to action
  cta: z.object({
    script: z.string(),
    placement: z.string().describe('When in the video this should appear'),
  }),

  // Metadata
  estimated_duration: z.string().describe('e.g., "8-10 minutes"'),
  target_audience: z.string().optional(),
})

export type YouTubeScriptOutput = z.infer<typeof YouTubeScriptOutputSchema>

// ============================================
// Blog Post Output Schema
// ============================================

export const BlogPostOutputSchema = z.object({
  // SEO title (50-60 chars)
  seo_title: z.string().min(30).max(70),

  // Meta description (150-160 chars)
  meta_description: z.string().min(120).max(170),

  // Primary and secondary keywords
  primary_keyword: z.string(),
  secondary_keywords: z.array(z.string()).min(2).max(8),

  // Outline with headers
  outline: z.array(z.object({
    type: z.enum(['h2', 'h3']),
    text: z.string(),
    key_points: z.array(z.string()),
    word_count_target: z.number().optional(),
  })).min(3),

  // Full draft (markdown)
  full_draft: z.string().min(500).optional().describe(
    'The complete blog post in Markdown format.'
  ),

  // FAQ section for featured snippets
  faq: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).min(2).max(6),

  // Internal link placeholders
  internal_links: z.array(z.object({
    anchor_text: z.string(),
    suggested_page: z.string(),
    context: z.string().optional(),
  })).optional(),

  // CTA strategy
  cta: z.object({
    type: z.string().describe('e.g., "newsletter signup", "product demo", "download"'),
    placement: z.string(),
    copy: z.string(),
  }),

  // Metadata
  estimated_word_count: z.number(),
  reading_time_minutes: z.number(),
})

export type BlogPostOutput = z.infer<typeof BlogPostOutputSchema>

// ============================================
// Instagram Output Schema
// ============================================

export const InstagramOutputSchema = z.object({
  // Caption (max 2200 chars, first 125 crucial)
  caption: z.string().min(50).max(2200),

  // Hook options (3 variants for the first line)
  hooks: z.array(z.string().max(125)).min(2).max(5),

  // Hashtags (20-30, mix of large and niche)
  hashtags: z.array(z.string().regex(/^#[\w]+$/)).min(10).max(30),

  // Carousel slides outline (if applicable)
  carousel_slides: z.array(z.object({
    slide_number: z.number(),
    headline: z.string().max(50),
    content: z.string().max(200),
    visual_suggestion: z.string(),
  })).min(1).max(10).optional(),

  // CTA suggestion
  cta: z.string(),

  // Posting tips
  posting_tips: z.object({
    best_time: z.string().optional(),
    engagement_hooks: z.array(z.string()).optional(),
  }).optional(),
})

export type InstagramOutput = z.infer<typeof InstagramOutputSchema>

// ============================================
// Generation Record Schema
// ============================================

export const ChannelSchema = z.enum(['youtube', 'blog', 'instagram'])
export type Channel = z.infer<typeof ChannelSchema>

export const GenerationOutputSchema = z.union([
  YouTubeScriptOutputSchema,
  BlogPostOutputSchema,
  InstagramOutputSchema,
])

export type GenerationOutput = z.infer<typeof GenerationOutputSchema>

export const GenerationRecordSchema = z.object({
  id: z.string().uuid(),
  briefId: z.string().uuid(),
  channel: ChannelSchema,
  output: GenerationOutputSchema,
  modelId: z.string().nullable(),
  tokens: z.object({
    input: z.number(),
    output: z.number(),
    total: z.number(),
  }).nullable(),
  version: z.number(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
})

export type GenerationRecord = z.infer<typeof GenerationRecordSchema>

// ============================================
// API Request/Response Schemas
// ============================================

export const GenerateBriefRequestSchema = z.object({
  ideaId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  signalIds: z.array(z.string().uuid()).min(1).optional(),
  industry: z.string().min(1),
  instruction: z.string().optional().describe(
    'Optional instruction to guide the brief angle'
  ),
})

export type GenerateBriefRequest = z.infer<typeof GenerateBriefRequestSchema>

export const ApproveBriefRequestSchema = z.object({
  briefId: z.string().uuid(),
})

export type ApproveBriefRequest = z.infer<typeof ApproveBriefRequestSchema>

export const RejectBriefRequestSchema = z.object({
  briefId: z.string().uuid(),
  reason: z.string().optional(),
})

export type RejectBriefRequest = z.infer<typeof RejectBriefRequestSchema>

export const RegenerateAngleRequestSchema = z.object({
  briefId: z.string().uuid(),
  instruction: z.string().optional().describe(
    'What should be different about the new angle?'
  ),
})

export type RegenerateAngleRequest = z.infer<typeof RegenerateAngleRequestSchema>

export const GenerateContentRequestSchema = z.object({
  briefId: z.string().uuid(),
  channel: ChannelSchema,
  options: z.object({
    targetAudience: z.string().optional(),
    videoLength: z.string().optional(),
    wordCount: z.number().optional(),
  }).optional(),
})

export type GenerateContentRequest = z.infer<typeof GenerateContentRequestSchema>

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate and parse a canonical brief from AI output
 */
export function parseCanonicalBrief(data: unknown): CanonicalBrief {
  return CanonicalBriefSchema.parse(data)
}

/**
 * Safely validate a brief, returning null on failure
 */
export function safeParseCanonicalBrief(data: unknown): CanonicalBrief | null {
  const result = CanonicalBriefSchema.safeParse(data)
  return result.success ? result.data : null
}

/**
 * Validate YouTube script output
 */
export function parseYouTubeOutput(data: unknown): YouTubeScriptOutput {
  return YouTubeScriptOutputSchema.parse(data)
}

/**
 * Validate Blog post output
 */
export function parseBlogOutput(data: unknown): BlogPostOutput {
  return BlogPostOutputSchema.parse(data)
}

/**
 * Validate Instagram output
 */
export function parseInstagramOutput(data: unknown): InstagramOutput {
  return InstagramOutputSchema.parse(data)
}

/**
 * Validate generation output based on channel
 */
export function parseGenerationOutput(channel: Channel, data: unknown): GenerationOutput {
  switch (channel) {
    case 'youtube':
      return parseYouTubeOutput(data)
    case 'blog':
      return parseBlogOutput(data)
    case 'instagram':
      return parseInstagramOutput(data)
    default:
      throw new Error(`Unknown channel: ${channel}`)
  }
}

/**
 * Check if data is a valid brief (without throwing)
 */
export function isValidBrief(data: unknown): data is CanonicalBrief {
  return CanonicalBriefSchema.safeParse(data).success
}

/**
 * Get validation errors for a brief
 */
export function getBriefValidationErrors(data: unknown): string[] {
  const result = CanonicalBriefSchema.safeParse(data)
  if (result.success) return []

  return result.error.issues.map(err =>
    `${err.path.join('.')}: ${err.message}`
  )
}
