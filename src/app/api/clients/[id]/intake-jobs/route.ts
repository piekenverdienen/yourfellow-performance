import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { StartIntakeRequest, StartIntakeResponse, IntakeJobConfig, IntakeJob } from '@/lib/context/types'

/**
 * POST /api/clients/:id/intake-jobs
 *
 * Starts a new intake job for a client.
 * Async job with progress tracking.
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
      return NextResponse.json<StartIntakeResponse>(
        { success: false, jobId: '', message: '', error: 'Niet geauthenticeerd' },
        { status: 401 }
      )
    }

    // Check client access (need editor role)
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'editor',
    })

    if (!hasAccess) {
      return NextResponse.json<StartIntakeResponse>(
        { success: false, jobId: '', message: '', error: 'Geen toegang om intake te starten' },
        { status: 403 }
      )
    }

    // Get client info
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json<StartIntakeResponse>(
        { success: false, jobId: '', message: '', error: 'Klant niet gevonden' },
        { status: 404 }
      )
    }

    // Parse request body
    let body: StartIntakeRequest = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is OK
    }

    // Check if there's already a running job
    const { data: existingJob } = await supabase
      .from('intake_jobs')
      .select('id, status')
      .eq('client_id', clientId)
      .in('status', ['pending', 'scraping', 'analyzing', 'generating'])
      .single()

    if (existingJob) {
      return NextResponse.json<StartIntakeResponse>(
        {
          success: false,
          jobId: existingJob.id,
          message: 'Er loopt al een intake job',
          error: 'Er loopt al een intake proces',
        },
        { status: 409 }
      )
    }

    // Build job config with defaults
    const config: IntakeJobConfig = {
      website_url: body.config?.website_url,
      competitor_urls: body.config?.competitor_urls || [],
      social_urls: body.config?.social_urls,
      max_pages: body.config?.max_pages ?? 5,
      max_competitor_pages: body.config?.max_competitor_pages ?? 3,
      skip_scraping: body.config?.skip_scraping ?? false,
    }

    // Create intake job
    const { data: job, error: jobError } = await supabase
      .from('intake_jobs')
      .insert({
        client_id: clientId,
        job_type: body.jobType ?? 'full_intake',
        status: 'pending',
        progress: 0,
        config,
        started_by: user.id,
        steps_completed: [],
        current_step: 'waiting',
      })
      .select('id')
      .single()

    if (jobError) {
      console.error('Error creating intake job:', jobError)
      return NextResponse.json<StartIntakeResponse>(
        { success: false, jobId: '', message: '', error: jobError.message },
        { status: 500 }
      )
    }

    return NextResponse.json<StartIntakeResponse>({
      success: true,
      jobId: job.id,
      message: 'Intake job gestart. Gebruik GET /api/intake-jobs/:jobId voor voortgang.',
    })
  } catch (error) {
    console.error('Start intake error:', error)
    return NextResponse.json<StartIntakeResponse>(
      { success: false, jobId: '', message: '', error: 'Fout bij starten van intake' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/clients/:id/intake-jobs
 *
 * Lists all intake jobs for a client.
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
      return NextResponse.json({ success: false, jobs: [], error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Check client access
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'viewer',
    })

    if (!hasAccess) {
      return NextResponse.json({ success: false, jobs: [], error: 'Geen toegang' }, { status: 403 })
    }

    // Get jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('intake_jobs')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (jobsError) {
      console.error('Error fetching intake jobs:', jobsError)
      return NextResponse.json({ success: false, jobs: [], error: jobsError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      jobs: jobs as IntakeJob[],
    })
  } catch (error) {
    console.error('List intake jobs error:', error)
    return NextResponse.json({ success: false, jobs: [], error: 'Fout bij ophalen van jobs' }, { status: 500 })
  }
}
