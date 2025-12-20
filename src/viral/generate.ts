/**
 * Viral Content Generation Service
 *
 * Generates content packages (IG, YouTube, Blog) from opportunities
 * using the AI Gateway.
 */

import { createClient } from '@/lib/supabase/server'
import { aiGateway } from '@/lib/ai/gateway'
import { getOpportunityWithSignals, type ViralChannel, type Opportunity } from './opportunities'
import type { AITask } from '@/lib/ai/types'
import type { NormalizedSignal } from './sources'

// ============================================
// Types
// ============================================

export interface GenerateRequest {
  opportunityId: string
  channels: ViralChannel[]
  userId?: string
  clientId?: string
  options?: GenerateOptions
}

export interface GenerateOptions {
  targetAudience?: string
  videoLength?: string  // e.g., "8-10 minutes"
  wordCount?: number    // for blog
}

export interface GeneratedContent {
  id?: string
  opportunityId: string
  channel: ViralChannel
  task: string
  output: Record<string, unknown>
  modelId?: string
  tokens?: {
    input: number
    output: number
    total: number
  }
  createdAt?: string
}

export interface GenerateResult {
  success: boolean
  generations: GeneratedContent[]
  errors: string[]
}

// ============================================
// Channel to Task Mapping
// ============================================

const CHANNEL_TASK_MAP: Record<ViralChannel, AITask> = {
  instagram: 'viral_ig_package',
  youtube: 'viral_youtube_script',
  blog: 'viral_blog_outline',
}

// ============================================
// Main Generation Function
// ============================================

export async function generateContentPackages(
  request: GenerateRequest
): Promise<GenerateResult> {
  const result: GenerateResult = {
    success: true,
    generations: [],
    errors: [],
  }

  // 1. Get opportunity with signals
  const data = await getOpportunityWithSignals(request.opportunityId)

  if (!data) {
    return {
      success: false,
      generations: [],
      errors: ['Opportunity not found'],
    }
  }

  const { opportunity, signals } = data

  // 2. Prepare source context from signals
  const sourceContext = prepareSourceContext(signals)

  // 3. Generate for each channel
  const supabase = await createClient()

  for (const channel of request.channels) {
    try {
      const generation = await generateForChannel(
        opportunity,
        channel,
        sourceContext,
        request.options,
        request.userId,
        request.clientId
      )

      // Store generation
      const { data: stored, error } = await supabase
        .from('viral_generations')
        .insert({
          opportunity_id: opportunity.id,
          task: generation.task,
          output: generation.output,
          model_id: generation.modelId,
          tokens: generation.tokens,
          created_by: request.userId,
        })
        .select('id, created_at')
        .single()

      if (error) {
        result.errors.push(`Storage error for ${channel}: ${error.message}`)
      } else if (stored) {
        generation.id = stored.id
        generation.createdAt = stored.created_at
        result.generations.push(generation)
      }
    } catch (error) {
      result.errors.push(
        `Generation error for ${channel}: ${error instanceof Error ? error.message : 'Unknown'}`
      )
    }
  }

  // 4. Update opportunity status to 'generated' if any success
  if (result.generations.length > 0) {
    await supabase
      .from('viral_opportunities')
      .update({ status: 'generated', updated_at: new Date().toISOString() })
      .eq('id', opportunity.id)
  }

  if (result.generations.length === 0 && result.errors.length > 0) {
    result.success = false
  }

  return result
}

// ============================================
// Channel-Specific Generation
// ============================================

async function generateForChannel(
  opportunity: Opportunity,
  channel: ViralChannel,
  sourceContext: string,
  options?: GenerateOptions,
  userId?: string,
  clientId?: string
): Promise<GeneratedContent> {
  const task = CHANNEL_TASK_MAP[channel]

  const input: Record<string, unknown> = {
    topic: opportunity.topic,
    angle: opportunity.angle,
    hook: opportunity.hook,
    industry: opportunity.industry,
    target_audience: options?.targetAudience || 'Algemeen publiek',
    source_context: sourceContext,
  }

  // Channel-specific inputs
  if (channel === 'youtube') {
    input.video_length = options?.videoLength || '8-10 minuten'
  }

  if (channel === 'blog') {
    input.word_count = options?.wordCount || 1500
  }

  const result = await aiGateway.generateText<Record<string, unknown>>({
    task,
    clientId: clientId || opportunity.clientId,
    input,
    options: {
      userId,
    },
  })

  if (!result.success) {
    throw new Error(result.error || 'Generation failed')
  }

  return {
    opportunityId: opportunity.id!,
    channel,
    task,
    output: typeof result.data === 'string' ? { content: result.data } : result.data!,
    modelId: result.usage.modelId,
    tokens: {
      input: result.usage.inputTokens,
      output: result.usage.outputTokens,
      total: result.usage.totalTokens,
    },
  }
}

