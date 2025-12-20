/**
 * Canonical Content Brief Service
 *
 * Handles the generation, approval, and management of Canonical Content Briefs.
 * The brief is the central concept that sits between signals/ideas and content generation.
 */

import { createClient } from '@/lib/supabase/server'
import { aiGateway } from '@/lib/ai/gateway'
import type { AITask } from '@/lib/ai/types'
import {
  CanonicalBriefSchema,
  type CanonicalBrief,
  type BriefStatus,
  type Evidence,
  type EvidenceItem,
  type SourceDateRange,
  type Channel,
  type GenerateBriefRequest,
} from './schemas'

// ============================================
// Types
// ============================================

export interface BriefRecord {
  id: string
  clientId: string | null
  ideaId: string | null
  brief: CanonicalBrief
  evidence: Evidence
  sourceDateRange: SourceDateRange | null
  status: BriefStatus
  approvedBy: string | null
  approvedAt: string | null
  rejectionReason: string | null
  supersededBy: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface BriefWithContext extends BriefRecord {
  ideaTopic?: string
  ideaAngle?: string
  ideaScore?: number
  generationCount?: number
}

export interface GenerateBriefResult {
  success: boolean
  brief?: BriefRecord
  error?: string
}

export interface GenerateContentResult {
  success: boolean
  generationId?: string
  channel?: Channel
  output?: Record<string, unknown>
  error?: string
  tokens?: {
    input: number
    output: number
    total: number
  }
}

// ============================================
// Brief Generation
// ============================================

/**
 * Generate a Canonical Content Brief from signals/ideas
 */
export async function generateBrief(
  request: GenerateBriefRequest,
  userId: string
): Promise<GenerateBriefResult> {
  const supabase = await createClient()

  try {
    // 1. Get signal data (either from ideaId or signalIds)
    let signals: SignalData[] = []
    let ideaId: string | undefined

    if (request.ideaId) {
      // Get signals from the idea
      const { data: idea } = await supabase
        .from('viral_opportunities')
        .select('*')
        .eq('id', request.ideaId)
        .single()

      if (!idea) {
        return { success: false, error: 'Idea not found' }
      }

      ideaId = idea.id

      // Get linked signals
      const { data: signalData } = await supabase
        .from('viral_signals')
        .select('*')
        .in('id', idea.source_signal_ids || [])

      signals = (signalData || []).map(mapSignal)
    } else if (request.signalIds && request.signalIds.length > 0) {
      // Get signals directly
      const { data: signalData } = await supabase
        .from('viral_signals')
        .select('*')
        .in('id', request.signalIds)

      signals = (signalData || []).map(mapSignal)
    } else {
      return { success: false, error: 'Either ideaId or signalIds is required' }
    }

    if (signals.length === 0) {
      return { success: false, error: 'No signals found' }
    }

    // 2. Get client context if provided
    let clientContext = ''
    if (request.clientId) {
      const { data: client } = await supabase
        .from('clients')
        .select('name, settings')
        .eq('id', request.clientId)
        .single()

      if (client?.settings?.context) {
        const ctx = client.settings.context as Record<string, unknown>
        const parts = [`KLANT CONTEXT (${client.name}):`]
        if (ctx.proposition) parts.push(`Propositie: ${ctx.proposition}`)
        if (ctx.targetAudience) parts.push(`Doelgroep: ${ctx.targetAudience}`)
        if (ctx.usps && Array.isArray(ctx.usps)) parts.push(`USPs: ${(ctx.usps as string[]).join(', ')}`)
        if (ctx.toneOfVoice) parts.push(`Tone of Voice: ${ctx.toneOfVoice}`)
        if (ctx.brandVoice) parts.push(`Brand Voice: ${ctx.brandVoice}`)
        if (ctx.doNots && Array.isArray(ctx.doNots)) {
          parts.push(`\nVERBODEN CLAIMS (gebruik deze NOOIT): ${(ctx.doNots as string[]).join(', ')}`)
        }
        clientContext = parts.join('\n')
      }
    }

    // 3. Build source context from signals
    const sourceContext = buildSourceContext(signals)

    // 4. Calculate date range
    const dates = signals
      .filter(s => s.createdAtExternal)
      .map(s => new Date(s.createdAtExternal!))

    const sourceDateRange: SourceDateRange | null = dates.length > 0
      ? {
          from: new Date(Math.min(...dates.map(d => d.getTime()))).toISOString(),
          to: new Date(Math.max(...dates.map(d => d.getTime()))).toISOString(),
        }
      : null

    // 5. Call AI to generate the brief
    const result = await aiGateway.generateText<CanonicalBrief>({
      task: 'canonical_brief' as AITask,
      clientId: request.clientId,
      input: {
        industry: request.industry,
        source_context: sourceContext,
        client_context: clientContext,
        instruction: request.instruction || '',
      },
      options: {
        userId,
      },
    })

    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'AI generation failed' }
    }

