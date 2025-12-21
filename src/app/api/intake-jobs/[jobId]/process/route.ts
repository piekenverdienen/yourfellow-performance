import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runScrapingPipeline } from '@/services/intake-scraper'
import { generateContextFromSources } from '@/services/context-generator'
import type { IntakeJobStep, IntakeJob } from '@/lib/context/types'

/**
 * POST /api/intake-jobs/:jobId/process
 *
 * Processes an intake job (runs scraping + context generation).
 * This endpoint handles the async processing of intake jobs.
 *
 * In production, this would be called by a background job queue.
 * For now, it can be called directly after creating a job.
 */
export async function POST(
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

    // Check client access
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: job.client_id,
      min_role: 'editor',
    })

    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Geen toegang' }, { status: 403 })
    }

    // Can only process pending jobs
    if (job.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Job is al ${job.status}` },
        { status: 400 }
      )
    }

    const intakeJob = job as IntakeJob
    const steps: IntakeJobStep[] = []

    // Helper to update job status
    const updateJob = async (updates: Partial<IntakeJob>) => {
      await supabase
        .from('intake_jobs')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
    }

    // ================================
    // STEP 1: SCRAPING
    // ================================
    if (!intakeJob.config.skip_scraping) {
      steps.push({
        name: 'scraping',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      })

      await updateJob({
        status: 'scraping',
        progress: 10,
        current_step: 'scraping',
        steps_completed: steps,
        started_at: new Date().toISOString(),
      })

      // Run scraping pipeline
      const scrapingResult = await runScrapingPipeline(intakeJob.config)

      if (!scrapingResult.success) {
        steps[steps.length - 1].status = 'failed'
        steps[steps.length - 1].error = scrapingResult.errors.join('; ')
        steps[steps.length - 1].completedAt = new Date().toISOString()

        await updateJob({
          status: 'failed',
          progress: 10,
          steps_completed: steps,
          error_message: 'Scraping failed: ' + scrapingResult.errors.join('; '),
          error_details: { errors: scrapingResult.errors },
          completed_at: new Date().toISOString(),
        })

        return NextResponse.json({
          success: false,
          error: 'Scraping gefaald',
          details: scrapingResult.errors,
        })
      }

      // Save scraped sources to database
      const sourcesToInsert = scrapingResult.sources.map((source) => ({
        ...source,
        client_id: intakeJob.client_id,
        intake_job_id: jobId,
      }))

      if (sourcesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('scraped_sources')
          .insert(sourcesToInsert)

        if (insertError) {
          console.error('Error saving scraped sources:', insertError)
          // Continue anyway - we have the data in memory
        }
      }

      steps[steps.length - 1].status = 'completed'
      steps[steps.length - 1].completedAt = new Date().toISOString()
      steps[steps.length - 1].result = {
        sourcesScraped: scrapingResult.sources.length,
        warnings: scrapingResult.errors,
      }

      await updateJob({
        progress: 40,
        steps_completed: steps,
      })
    } else {
      steps.push({
        name: 'scraping',
        status: 'skipped',
      })
    }

    // ================================
    // STEP 2: ANALYZING
    // ================================
    steps.push({
      name: 'analyzing',
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    })

    await updateJob({
      status: 'analyzing',
      progress: 50,
      current_step: 'analyzing',
      steps_completed: steps,
    })

    // Get scraped sources for this job
    const { data: scrapedSources, error: sourcesError } = await supabase
      .from('scraped_sources')
      .select('*')
      .eq('intake_job_id', jobId)
      .eq('extraction_success', true)

    if (sourcesError) {
      console.error('Error fetching scraped sources:', sourcesError)
    }

    // Get intake answers for this client
    const { data: intakeAnswers, error: answersError } = await supabase
      .from('intake_answers')
      .select('*')
      .eq('client_id', intakeJob.client_id)
      .eq('is_active', true)

    if (answersError) {
      console.error('Error fetching intake answers:', answersError)
    }

    // Get existing context for merge
    const { data: existingContext } = await supabase
      .from('client_context')
      .select('current_context_json')
      .eq('client_id', intakeJob.client_id)
      .single()

    steps[steps.length - 1].status = 'completed'
    steps[steps.length - 1].completedAt = new Date().toISOString()
    steps[steps.length - 1].result = {
      sourcesFound: scrapedSources?.length ?? 0,
      answersFound: intakeAnswers?.length ?? 0,
      hasExistingContext: !!existingContext?.current_context_json,
    }

    // ================================
    // STEP 3: GENERATING
    // ================================
    steps.push({
      name: 'generating',
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    })

    await updateJob({
      status: 'generating',
      progress: 70,
      current_step: 'generating',
      steps_completed: steps,
    })

    // Get client info for context
    const { data: client } = await supabase
      .from('clients')
      .select('name')
      .eq('id', intakeJob.client_id)
      .single()

    // Generate context using LLM
    const generationResult = await generateContextFromSources({
      clientId: intakeJob.client_id,
      clientName: client?.name || 'Unknown',
      scrapedSources: scrapedSources || [],
      intakeAnswers: intakeAnswers || [],
      existingContext: existingContext?.current_context_json || null,
      userId: user.id,
      jobId,
    })

    if (!generationResult.success) {
      steps[steps.length - 1].status = 'failed'
      steps[steps.length - 1].error = generationResult.error
      steps[steps.length - 1].completedAt = new Date().toISOString()

      await updateJob({
        status: 'failed',
        progress: 70,
        steps_completed: steps,
        error_message: generationResult.error || 'Context generation failed',
        completed_at: new Date().toISOString(),
      })

      return NextResponse.json({
        success: false,
        error: 'Context generatie gefaald',
        details: generationResult.error,
      })
    }

    steps[steps.length - 1].status = 'completed'
    steps[steps.length - 1].completedAt = new Date().toISOString()
    steps[steps.length - 1].result = {
      version: generationResult.version,
      confidence: generationResult.context?.confidence.overall,
    }

    // ================================
    // COMPLETE
    // ================================
    await updateJob({
      status: 'completed',
      progress: 100,
      current_step: null,
      steps_completed: steps,
      result_version: generationResult.version,
      completed_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: 'Intake job voltooid',
      version: generationResult.version,
      steps,
    })
  } catch (error) {
    console.error('Process intake job error:', error)
    return NextResponse.json(
      { success: false, error: 'Fout bij verwerken van intake job' },
      { status: 500 }
    )
  }
}
