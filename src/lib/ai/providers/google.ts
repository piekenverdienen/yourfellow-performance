/**
 * Google Provider Adapter
 *
 * Adapter for Gemini models via Google GenAI SDK.
 */

import { GoogleGenAI } from '@google/genai'
import type {
  AIProviderAdapter,
  ProviderGenerateParams,
  ProviderGenerateResult,
} from '../types'

export class GoogleAdapter implements AIProviderAdapter {
  provider = 'google' as const
  private client: GoogleGenAI

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
    if (!key) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY is required')
    }
    this.client = new GoogleGenAI({ apiKey: key })
  }

  async generateText(params: ProviderGenerateParams): Promise<ProviderGenerateResult> {
    const { model, systemPrompt, userPrompt, maxTokens, temperature } = params

    const response = await this.client.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: maxTokens,
        temperature,
      },
    })

    const content = response.text || ''

    // Google SDK doesn't always return exact token counts
    // Estimate based on characters (~4 chars per token)
    const estimatedInputTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4)
    const estimatedOutputTokens = Math.ceil(content.length / 4)

    return {
      content,
      inputTokens: response.usageMetadata?.promptTokenCount || estimatedInputTokens,
      outputTokens: response.usageMetadata?.candidatesTokenCount || estimatedOutputTokens,
      rawResponse: response,
    }
  }
}

/**
 * Create a singleton instance for use across the app
 */
let googleInstance: GoogleAdapter | null = null

export function getGoogleAdapter(): GoogleAdapter {
  if (!googleInstance) {
    googleInstance = new GoogleAdapter()
  }
  return googleInstance
}