    // 6. Validate the brief against schema
    const parseResult = CanonicalBriefSchema.safeParse(result.data)
    if (!parseResult.success) {
      // Try to fix with a retry
      const retryResult = await retryWithValidation(result.data, userId)
      if (!retryResult.success) {
        return {
          success: false,
          error: `Invalid brief format: ${retryResult.error}`,
        }
      }
      result.data = retryResult.data!
    } else {
      result.data = parseResult.data
    }

    // 7. Build evidence list
    const evidence: Evidence = signals.map(s => ({
      signal_id: s.id,
      url: s.url,
      title: s.title,
      excerpt: s.rawExcerpt?.substring(0, 200),
      subreddit: s.community,
      upvotes: s.metrics?.upvotes,
      comments: s.metrics?.comments,
    }))

    // 8. Store the brief
    const { data: stored, error: storeError } = await supabase
      .from('canonical_briefs')
      .insert({
        client_id: request.clientId || null,
        idea_id: ideaId || null,
        brief: result.data,
        evidence,
        source_date_range: sourceDateRange,
        status: 'draft',
        created_by: userId,
      })
      .select('*')
      .single()

    if (storeError) {
      console.error('Error storing brief:', storeError)
      return { success: false, error: 'Failed to store brief' }
    }

    return {
      success: true,
      brief: mapBriefRecord(stored),
    }
  } catch (error) {
    console.error('Error generating brief:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Retry brief generation with schema validation prompt
 */
async function retryWithValidation(
  invalidBrief: unknown,
  userId: string
): Promise<{ success: boolean; data?: CanonicalBrief; error?: string }> {
  try {
    const result = await aiGateway.generateText<CanonicalBrief>({
      task: 'canonical_brief' as AITask,
      input: {
        industry: '',
        source_context: '',
        client_context: '',
        instruction: `De vorige output was niet valide. Fix de JSON om aan dit schema te voldoen:
{
  "core_tension": "string (10-500 chars)",
  "our_angle": "string (10-300 chars)",
  "key_claim": "string (10-200 chars)",
  "proof_points": ["string array, 2-6 items"],
  "why_now": "string (10-300 chars)",
  "no_go_claims": ["optional string array"]
}

Ongeldige output:
${JSON.stringify(invalidBrief, null, 2)}

Geef alleen de gecorrigeerde JSON terug.`,
      },
      options: {
        userId,
        temperature: 0.3,
      },
    })

    if (!result.success || !result.data) {
      return { success: false, error: 'Retry failed' }
    }

    const parseResult = CanonicalBriefSchema.safeParse(result.data)
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      }
    }

    return { success: true, data: parseResult.data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Retry failed',
    }
  }
}

// ============================================
// Brief Management
// ============================================

/**
 * Get a brief by ID
 */
export async function getBrief(briefId: string): Promise<BriefWithContext | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('canonical_briefs')
    .select(`
      *,
      viral_opportunities (
        topic,
        angle,
        score
      )
    `)
    .eq('id', briefId)
    .single()

  if (!data) return null

  const mapped = mapBriefRecord(data)
  return {
    ...mapped,
    ideaTopic: data.viral_opportunities?.topic,
    ideaAngle: data.viral_opportunities?.angle,
    ideaScore: data.viral_opportunities?.score,
  }
}

/**
 * Get briefs with filters
 */
