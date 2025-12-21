/**
 * Customer Context Layer
 *
 * Central module for AI-powered customer intelligence.
 * All AI tools should use this module to access customer context.
 */

// Schema and validation
export {
  // Schemas
  AIContextSchema,
  ObservationSchema,
  GoalsSchema,
  EconomicsSchema,
  CompetitorSchema,
  CompetitorsSchema,
  AccessSchema,
  NextActionSchema,
  ConfidenceSchema,
  GapsSchema,
  ContextSummarySchema,
  SourceMapSchema,
  ContextVersionSchema,
  ConfidenceLevel,
  SourceType,
  ChannelTypeSchema,

  // Types
  type AIContext,
  type Observation,
  type Goals,
  type Economics,
  type Competitor,
  type Competitors,
  type Access,
  type NextAction,
  type Confidence,
  type Gaps,
  type ContextSummary,
  type SourceMap,
  type ContextVersion,
  type ChannelType,

  // Validation functions
  validateContext,
  validateSourceMap,
  validateSummary,
  formatValidationErrors,
  type ValidationResult,

  // Merge rules
  MERGE_PRIORITY,
  CONFIDENCE_OVERWRITE_THRESHOLD,
  shouldOverwrite,

  // Helpers
  createEmptyContext,
} from './schema'

// Database types
export type {
  AIContextVersion,
  ClientContext,
  SuggestedInput,
  IntakeJobType,
  IntakeJobStatus,
  IntakeJobStep,
  IntakeJobConfig,
  IntakeJob,
  ScrapedSourceType,
  PageType,
  ScrapedStructuredContent,
  ScrapedSource,
  IntakeAnswerSource,
  IntakeAnswer,
  GetContextResponse,
  GenerateContextRequest,
  GenerateContextResponse,
  ActivateVersionRequest,
  ActivateVersionResponse,
  ContextVersionListItem,
  GetVersionsResponse,
  StartIntakeRequest,
  StartIntakeResponse,
  GetIntakeJobResponse,
  SubmitIntakeAnswersRequest,
  SubmitIntakeAnswersResponse,
  EnrichmentSuggestion,
  ContextEnrichmentResult,
} from './types'
