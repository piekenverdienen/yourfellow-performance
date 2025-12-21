/**
 * AI Content Evaluator
 *
 * Optional service for evaluating AI-generated content quality.
 * Can be used for:
 * - Quality scoring for gamification
 * - A/B testing template effectiveness
 * - Content improvement suggestions
 */

import { createClient } from '@/lib/supabase/server'
import { aiGateway } from './gateway'
import type { AIEvaluation, EvaluationCriteria } from './types'

export interface EvaluationRequest {
  usageLogId: string
  originalRequest: string
  generatedContent: string
  clientContext?: string
}

export interface EvaluationResult {
  score: number
  criteria: EvaluationCriteria[]
  feedback: string
}

/**
 * Evaluate AI-generated content using a second AI call
 */
export async function evaluateContent(request: EvaluationRequest): Promise<EvaluationResult | null> {
  try {
    const result = await aiGateway.generateText<EvaluationResult>({
      task: 'content_evaluation',
      input: {
        original_request: request.originalRequest,
        generated_content: request.generatedContent,
        client_context: request.clientContext || 'Geen specifieke klant context',
      },
      options: {
        skipLogging: true, // Don't log evaluation calls separately
      },
    })

    if (!result.success || !result.data) {
      console.error('Evaluation failed:', result.error)
      return null
    }

    // Save evaluation to database
    await saveEvaluation({
      usageLogId: request.usageLogId,
      score: result.data.score,
      criteria: result.data.criteria,
      feedback: result.data.feedback,
      evaluatorModel: result.usage.modelId,
    })

    return result.data
  } catch (error) {
    console.error('Error evaluating content:', error)
    return null
  }
}

/**
 * Save evaluation to database
 */
async function saveEvaluation(evaluation: {
  usageLogId: string
  score: number
  criteria: EvaluationCriteria[]
  feedback: string
  evaluatorModel: string
}): Promise<void> {
  try {
    const supabase = await createClient()

    await supabase.from('ai_evaluations').insert({
      usage_log_id: evaluation.usageLogId,
      score: evaluation.score,
      criteria: evaluation.criteria,
      feedback: evaluation.feedback,
      evaluated_by: 'ai',
      evaluator_model: evaluation.evaluatorModel,
    })
  } catch (error) {
    console.error('Error saving evaluation:', error)
  }
}

/**
 * Get average evaluation score for a template
 */
export async function getTemplateAverageScore(templateId: string): Promise<number | null> {
  try {
    const supabase = await createClient()

    const { data } = await supabase
      .from('ai_evaluations')
      .select('score, ai_usage_logs!inner(template_id)')
      .eq('ai_usage_logs.template_id', templateId)

    if (!data || data.length === 0) return null
    interface EvalRow { score: number; ai_usage_logs: unknown }
    const total = (data as EvalRow[]).reduce((sum: number, row: EvalRow) => sum + row.score, 0)
    return Math.round(total / data.length)
  } catch (error) {
    console.error('Error getting template score:', error)
    return null
  }
}

/**
 * Get user's content quality stats for gamification
 */
export async function getUserQualityStats(userId: string): Promise<{
  averageScore: number
  totalEvaluated: number
  highQualityCount: number // Score >= 80
} | null> {
  try {
    const supabase = await createClient()

    const { data } = await supabase
      .from('ai_evaluations')
      .select('score, ai_usage_logs!inner(user_id)')
      .eq('ai_usage_logs.user_id', userId)

    if (!data || data.length === 0) {
      return { averageScore: 0, totalEvaluated: 0, highQualityCount: 0 }
    }
    interface ScoreRow { score: number; ai_usage_logs: unknown }
    const typedData = data as ScoreRow[]
    const total = typedData.reduce((sum: number, row: ScoreRow) => sum + row.score, 0)
    const highQuality = typedData.filter((row: ScoreRow) => row.score >= 80).length

    return {
      averageScore: Math.round(total / data.length),
      totalEvaluated: data.length,
      highQualityCount: highQuality,
    }
  } catch (error) {
    console.error('Error getting user quality stats:', error)
    return null
  }
}
