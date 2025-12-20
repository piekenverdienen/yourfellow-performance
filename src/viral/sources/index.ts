/**
 * Signal Source Registry
 *
 * Central registry for all signal source providers.
 * Makes it easy to add new sources later.
 */

export * from './types'
export * from './reddit'

import type { SignalSourceProvider, ViralSourceType } from './types'
import { getRedditProvider } from './reddit'

// ============================================
// Provider Registry
// ============================================

const providers: Map<ViralSourceType, () => SignalSourceProvider> = new Map([
  ['reddit', getRedditProvider],
  // Future:
  // ['youtube', getYouTubeProvider],
  // ['tiktok', getTikTokProvider],
])

/**
 * Get a signal source provider by type
 */
export function getProvider(type: ViralSourceType): SignalSourceProvider | null {
  const factory = providers.get(type)
  if (!factory) return null
  return factory()
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): SignalSourceProvider[] {
  return Array.from(providers.values())
    .map(factory => factory())
    .filter(provider => provider.isAvailable())
}

/**
 * Check if a provider type is supported
 */
export function isProviderSupported(type: ViralSourceType): boolean {
  return providers.has(type)
}
