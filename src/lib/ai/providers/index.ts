/**
 * AI Provider Factory
 *
 * Returns the appropriate provider adapter based on provider type.
 */

import type { AIProvider, AIProviderAdapter } from '../types'
import { AnthropicAdapter, getAnthropicAdapter } from './anthropic'
import { OpenAIAdapter, getOpenAIAdapter } from './openai'
import { GoogleAdapter, getGoogleAdapter } from './google'

export { AnthropicAdapter, OpenAIAdapter, GoogleAdapter }
export { getAnthropicAdapter, getOpenAIAdapter, getGoogleAdapter }

/**
 * Get the appropriate provider adapter for a given provider type
 */
export function getProviderAdapter(provider: AIProvider): AIProviderAdapter {
  switch (provider) {
    case 'anthropic':
      return getAnthropicAdapter()
    case 'openai':
      return getOpenAIAdapter()
    case 'google':
      return getGoogleAdapter()
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * Check if a provider is available (API key configured)
 */
export function isProviderAvailable(provider: AIProvider): boolean {
  switch (provider) {
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY
    case 'openai':
      return !!process.env.OPENAI_API_KEY
    case 'google':
      return !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY)
    default:
      return false
  }
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = ['anthropic', 'openai', 'google']
  return providers.filter(isProviderAvailable)
}
