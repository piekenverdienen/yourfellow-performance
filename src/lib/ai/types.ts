/**
 * AI Gateway Types
 *
 * Central type definitions for the AI abstraction layer.
 * These types enable provider-agnostic AI operations.
 */

// ============================================
// Provider & Model Types
// ============================================

export type AIProvider = 'anthropic' | 'openai' | 'google'

export type AICapability =
  | 'text-generation'
  | 'chat'
  | 'image-generation'
  | 'image-analysis'
  | 'code-generation'
  | 'embeddings'
  | 'function-calling'

export interface ModelConfig {
  id: string
  provider: AIProvider
  modelName: string  // Actual model identifier (e.g., 'claude-sonnet-4-20250514')
  displayName: string
  costPer1kInputTokens: number  // in cents
  costPer1kOutputTokens: number // in cents
  latencyScore: 1 | 2 | 3 | 4 | 5 // 1 = fastest, 5 = slowest
  qualityScore: 1 | 2 | 3 | 4 | 5 // 1 = basic, 5 = best
  maxTokens: number
  capabilities: AICapability[]
  isDefault?: boolean
}

// ============================================
// Task Types
// ============================================

export type AITask =
  | 'google_ads_copy'
  | 'social_post'
  | 'seo_content'
  | 'seo_meta'
  | 'image_prompt'
  | 'cro_analysis'
  | 'chat'
  | 'workflow_agent'
  | 'content_evaluation'
  | 'meta_ads_insights'

export interface TaskModelMapping {
  task: AITask
  defaultModelId: string
  fallbackModelId?: string
  requiredCapabilities: AICapability[]
}

// ============================================
// Template Types
// ============================================

export interface PromptTemplate {
  id: string
  task: AITask
  version: string
  name: string
  description?: string
  systemPrompt: string
  userPromptTemplate: string  // Can contain {{variables}}
  outputSchema?: Record<string, unknown>  // JSON Schema for structured output
  temperature: number
  maxTokens: number
  xpReward: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface TemplateVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required: boolean
  description?: string
}

// ============================================
// Client Context Types (extends existing)
// ============================================

export interface AIClientContext {
  clientId: string
  clientName: string
  // Brand identity
  brandVoice: string
  toneOfVoice: string
  // Business info
  proposition: string
  targetAudience: string
  usps: string[]
  bestsellers?: string[]
  seasonality?: string[]
  margins?: {
    min: number
    target: number
  }
  // Compliance (critical for AI)
  doNotUse: string[]  // Forbidden words/claims
  mustHave: string[]  // Required disclaimers
  // Active channels for context
  activeChannels: string[]
}

// ============================================
// Request & Response Types
// ============================================

export interface AIGenerateRequest {
  task: AITask
  templateId?: string  // If not provided, uses latest active template for task
  clientId?: string
  input: Record<string, unknown>  // Variables for template
  options?: AIRequestOptions
}

export interface AIRequestOptions {
  modelOverride?: string  // Force specific model
  maxTokens?: number
  temperature?: number
  userId?: string  // For usage tracking
  skipLogging?: boolean
  metadata?: Record<string, unknown>
}

export interface AIResult<T = string> {
  success: boolean
  data?: T
  error?: string
  usage: AIUsageInfo
  metadata: AIResultMetadata
}

export interface AIUsageInfo {
  modelId: string
  provider: AIProvider
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCost: number  // in cents
  durationMs: number
}

export interface AIResultMetadata {
  templateId: string
  templateVersion: string
  clientId?: string
  requestId: string
  timestamp: string
}

// ============================================
// Usage Logging Types
// ============================================

export interface AIUsageLog {
  id: string
  userId: string
  clientId?: string
  templateId: string
  templateVersion: string
  modelId: string
  provider: AIProvider
  task: AITask
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCost: number
  durationMs: number
  success: boolean
  errorMessage?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

// ============================================
// Evaluation Types (Optional)
// ============================================

export interface AIEvaluation {
  id: string
  usageLogId: string
  score: number  // 0-100
  criteria: EvaluationCriteria[]
  feedback?: string
  evaluatedBy: 'ai' | 'human'
  evaluatorModel?: string
  createdAt: string
}

export interface EvaluationCriteria {
  name: string
  score: number  // 0-100
  weight: number // 0-1
  notes?: string
}

// ============================================
// Provider Adapter Interface
// ============================================

export interface AIProviderAdapter {
  provider: AIProvider

  generateText(params: ProviderGenerateParams): Promise<ProviderGenerateResult>

  // Future: image generation, embeddings, etc.
  // generateImage?(params: ProviderImageParams): Promise<ProviderImageResult>
}

export interface ProviderGenerateParams {
  model: string
  systemPrompt: string
  userPrompt: string
  maxTokens: number
  temperature: number
}

export interface ProviderGenerateResult {
  content: string
  inputTokens: number
  outputTokens: number
  rawResponse?: unknown
}
