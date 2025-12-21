import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrichContext } from '@/services/context-generator'
import type { IntakeAnswer } from '@/lib/context/types'

interface EnrichContextRequest {
  skipRegeneration?: boolean // Just save answers without regenerating
}

interface EnrichContextResponse {
  success: boolean
  version?: number
  message?: string
  error?: string
  missingFields?: string[]
  lowConfidenceFields?: string[]
  suggestedNextInputs?: { field: string; question: string; priority: string }[]
}

/**
 * POST /api/clients/:id/context/enrich
 *
 * Enriches context for an existing client without new scraping.
 * Uses existing scraped data + new/updated intake answers.
 *
 * Two flows:
 * 1. Verrijken zonder scraping - regenerate from existing sources + answers
 * 2. Her-analyseren - start new intake job (use intake-jobs endpoint instead)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json<EnrichContextResponse>(
        { success: false, error: 'Niet geauthenticeerd' },
        { status: 401 }
      )
    }

    // Check client access (need editor role)
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'editor',
    })

    if (!hasAccess) {
      return NextResponse.json<EnrichContextResponse>(
        { success: false, error: 'Geen toegang om context te verrijken' },
        { status: 403 }
      )
    }

    // Parse request body
    let body: EnrichContextRequest = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is OK
    }

    // Get current context status
    const { data: contextData, error: contextError } = await supabase
      .from('client_context')
      .select('*')
      .eq('client_id', clientId)
      .single()

    if (contextError && contextError.code !== 'PGRST116') {
      console.error('Error fetching context:', contextError)
      return NextResponse.json<EnrichContextResponse>(
        { success: false, error: 'Fout bij ophalen van context' },
        { status: 500 }
      )
    }

    // If no context exists, tell user to run full intake first
    if (!contextData || !contextData.current_context_json) {
      return NextResponse.json<EnrichContextResponse>(
        {
          success: false,
          error: 'Geen bestaande context gevonden. Start eerst een volledige intake.',
        },
        { status: 400 }
      )
    }

    // Get all active intake answers
    const { data: answers, error: answersError } = await supabase
      .from('intake_answers')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)

    if (answersError) {
      console.error('Error fetching answers:', answersError)
    }

    // If skipRegeneration, just return current gaps info
    if (body.skipRegeneration) {
      return NextResponse.json<EnrichContextResponse>({
        success: true,
        version: contextData.active_version,
        message: 'Huidige context status opgehaald',
        missingFields: contextData.missing_fields || [],
        lowConfidenceFields: contextData.low_confidence_fields || [],
        suggestedNextInputs: contextData.suggested_next_inputs || [],
      })
    }

    // Regenerate context with enrichment
    const result = await enrichContext(
      clientId,
      (answers as IntakeAnswer[]) || [],
      user.id
    )

    if (!result.success) {
      return NextResponse.json<EnrichContextResponse>(
        { success: false, error: result.error || 'Context verrijking gefaald' },
        { status: 500 }
      )
    }

    // Update client context status
    const { error: updateError } = await supabase
      .from('client_context')
      .update({
        status: 'active',
        missing_fields: result.context?.confidence.missingFields || [],
        low_confidence_fields: result.context?.confidence.lowConfidenceFields || [],
        suggested_next_inputs: result.context?.gaps?.questionsToAsk?.map((q) => ({
          field: q.fieldPath,
          question: q.questionText,
          priority: q.priority,
        })) || [],
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', clientId)

    if (updateError) {
      console.error('Error updating context status:', updateError)
    }

    return NextResponse.json<EnrichContextResponse>({
      success: true,
      version: result.version,
      message: 'Context succesvol verrijkt',
      missingFields: result.context?.confidence.missingFields || [],
      lowConfidenceFields: result.context?.confidence.lowConfidenceFields || [],
      suggestedNextInputs: result.context?.gaps?.questionsToAsk?.map((q) => ({
        field: q.fieldPath,
        question: q.questionText,
        priority: q.priority,
      })) || [],
    })
  } catch (error) {
    console.error('Enrich context error:', error)
    return NextResponse.json<EnrichContextResponse>(
      { success: false, error: 'Fout bij verrijken van context' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/clients/:id/context/enrich
 *
 * Returns enrichment suggestions for a client.
 * Shows missing fields, low confidence fields, and suggested questions.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Check client access
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'viewer',
    })

    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Geen toegang' }, { status: 403 })
    }

    // Get context data
    const { data: contextData, error: contextError } = await supabase
      .from('client_context')
      .select('*')
      .eq('client_id', clientId)
      .single()

    if (contextError && contextError.code !== 'PGRST116') {
      console.error('Error fetching context:', contextError)
      return NextResponse.json({ success: false, error: contextError.message }, { status: 500 })
    }

    if (!contextData) {
      return NextResponse.json({
        success: true,
        status: 'pending',
        missingFields: ['all'],
        lowConfidenceFields: [],
        suggestedNextInputs: [
          {
            field: 'initial',
            question: 'Start de intake om klantcontext te genereren',
            priority: 'high',
          },
        ],
        needsIntake: true,
      })
    }

    // Get current context for more detailed analysis
    const { data: versionData } = await supabase
      .from('ai_context_versions')
      .select('context_json')
      .eq('client_id', clientId)
      .eq('version', contextData.active_version)
      .single()

    const context = versionData?.context_json
    const gaps = context?.gaps || {}
    const confidence = context?.confidence || {}

    return NextResponse.json({
      success: true,
      status: contextData.status,
      version: contextData.active_version,
      overallConfidence: confidence.overall,
      missingFields: contextData.missing_fields || confidence.missingFields || [],
      lowConfidenceFields: contextData.low_confidence_fields || confidence.lowConfidenceFields || [],
      suggestedNextInputs: contextData.suggested_next_inputs || [],
      criticalGaps: gaps.critical || [],
      questionsToAsk: gaps.questionsToAsk || [],
      needsEnrichment: contextData.status === 'needs_enrichment',
    })
  } catch (error) {
    console.error('Get enrichment info error:', error)
    return NextResponse.json({ success: false, error: 'Fout bij ophalen van verrijking info' }, { status: 500 })
  }
}
