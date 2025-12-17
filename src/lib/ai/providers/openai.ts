/**
 * OpenAI Provider Adapter
 *
 * Adapter for GPT models via OpenAI SDK.
 */

import OpenAI from 'openai'
import type {
  AIProviderAdapter,
  ProviderGenerateParams,
  ProviderGenerateResult,
} from '../types'

export class OpenAIAdapter implements AIProviderAdapter {
  provider = 'openai' as const
  private client: OpenAI

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY
    if (!key) {
      throw new Error('OPENAI_API_KEY is required')
    }
    this.client = new OpenAI({ apiKey: key })
  }

  async generateText(params: ProviderGenerateParams): Promise<ProviderGenerateResult> {
    const { model, systemPrompt, userPrompt, maxTokens, temperature } = params

    const response = await this.client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
    })

    const content = response.choices[0]?.message?.content || ''

    return {
      content,
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      rawResponse: response,
    }
  }
}

/**
 * Create a singleton instance for use across the app
 */
let openaiInstance: OpenAIAdapter | null = null

export function getOpenAIAdapter(): OpenAIAdapter {
  if (!openaiInstance) {
    openaiInstance = new OpenAIAdapter()
  }
  return openaiInstance
}
