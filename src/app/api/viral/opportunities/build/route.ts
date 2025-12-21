/**
 * POST /api/viral/opportunities/build
 *
 * Build opportunities from ingested signals.
 * Clusters signals, scores them, and stores opportunities.
 *
 * V2: Includes SEO intelligence for demand-aware prioritization.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildOpportunities, type ViralChannel } from '@/viral/opportunities'
import { cache } from '@/lib/cache'
import { rateLimiter, RATE_LIMITS, getClientIdentifier, createRateLimitResponse } from '@/lib/rate-limit'
import { auditLog, getRequestMetadata } from '@/lib/audit-log'
import { z } from 'zod'

// ============================================
// Request Validation
// ============================================

const BuildRequestSchema = z.object({
  industry: z.string().min(1, 'Industry is required'),
  clientId: z.string().uuid().optional(),
  channels: z.array(z.enum(['youtube', 'instagram', 'blog'])).min(1, 'At least one channel required'),
  limit: z.number().min(1).max(50).optional(),
  days: z.number().min(1).max(30).optional(),
  useAI: z.boolean().optional(),
  // V2: SEO options
  seoOptions: z.object({
    enabled: z.boolean().optional(),
    siteUrl: z.string().url().optional(),
    enforceGates: z.boolean().optional(),
    existingClusters: z.array(z.string()).optional(),
    competitors: z.array(z.string()).optional(),
  }).optional(),
})

// ============================================
// Route Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // 2. Rate limiting (heavy operation - max 5 per minute)
    const rateLimitId = getClientIdentifier(request, user.id)
    const rateCheck = rateLimiter.check(
      `build:${rateLimitId}`,
      RATE_LIMITS.HEAVY.maxRequests,
      RATE_LIMITS.HEAVY.windowMs
    )

    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.resetIn)
    }

    // 3. Check internal access
    const isInternalOnly = process.env.VIRAL_HUB_INTERNAL_ONLY !== 'false'
    if (isInternalOnly) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || !['admin', 'marketer'].includes(profile.role)) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // 3. Parse and validate request
    const body = await request.json()
    const validation = BuildRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { industry, clientId, channels, limit, days, useAI, seoOptions } = validation.data

    // 4. Validate client access if clientId provided
    let clientSiteUrl: string | undefined
    let clientClusters: string[] | undefined
    let clientCompetitors: string[] | undefined

    if (clientId) {
      const { data: hasAccess } = await supabase
        .rpc('has_client_access', { check_client_id: clientId, min_role: 'editor' })

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'No access to specified client' },
          { status: 403 }
        )
      }

      // Get client settings for SEO context
      const { data: client } = await supabase
        .from('clients')
        .select('settings')
        .eq('id', clientId)
        .single()

      if (client?.settings) {
        const settings = client.settings as Record<string, unknown>
        clientSiteUrl = settings.siteUrl as string | undefined
        clientClusters = settings.topicalClusters as string[] | undefined
        clientCompetitors = settings.competitors as string[] | undefined
      }
    }

    // 5. Build opportunities with SEO intelligence
    const opportunities = await buildOpportunities({
      industry,
      clientId,
      channels: channels as ViralChannel[],
      limit: limit || 10,
      days: days || 7,
      useAI: useAI ?? false,
      // V2: Enable SEO by default, use client settings or request overrides
      seoOptions: {
        enabled: seoOptions?.enabled ?? true, // Default: enabled
        siteUrl: seoOptions?.siteUrl || clientSiteUrl,
        enforceGates: seoOptions?.enforceGates ?? false, // Default: don't block, just inform
        existingClusters: seoOptions?.existingClusters || clientClusters,
        competitors: seoOptions?.competitors || clientCompetitors,
      },
    })

    // 6. Invalidate opportunities cache after building new ones
    cache.invalidatePattern('^opportunities:')

    // 7. Audit log - track who built opportunities
    const { ipAddress, userAgent } = getRequestMetadata(request)
    await auditLog({
      action: 'client.update',
      userId: user.id,
      userEmail: user.email,
      resourceType: 'opportunities',
      resourceId: clientId,
      details: {
        count: opportunities.length,
        channels,
        industry,
      },
      ipAddress,
      userAgent,
    })

    // 8. Return opportunities with SEO insights summary
    const seoSummary = opportunities.length > 0 ? {
      demandCapture: opportunities.filter(o => o.seoData?.opportunityType === 'demand_capture').length,
      demandCreation: opportunities.filter(o => o.seoData?.opportunityType === 'demand_creation').length,
      withSearchData: opportunities.filter(o => o.seoData?.searchIntelligence.hasData).length,
      gatesBlocked: opportunities.filter(o => o.seoData && !o.seoData.strategicGates.allPassed).length,
    } : null

    return NextResponse.json({
      success: true,
      data: opportunities,
      count: opportunities.length,
      seoSummary,
    })

  } catch (error) {
    console.error('Build opportunities error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
