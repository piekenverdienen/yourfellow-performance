import { NextResponse } from 'next/server'
import { MODEL_REGISTRY } from '@/lib/ai/models'
import { isProviderAvailable, getAvailableProviders } from '@/lib/ai/providers'

/**
 * GET /api/workflows/models
 *
 * Returns available AI models for workflow nodes.
 * Only returns models whose provider API key is configured.
 */
export async function GET() {
  try {
    const availableProviders = getAvailableProviders()

    // Filter models to only include those with available providers
    const availableModels = Object.values(MODEL_REGISTRY)
      .filter(model => isProviderAvailable(model.provider))
      .map(model => ({
        id: model.id,
        displayName: model.displayName,
        provider: model.provider,
        qualityScore: model.qualityScore,
        latencyScore: model.latencyScore,
        // Include cost info for transparency
        costPer1kInputTokens: model.costPer1kInputTokens,
        costPer1kOutputTokens: model.costPer1kOutputTokens,
      }))

    // Group by provider for easier UI rendering
    const modelsByProvider = availableModels.reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = []
      }
      acc[model.provider].push(model)
      return acc
    }, {} as Record<string, typeof availableModels>)

    return NextResponse.json({
      models: availableModels,
      modelsByProvider,
      availableProviders,
      // Default model suggestion
      defaultModel: availableModels.find(m => m.id === 'claude-sonnet')?.id || availableModels[0]?.id || null,
    })
  } catch (error) {
    console.error('Error fetching available models:', error)
    return NextResponse.json(
      { error: 'Failed to fetch available models' },
      { status: 500 }
    )
  }
}
