import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { GenerateContextRequest, GenerateContextResponse, IntakeJobConfig } from '@/lib/context/types'

/**
 * POST /api/clients/:id/context/generate
 *
 * Starts a new context generation job.
 * This creates a new version but does NOT automatically make it active.
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
      return NextResponse.json<GenerateContextResponse>(
        { success: false, jobId: '', message: '', error: 'Niet geauthenticeerd' },
        { status: 401 }
      )
    }

    // Check client access (need editor role to generate)
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'editor',
    })

    if (!hasAccess) {
      return NextResponse.json<GenerateContextResponse>(
        { success: false, jobId: '', message: '', error: 'Geen toegang om context te genereren' },
        { status: 403 }
      )
    }

    // Get client info
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, settings')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json<GenerateContextResponse>(
        { success: false, jobId: '', message: '', error: 'Klant niet gevonden' },
        { status: 404 }
      )
    }

    // Parse request body
    let body: GenerateContextRequest = {}
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
      return NextResponse.json<GenerateContextResponse>(
        {
          success: false,
          jobId: existingJob.id,
          message: 'Er loopt al een intake job',
          error: 'Er loopt al een context generatie proces',
        },
        { status: 409 }
      )
    }

    // Determine job type based on request
    const jobType = body.skipScraping ? 'enrich_only' : 'full_intake'

    // Build job config
    const config: IntakeJobConfig = {
      website_url: body.websiteUrl,
      competitor_urls: body.competitorUrls,
      max_pages: 5,
      max_competitor_pages: 3,
      skip_scraping: body.skipScraping ?? false,
    }

    // Create intake job
    const { data: job, error: jobError } = await supabase
      .from('intake_jobs')
      .insert({
        client_id: clientId,
        job_type: jobType,
        status: 'pending',
        progress: 0,
        config,
        started_by: user.id,
        steps_completed: [],
        current_step: 'initializing',
      })
      .select('id')
      .single()

    if (jobError) {
      console.error('Error creating intake job:', jobError)
      return NextResponse.json<GenerateContextResponse>(
        { success: false, jobId: '', message: '', error: jobError.message },
        { status: 500 }
      )
    }

    // TODO: Trigger async job processing
    // For now, we'll process synchronously in a separate endpoint
    // In production, this would be a background job queue

    return NextResponse.json<GenerateContextResponse>({
      success: true,
      jobId: job.id,
      message: 'Context generatie gestart. Gebruik GET /api/intake-jobs/:jobId om de voortgang te volgen.',
    })
  } catch (error) {
    console.error('Context generate error:', error)
    return NextResponse.json<GenerateContextResponse>(
      { success: false, jobId: '', message: '', error: 'Fout bij starten van context generatie' },
      { status: 500 }
    )
  }
}
