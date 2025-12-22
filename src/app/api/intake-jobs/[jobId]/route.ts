import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { GetIntakeJobResponse, IntakeJob } from '@/lib/context/types'

/**
 * GET /api/intake-jobs/:jobId
 *
 * Returns the status and progress of an intake job.
 * Use this for polling progress updates.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json<GetIntakeJobResponse>(
        { success: false, job: null, error: 'Niet geauthenticeerd' },
        { status: 401 }
      )
    }

    // Get job
    const { data: job, error: jobError } = await supabase
      .from('intake_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json<GetIntakeJobResponse>(
        { success: false, job: null, error: 'Job niet gevonden' },
        { status: 404 }
      )
    }

    // Check client access
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: job.client_id,
      min_role: 'viewer',
    })

    if (!hasAccess) {
      return NextResponse.json<GetIntakeJobResponse>(
        { success: false, job: null, error: 'Geen toegang tot deze job' },
        { status: 403 }
      )
    }

    return NextResponse.json<GetIntakeJobResponse>({
      success: true,
      job: job as IntakeJob,
    })
  } catch (error) {
    console.error('Get intake job error:', error)
    return NextResponse.json<GetIntakeJobResponse>(
      { success: false, job: null, error: 'Fout bij ophalen van job' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/intake-jobs/:jobId
 *
 * Cancels a running intake job.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Get job
    const { data: job, error: jobError } = await supabase
      .from('intake_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ success: false, error: 'Job niet gevonden' }, { status: 404 })
    }

    // Check client access (need editor role to cancel)
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: job.client_id,
      min_role: 'editor',
    })

    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Geen toegang om job te annuleren' }, { status: 403 })
    }

    // Can only cancel jobs that are still running
    if (!['pending', 'scraping', 'analyzing', 'generating'].includes(job.status)) {
      return NextResponse.json(
        { success: false, error: 'Job kan niet meer geannuleerd worden' },
        { status: 400 }
      )
    }

    // Update job status
    const { error: updateError } = await supabase
      .from('intake_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    if (updateError) {
      console.error('Error cancelling job:', updateError)
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Job geannuleerd',
    })
  } catch (error) {
    console.error('Cancel intake job error:', error)
    return NextResponse.json({ success: false, error: 'Fout bij annuleren van job' }, { status: 500 })
  }
}
