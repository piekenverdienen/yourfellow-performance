/**
 * AI Model Registry
 *
 * Central configuration for all AI models and task-to-model mappings.
 * No model names should leak to frontend - only task types.
 */

import type { ModelConfig, AITask, TaskModelMapping, AICapability } from './types'

// ============================================
// Model Configurations
// ============================================

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // Anthropic Models
  'claude-sonnet': {
    id: 'claude-sonnet',
    provider: 'anthropic',
    modelName: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet',
    costPer1kInputTokens: 0.3,  // $3 per 1M
    costPer1kOutputTokens: 1.5, // $15 per 1M
    latencyScore: 2,
    qualityScore: 4,
    maxTokens: 8192,
    capabilities: ['text-generation', 'chat', 'code-generation', 'function-calling', 'image-analysis'],
    isDefault: true,
  },
  'claude-haiku': {
    id: 'claude-haiku',
    provider: 'anthropic',
    modelName: 'claude-3-5-haiku-20241022',
    displayName: 'Claude Haiku',
    costPer1kInputTokens: 0.08,  // $0.80 per 1M
    costPer1kOutputTokens: 0.4,  // $4 per 1M
    latencyScore: 1,
    qualityScore: 3,
    maxTokens: 8192,
    capabilities: ['text-generation', 'chat', 'code-generation', 'function-calling'],
  },
  'claude-opus': {
    id: 'claude-opus',
    provider: 'anthropic',
    modelName: 'claude-3-opus-20240229',
    displayName: 'Claude Opus',
    costPer1kInputTokens: 1.5,  // $15 per 1M
    costPer1kOutputTokens: 7.5, // $75 per 1M
    latencyScore: 4,
    qualityScore: 5,
    maxTokens: 4096,
    capabilities: ['text-generation', 'chat', 'code-generation', 'function-calling', 'image-analysis'],
  },

  // OpenAI Models
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    modelName: 'gpt-4o',
    displayName: 'GPT-4o',
    costPer1kInputTokens: 0.25,  // $2.50 per 1M
    costPer1kOutputTokens: 1.0,  // $10 per 1M
    latencyScore: 2,
    qualityScore: 4,
    maxTokens: 16384,
    capabilities: ['text-generation', 'chat', 'code-generation', 'function-calling', 'image-analysis'],
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    modelName: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    costPer1kInputTokens: 0.015,  // $0.15 per 1M
    costPer1kOutputTokens: 0.06,  // $0.60 per 1M
    latencyScore: 1,
    qualityScore: 3,
    maxTokens: 16384,
    capabilities: ['text-generation', 'chat', 'code-generation', 'function-calling'],
  },

  // Google Models
  'gemini-flash': {
    id: 'gemini-flash',
    provider: 'google',
    modelName: 'gemini-2.0-flash',
    displayName: 'Gemini Flash',
    costPer1kInputTokens: 0.01,   // Very cheap
    costPer1kOutputTokens: 0.04,
    latencyScore: 1,
    qualityScore: 3,
    maxTokens: 8192,
    capabilities: ['text-generation', 'chat', 'image-analysis'],
  },
  'gemini-pro': {
    id: 'gemini-pro',
    provider: 'google',
    modelName: 'gemini-1.5-pro',
    displayName: 'Gemini Pro',
    costPer1kInputTokens: 0.125,
    costPer1kOutputTokens: 0.5,
    latencyScore: 2,
    qualityScore: 4,
    maxTokens: 8192,
    capabilities: ['text-generation', 'chat', 'code-generation', 'function-calling', 'image-analysis'],
  },
}

// ============================================
// Task to Model Mapping
// ============================================

