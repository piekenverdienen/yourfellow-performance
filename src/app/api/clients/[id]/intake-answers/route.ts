import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SubmitIntakeAnswersRequest, SubmitIntakeAnswersResponse, IntakeAnswer } from '@/lib/context/types'

/**
 * POST /api/clients/:id/intake-answers
 *
 * Submit intake answers for a client.
 * These are stored as separate sources and never directly overwrite context.
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
      return NextResponse.json<SubmitIntakeAnswersResponse>(
        { success: false, count: 0, error: 'Niet geauthenticeerd' },
        { status: 401 }
      )
    }

    // Check client access (need editor role)
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'editor',
    })

    if (!hasAccess) {
      return NextResponse.json<SubmitIntakeAnswersResponse>(
        { success: false, count: 0, error: 'Geen toegang om intake te bewerken' },
        { status: 403 }
      )
    }

    // Get client to verify it exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json<SubmitIntakeAnswersResponse>(
        { success: false, count: 0, error: 'Klant niet gevonden' },
        { status: 404 }
      )
    }

    // Parse request body
    let body: SubmitIntakeAnswersRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<SubmitIntakeAnswersResponse>(
        { success: false, count: 0, error: 'Ongeldige request body' },
        { status: 400 }
      )
    }

    if (!body.answers || !Array.isArray(body.answers) || body.answers.length === 0) {
      return NextResponse.json<SubmitIntakeAnswersResponse>(
        { success: false, count: 0, error: 'Geen antwoorden opgegeven' },
        { status: 400 }
      )
    }

    // For each answer, mark any existing active answers for the same question as superseded
    const insertedAnswers: string[] = []

    for (const answer of body.answers) {
      if (!answer.questionKey) {
        continue
      }

      // Find existing active answer for this question
      const { data: existingAnswer } = await supabase
        .from('intake_answers')
        .select('id')
        .eq('client_id', clientId)
        .eq('question_key', answer.questionKey)
        .eq('is_active', true)
        .single()

      // Insert new answer
      const { data: newAnswer, error: insertError } = await supabase
        .from('intake_answers')
        .insert({
          client_id: clientId,
          question_key: answer.questionKey,
          question_text: answer.questionText || null,
          answer_text: answer.answerText || null,
          answer_json: answer.answerJson || null,
          source_type: 'user_input',
          answered_by: user.id,
          answered_at: new Date().toISOString(),
          is_active: true,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('Error inserting answer:', insertError)
        continue
      }

      // Mark existing answer as superseded
      if (existingAnswer && newAnswer) {
        await supabase
          .from('intake_answers')
          .update({
            is_active: false,
            superseded_by: newAnswer.id,
          })
          .eq('id', existingAnswer.id)
      }

      if (newAnswer) {
        insertedAnswers.push(newAnswer.id)
      }
    }

    // Update client context status to indicate enrichment needed
    const { error: contextError } = await supabase
      .from('client_context')
      .update({
        status: 'needs_enrichment',
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', clientId)

    if (contextError && contextError.code !== 'PGRST116') {
      console.error('Error updating client context status:', contextError)
    }

    return NextResponse.json<SubmitIntakeAnswersResponse>({
      success: true,
      count: insertedAnswers.length,
    })
  } catch (error) {
    console.error('Submit intake answers error:', error)
    return NextResponse.json<SubmitIntakeAnswersResponse>(
      { success: false, count: 0, error: 'Fout bij opslaan van antwoorden' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/clients/:id/intake-answers
 *
 * Get all active intake answers for a client.
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
      return NextResponse.json({ success: false, answers: [], error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Check client access
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'viewer',
    })

    if (!hasAccess) {
      return NextResponse.json({ success: false, answers: [], error: 'Geen toegang' }, { status: 403 })
    }

    // Get active answers
    const { data: answers, error: answersError } = await supabase
      .from('intake_answers')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('answered_at', { ascending: false })

    if (answersError) {
      console.error('Error fetching answers:', answersError)
      return NextResponse.json({ success: false, answers: [], error: answersError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      answers: answers as IntakeAnswer[],
    })
  } catch (error) {
    console.error('Get intake answers error:', error)
    return NextResponse.json({ success: false, answers: [], error: 'Fout bij ophalen van antwoorden' }, { status: 500 })
  }
}
