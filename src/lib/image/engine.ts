/**
 * Image Engine
 *
 * Simple interface for image generation.
 * No task mapping, no templates, just provider routing.
 */

import { OpenAIImageProvider, GeminiImageProvider } from './providers'
import type {
  ImageProvider,
  ImageGenerateRequest,
  ImageGenerateResult,
  ImageProviderAdapter,
} from './types'

// Provider instances (lazy loaded)
let openaiProvider: OpenAIImageProvider | null = null
let geminiProvider: GeminiImageProvider | null = null

function getProvider(provider: ImageProvider): ImageProviderAdapter {
  if (provider === 'openai') {
    if (!openaiProvider) {
      openaiProvider = new OpenAIImageProvider()
    }
    return openaiProvider
  }

  if (provider === 'gemini') {
    if (!geminiProvider) {
      geminiProvider = new GeminiImageProvider()
    }
    return geminiProvider
  }

  throw new Error(`Unknown image provider: ${provider}`)
}

/**
 * Generate an image using the specified provider
 */
export async function generateImage(request: ImageGenerateRequest): Promise<ImageGenerateResult> {
  const {
    provider,
    prompt,
    model,
    size = '1024x1024',
    quality = 'medium',
    referenceImage = null,
  } = request

  try {
    const providerAdapter = getProvider(provider)

    return await providerAdapter.generate({
      prompt,
      model,
      size,
      quality,
      referenceImage,
    })
  } catch (error) {
    console.error('Image generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Onbekende fout bij image generatie',
    }
  }
}

// Convenience export
export const imageEngine = {
  generateImage,
}