// ============================================
// Helper Functions
// ============================================

function prepareSourceContext(signals: NormalizedSignal[]): string {
  // Create a brief summary of source signals for AI context
  const summaries = signals.slice(0, 5).map((signal, i) => {
    const engagement = signal.metrics.upvotes || 0
    const comments = signal.metrics.comments || 0

    return `${i + 1}. "${signal.title}" (${engagement} upvotes, ${comments} comments)
   Source: r/${signal.community || 'unknown'}
   ${signal.rawExcerpt ? `Summary: ${signal.rawExcerpt.substring(0, 200)}...` : ''}`
  })

  return summaries.join('\n\n')
}

/**
 * Get generations for an opportunity
 */
export async function getGenerationsForOpportunity(
  opportunityId: string
): Promise<GeneratedContent[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('viral_generations')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map(row => ({
    id: row.id,
    opportunityId: row.opportunity_id,
    channel: getChannelFromTask(row.task),
    task: row.task,
    output: row.output,
    modelId: row.model_id,
    tokens: row.tokens,
    createdAt: row.created_at,
  }))
}

function getChannelFromTask(task: string): ViralChannel {
  if (task.includes('ig') || task.includes('instagram')) return 'instagram'
  if (task.includes('youtube')) return 'youtube'
  return 'blog'
}

/**
 * Generate blog draft from outline
 */
export async function generateBlogDraft(
  opportunityId: string,
  outlineGenerationId: string,
  userId?: string,
  clientId?: string
): Promise<GeneratedContent> {
  const supabase = await createClient()

  // Get the outline generation
  const { data: outlineGen } = await supabase
    .from('viral_generations')
    .select('output')
    .eq('id', outlineGenerationId)
    .single()

  if (!outlineGen) {
    throw new Error('Outline generation not found')
  }

  // Get opportunity
  const data = await getOpportunityWithSignals(opportunityId)
  if (!data) {
    throw new Error('Opportunity not found')
  }

  const { opportunity } = data
  const outline = outlineGen.output as Record<string, unknown>

  const input = {
    outline: JSON.stringify(outline.outline),
    title: Array.isArray(outline.titles) ? outline.titles[0] : 'Untitled',
    primary_keyword: outline.primary_keyword || '',
    secondary_keywords: Array.isArray(outline.secondary_keywords)
      ? outline.secondary_keywords.join(', ')
      : '',
    target_audience: 'Algemeen publiek',
    industry: opportunity.industry,
    word_count: outline.estimated_word_count || 1500,
  }

  const result = await aiGateway.generateText<string>({
    task: 'viral_blog_draft',
    clientId: clientId || opportunity.clientId,
    input,
    options: {
      userId,
    },
  })

  if (!result.success) {
    throw new Error(result.error || 'Draft generation failed')
  }

  // Store the draft
  const { data: stored, error } = await supabase
    .from('viral_generations')
    .insert({
      opportunity_id: opportunityId,
      task: 'viral_blog_draft',
      output: { content: result.data },
      model_id: result.usage.modelId,
      tokens: {
        input: result.usage.inputTokens,
        output: result.usage.outputTokens,
        total: result.usage.totalTokens,
      },
      created_by: userId,
    })
    .select('id, created_at')
    .single()

  if (error) throw error

  return {
    id: stored.id,
    opportunityId,
    channel: 'blog',
    task: 'viral_blog_draft',
    output: { content: result.data },
    modelId: result.usage.modelId,
    tokens: {
      input: result.usage.inputTokens,
      output: result.usage.outputTokens,
      total: result.usage.totalTokens,
    },
    createdAt: stored.created_at,
  }
}
