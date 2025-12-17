/**
 * Image Generation Types
 *
 * Simple types for image provider adapters.
 * No task mapping, no templates - just provider abstraction.
 */

export type ImageProvider = 'openai' | 'gemini'

export interface ImageGenerateRequest {
  provider: ImageProvider
  prompt: string
  size?: '1024x1024' | '1536x1024' | '1024x1536'
  quality?: 'low' | 'medium' | 'high'
  referenceImage?: File | null
}

export interface ImageGenerateResult {
  success: boolean
  imageUrl?: string
  revisedPrompt?: string
  error?: string
}

export interface ImageProviderAdapter {
  provider: ImageProvider
  generate(params: ProviderGenerateParams): Promise<ImageGenerateResult>
}

export interface ProviderGenerateParams {
  prompt: string
  size: string
  quality: string
  referenceImage?: File | null
}