export async function getBriefs(filters: {
  clientId?: string
  status?: BriefStatus
  ideaId?: string
  limit?: number
}): Promise<BriefWithContext[]> {
  const supabase = await createClient()

  let query = supabase
    .from('canonical_briefs')
    .select(`
      *,
      viral_opportunities (
        topic,
        angle,
        score
      )
    `)
    .order('created_at', { ascending: false })

  if (filters.clientId) query = query.eq('client_id', filters.clientId)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.ideaId) query = query.eq('idea_id', filters.ideaId)
  if (filters.limit) query = query.limit(filters.limit)

  const { data } = await query

  return (data || []).map(row => ({
    ...mapBriefRecord(row),
    ideaTopic: row.viral_opportunities?.topic,
    ideaAngle: row.viral_opportunities?.angle,
    ideaScore: row.viral_opportunities?.score,
  }))
}

/**
 * Approve a brief
 */
export async function approveBrief(
  briefId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('canonical_briefs')
    .update({
      status: 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', briefId)
    .eq('status', 'draft')

  if (error) {
    console.error('Error approving brief:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Reject a brief
 */
export async function rejectBrief(
  briefId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('canonical_briefs')
    .update({
      status: 'rejected',
      rejection_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', briefId)
    .eq('status', 'draft')

  if (error) {
    console.error('Error rejecting brief:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Regenerate a brief with a new angle (supersedes the old one)
 */
export async function regenerateBriefAngle(
  oldBriefId: string,
  instruction: string,
  userId: string
): Promise<GenerateBriefResult> {
  const supabase = await createClient()

  // Get the old brief
  const oldBrief = await getBrief(oldBriefId)
  if (!oldBrief) {
    return { success: false, error: 'Brief not found' }
  }

  // Generate new brief with instruction
  const result = await generateBrief(
    {
      ideaId: oldBrief.ideaId || undefined,
      clientId: oldBrief.clientId || undefined,
      signalIds: oldBrief.evidence.map(e => e.signal_id),
      industry: '', // Will be inferred from signals
      instruction,
    },
    userId
  )

  if (!result.success || !result.brief) {
    return result
  }

  // Mark old brief as superseded
  await supabase
    .from('canonical_briefs')
    .update({
      status: 'superseded',
      superseded_by: result.brief.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', oldBriefId)

  return result
}

// ============================================
// Content Generation from Brief
// ============================================

/**
 * Generate content from an approved brief
 */
export async function generateContentFromBrief(
  briefId: string,
  channel: Channel,
  userId: string,
  options?: {
    targetAudience?: string
    videoLength?: string
    wordCount?: number
  }
): Promise<GenerateContentResult> {
  const supabase = await createClient()

  // 1. Get the brief
  const brief = await getBrief(briefId)
  if (!brief) {
    return { success: false, error: 'Brief not found' }
  }

  // 2. Check if brief is approved
  if (brief.status !== 'approved') {
    return {
      success: false,
      error: 'Brief must be approved before generating content',
    }
  }

  // 3. Get client context for target audience and tone
  let targetAudience = options?.targetAudience || 'Algemeen publiek'
  let industry = ''
  let toneOfVoice = ''
  let brandVoice = ''

  if (brief.clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('settings')
      .eq('id', brief.clientId)
      .single()

    if (client?.settings?.context) {
      const ctx = client.settings.context as Record<string, unknown>
      if (ctx.targetAudience) targetAudience = ctx.targetAudience as string
      if (ctx.industry) industry = ctx.industry as string
      if (ctx.toneOfVoice) toneOfVoice = ctx.toneOfVoice as string
      if (ctx.brandVoice) brandVoice = ctx.brandVoice as string
    }
  }

  // 4. Map channel to task
  const taskMap: Record<Channel, AITask> = {
    youtube: 'youtube_script_from_brief' as AITask,
    blog: 'blog_post_from_brief' as AITask,
    instagram: 'instagram_from_brief' as AITask,
  }

  const task = taskMap[channel]

  // 5. Build input from brief
  const input: Record<string, unknown> = {
    core_tension: brief.brief.core_tension,
    our_angle: brief.brief.our_angle,
    key_claim: brief.brief.key_claim,
    proof_points: brief.brief.proof_points.map((p, i) => `${i + 1}. ${p}`).join('\n'),
    why_now: brief.brief.why_now,
    no_go_claims: brief.brief.no_go_claims?.join(', ') || 'Geen specifieke beperkingen',
    target_audience: targetAudience,
    industry,
    tone_of_voice: toneOfVoice || 'Professioneel maar toegankelijk',
    brand_voice: brandVoice || '',
  }

  // Channel-specific options
  if (channel === 'youtube') {
    input.video_length = options?.videoLength || '8-10 minuten'
  }
  if (channel === 'blog') {
    input.word_count = options?.wordCount || 2000
  }

  // 6. Call AI
  const result = await aiGateway.generateText<Record<string, unknown>>({
    task,
    clientId: brief.clientId || undefined,
    input,
    options: {
      userId,
    },
  })

  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'AI generation failed' }
  }

  // 7. Get current version count
  const { count } = await supabase
    .from('brief_generations')
    .select('*', { count: 'exact', head: true })
    .eq('brief_id', briefId)
    .eq('channel', channel)

  const version = (count || 0) + 1

  // 8. Store the generation
  const { data: stored, error: storeError } = await supabase
    .from('brief_generations')
    .insert({
      brief_id: briefId,
      channel,
      output: result.data,
      model_id: result.usage.modelId,
      tokens: {
        input: result.usage.inputTokens,
        output: result.usage.outputTokens,
        total: result.usage.totalTokens,
      },
      version,
      created_by: userId,
    })
    .select('id')
    .single()

  if (storeError) {
    console.error('Error storing generation:', storeError)
    return { success: false, error: 'Failed to store generation' }
  }

  return {
    success: true,
    generationId: stored.id,
    channel,
    output: result.data,
    tokens: {
      input: result.usage.inputTokens,
      output: result.usage.outputTokens,
      total: result.usage.totalTokens,
    },
  }
}

/**
 * Get generations for a brief
 */
export async function getBriefGenerations(briefId: string): Promise<{
  id: string
  channel: Channel
  output: Record<string, unknown>
  version: number
  createdAt: string
}[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('brief_generations')
    .select('*')
    .eq('brief_id', briefId)
    .order('created_at', { ascending: false })

  return (data || []).map(row => ({
    id: row.id,
    channel: row.channel as Channel,
    output: row.output as Record<string, unknown>,
    version: row.version,
    createdAt: row.created_at,
  }))
}

// ============================================
// Helper Functions
// ============================================

interface SignalData {
  id: string
  title: string
  url: string
  community?: string
  rawExcerpt?: string
  topComments?: { author: string; text: string; score: number }[]
  createdAtExternal?: string
  metrics?: { upvotes?: number; comments?: number }
}

function mapSignal(row: Record<string, unknown>): SignalData {
  return {
    id: row.id as string,
    title: row.title as string,
    url: row.url as string,
    community: row.community as string | undefined,
    rawExcerpt: row.raw_excerpt as string | undefined,
    topComments: row.top_comments as { author: string; text: string; score: number }[] | undefined,
    createdAtExternal: row.created_at_external as string | undefined,
    metrics: row.metrics as { upvotes?: number; comments?: number } | undefined,
  }
}

function mapBriefRecord(row: Record<string, unknown>): BriefRecord {
  return {
    id: row.id as string,
    clientId: row.client_id as string | null,
    ideaId: row.idea_id as string | null,
    brief: row.brief as CanonicalBrief,
    evidence: row.evidence as Evidence,
    sourceDateRange: row.source_date_range as SourceDateRange | null,
    status: row.status as BriefStatus,
    approvedBy: row.approved_by as string | null,
    approvedAt: row.approved_at as string | null,
    rejectionReason: row.rejection_reason as string | null,
    supersededBy: row.superseded_by as string | null,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function buildSourceContext(signals: SignalData[]): string {
  const parts: string[] = []

  for (const signal of signals.slice(0, 10)) {
    const lines: string[] = []
    lines.push(`📌 POST: ${signal.title}`)
    lines.push(`   URL: ${signal.url}`)
    if (signal.community) lines.push(`   Subreddit: r/${signal.community}`)
    if (signal.metrics) {
      lines.push(`   Engagement: ${signal.metrics.upvotes || 0} upvotes, ${signal.metrics.comments || 0} comments`)
    }
    if (signal.rawExcerpt) {
      lines.push(`   Excerpt: ${signal.rawExcerpt.substring(0, 200)}...`)
    }

    if (signal.topComments && signal.topComments.length > 0) {
      lines.push('   Top Comments:')
      for (const comment of signal.topComments.slice(0, 3)) {
        lines.push(`   - "${comment.text.substring(0, 150)}..." (${comment.score} pts)`)
      }
    }

    parts.push(lines.join('\n'))
  }

  return parts.join('\n\n')
}
