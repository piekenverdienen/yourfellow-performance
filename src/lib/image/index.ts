/**
 * Image Generation Module
 *
 * Simple image generation with provider adapters.
 * Separate from AI Gateway (text-only).
 */

// Main interface
export { imageEngine, generateImage } from './engine'

// Types
export type {
  ImageProvider,
  ImageGenerateRequest,
  ImageGenerateResult,
} from './types'

// Providers (for direct use if needed)
export { OpenAIImageProvider, GeminiImageProvider } from './providers'