export const TASK_MODEL_MAPPING: Record<AITask, TaskModelMapping> = {
  google_ads_copy: {
    task: 'google_ads_copy',
    defaultModelId: 'claude-sonnet',
    fallbackModelId: 'gpt-4o',
    requiredCapabilities: ['text-generation'],
  },
  social_post: {
    task: 'social_post',
    defaultModelId: 'claude-sonnet',
    fallbackModelId: 'gpt-4o',
    requiredCapabilities: ['text-generation'],
  },
  seo_content: {
    task: 'seo_content',
    defaultModelId: 'claude-sonnet',
    fallbackModelId: 'gpt-4o',
    requiredCapabilities: ['text-generation'],
  },
  seo_meta: {
    task: 'seo_meta',
    defaultModelId: 'claude-haiku',  // Fast & cheap for short meta tags
    fallbackModelId: 'gpt-4o-mini',
    requiredCapabilities: ['text-generation'],
  },
  image_prompt: {
    task: 'image_prompt',
    defaultModelId: 'claude-haiku',  // Fast for simple prompts
    fallbackModelId: 'gpt-4o-mini',
    requiredCapabilities: ['text-generation'],
  },
  cro_analysis: {
    task: 'cro_analysis',
    defaultModelId: 'claude-sonnet',  // Needs reasoning
    fallbackModelId: 'gpt-4o',
    requiredCapabilities: ['text-generation', 'image-analysis'],
  },
  chat: {
    task: 'chat',
    defaultModelId: 'claude-sonnet',
    fallbackModelId: 'gpt-4o',
    requiredCapabilities: ['chat', 'function-calling'],
  },
  workflow_agent: {
    task: 'workflow_agent',
    defaultModelId: 'claude-sonnet',
    fallbackModelId: 'gpt-4o',
    requiredCapabilities: ['text-generation', 'function-calling'],
  },
  content_evaluation: {
    task: 'content_evaluation',
    defaultModelId: 'claude-haiku',  // Fast & cheap for evaluations
    fallbackModelId: 'gpt-4o-mini',
    requiredCapabilities: ['text-generation'],
  },
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get model configuration by ID
 */
export function getModel(modelId: string): ModelConfig | null {
  return MODEL_REGISTRY[modelId] || null
}

/**
 * Get the default model for a task
 */
export function getModelForTask(task: AITask): ModelConfig {
  const mapping = TASK_MODEL_MAPPING[task]
  const model = MODEL_REGISTRY[mapping.defaultModelId]

  if (!model) {
    // Fallback to first available model with required capabilities
    const fallback = MODEL_REGISTRY[mapping.fallbackModelId || 'claude-sonnet']
    if (!fallback) {
      throw new Error(`No model available for task: ${task}`)
    }
    return fallback
  }

  return model
}

/**
 * Get fallback model for a task
 */
export function getFallbackModelForTask(task: AITask): ModelConfig | null {
  const mapping = TASK_MODEL_MAPPING[task]
  if (!mapping.fallbackModelId) return null
  return MODEL_REGISTRY[mapping.fallbackModelId] || null
}

/**
 * Find models with specific capabilities
 */
export function findModelsWithCapabilities(
  capabilities: AICapability[],
  options?: { maxLatency?: number; minQuality?: number }
): ModelConfig[] {
  return Object.values(MODEL_REGISTRY).filter(model => {
    // Check all required capabilities
    const hasCapabilities = capabilities.every(cap =>
      model.capabilities.includes(cap)
    )
    if (!hasCapabilities) return false

    // Apply optional filters
    if (options?.maxLatency && model.latencyScore > options.maxLatency) {
      return false
    }
    if (options?.minQuality && model.qualityScore < options.minQuality) {
      return false
    }

    return true
  })
}

/**
 * Calculate estimated cost for a request
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = MODEL_REGISTRY[modelId]
  if (!model) return 0

  const inputCost = (inputTokens / 1000) * model.costPer1kInputTokens
  const outputCost = (outputTokens / 1000) * model.costPer1kOutputTokens

  return Math.round((inputCost + outputCost) * 100) / 100  // Round to 2 decimals
}

/**
 * Get all available tasks
 */
export function getAvailableTasks(): AITask[] {
  return Object.keys(TASK_MODEL_MAPPING) as AITask[]
}

/**
 * Check if a model supports a specific capability
 */
export function modelSupportsCapability(
  modelId: string,
  capability: AICapability
): boolean {
  const model = MODEL_REGISTRY[modelId]
  return model ? model.capabilities.includes(capability) : false
}
