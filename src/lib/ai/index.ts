/**
 * AI Module Exports
 *
 * Central export point for all AI-related functionality.
 *
 * MVP EXPORTS (use these):
 * - AIGateway, getAIGateway - Main gateway class
 * - AITask, AIGenerateRequest, AIResult - Core types
 * - getModelForTask, calculateCost - Model utilities
 *
 * ROADMAP EXPORTS (don't use yet):
 * - providers/* - Multi-provider support
 * - evaluator.ts - Content quality scoring
 * - supabase-ai-gateway.sql - Extended database schema
 */

// ============================================
// MVP EXPORTS
// ============================================

// Main Gateway
export { AIGateway, getAIGateway } from './gateway'

// Core Types (minimal set for MVP)
export type {
  AITask,
  AIGenerateRequest,
  AIResult,
  AIUsageInfo,
} from './types'

// Model utilities
export {
  getModelForTask,
  calculateCost,
} from './models'

// ============================================
// ROADMAP EXPORTS (for future use)
// ============================================

// Full type exports (when needed)
export type {
  AIProvider,
  AICapability,
  ModelConfig,
  TaskModelMapping,
  PromptTemplate,
  AIClientContext,
  AIRequestOptions,
  AIResultMetadata,
  AIUsageLog,
  AIEvaluation,
  EvaluationCriteria,
  AIProviderAdapter,
  ProviderGenerateParams,
  ProviderGenerateResult,
} from './types'

// Model Registry (when switching models dynamically)
export {
  MODEL_REGISTRY,
  TASK_MODEL_MAPPING,
  getModel,
  getFallbackModelForTask,
  findModelsWithCapabilities,
  getAvailableTasks,
  modelSupportsCapability,
} from './models'

// Providers (when using multiple providers)
export {
  getProviderAdapter,
  isProviderAvailable,
  getAvailableProviders,
} from './providers'
