/**
 * Meta Ads Sync API
 *
 * POST /api/meta-ads/sync
 * Triggers a sync of Meta Ads data for a client
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMetaAdsSyncService } from '@/services/meta-ads-sync'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const body = await request.json()
    const { clientId, adAccountId, dateStart, dateEnd, entityTypes } = body

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'Client ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to client
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'editor',
    })

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Run sync
    const syncService = getMetaAdsSyncService()
    const result = await syncService.syncClient({
      clientId,
      adAccountId,
      dateStart,
      dateEnd,
      entityTypes,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Meta Ads sync error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
