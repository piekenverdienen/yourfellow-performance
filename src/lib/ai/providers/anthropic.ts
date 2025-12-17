/**
 * Anthropic Provider Adapter
 *
 * Adapter for Claude models via Anthropic SDK.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  AIProviderAdapter,
  ProviderGenerateParams,
  ProviderGenerateResult,
} from '../types'

export class AnthropicAdapter implements AIProviderAdapter {
  provider = 'anthropic' as const
  private client: Anthropic

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is required')
    }
    this.client = new Anthropic({ apiKey: key })
  }

  async generateText(params: ProviderGenerateParams): Promise<ProviderGenerateResult> {
    const { model, systemPrompt, userPrompt, maxTokens, temperature } = params

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    })

    // Extract text content
    const textContent = response.content.find(block => block.type === 'text')
    let content = textContent ? textContent.text : ''

    // Strip markdown code blocks if present
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    return {
      content,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      rawResponse: response,
    }
  }
}

/**
 * Create a singleton instance for use across the app
 */
let anthropicInstance: AnthropicAdapter | null = null

export function getAnthropicAdapter(): AnthropicAdapter {
  if (!anthropicInstance) {
    anthropicInstance = new AnthropicAdapter()
  }
  return anthropicInstance
}
