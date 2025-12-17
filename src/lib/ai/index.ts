/**
 * AI Module Exports
 *
 * Central export point for all AI-related functionality.
 */

// Main Gateway
export { AIGateway, getAIGateway, aiGateway } from './gateway'

// Types
export type {
  // Provider & Model
  AIProvider,
  AICapability,
  ModelConfig,

  // Tasks
  AITask,
  TaskModelMapping,

  // Templates
  PromptTemplate,
  TemplateVariable,

  // Client Context
  AIClientContext,

  // Request & Response
  AIGenerateRequest,
  AIRequestOptions,
  AIResult,
  AIUsageInfo,
  AIResultMetadata,

  // Usage & Evaluation
  AIUsageLog,
  AIEvaluation,
  EvaluationCriteria,

  // Provider Adapter
  AIProviderAdapter,
  ProviderGenerateParams,
  ProviderGenerateResult,
} from './types'

// Model Registry
export {
  MODEL_REGISTRY,
  TASK_MODEL_MAPPING,
  getModel,
  getModelForTask,
  getFallbackModelForTask,
  findModelsWithCapabilities,
  calculateCost,
  getAvailableTasks,
  modelSupportsCapability,
} from './models'

// Providers
export {
  getProviderAdapter,
  isProviderAvailable,
  getAvailableProviders,
} from './providers'
