/**
 * Viral Hub Module
 *
 * Central export for all viral hub functionality.
 */

// Sources
export * from './sources'

// Services
export * from './ingest'
export * from './opportunities'
export * from './generate'
export * from './briefs'

// SEO Intelligence (V2)
export * from './seo-intelligence'

// Schemas - explicitly re-export to avoid BriefRecord collision with briefs.ts
export {
  BriefStatusSchema,
  SearchContextSchema,
  CanonicalBriefSchema,
  EvidenceItemSchema,
  EvidenceSchema,
  SourceDateRangeSchema,
  BriefRecordSchema,
  YouTubeScriptOutputSchema,
  BlogPostOutputSchema,
  InstagramOutputSchema,
  ChannelSchema,
  GenerationOutputSchema,
  GenerationRecordSchema,
  GenerateBriefRequestSchema,
  ApproveBriefRequestSchema,
  RejectBriefRequestSchema,
  RegenerateAngleRequestSchema,
  GenerateContentRequestSchema,
  parseCanonicalBrief,
  safeParseCanonicalBrief,
  parseYouTubeOutput,
  parseBlogOutput,
  parseInstagramOutput,
  parseGenerationOutput,
  isValidBrief,
  getBriefValidationErrors,
} from './schemas'

export type {
  BriefStatus,
  SearchContext,
  CanonicalBrief,
  EvidenceItem,
  Evidence,
  SourceDateRange,
  BriefRecord as SchemaBriefRecord, // Renamed to avoid collision with briefs.ts
  YouTubeScriptOutput,
  BlogPostOutput,
  InstagramOutput,
  Channel,
  GenerationOutput,
  GenerationRecord,
  GenerateBriefRequest,
  ApproveBriefRequest,
  RejectBriefRequest,
  RegenerateAngleRequest,
  GenerateContentRequest,
} from './schemas'
