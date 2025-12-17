/**
 * Search Console Sync API
 *
 * POST /api/search-console/sync - Trigger a sync for a client
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  syncSearchConsoleData,
  updateBrandedStatus,
  matchQueriesToClusters,
  matchPagesToGroups,
} from '@/services/search-console-sync'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, siteUrl, dateRangeDays = 28 } = body

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    // Get site URL from client settings if not provided
    let syncSiteUrl = siteUrl
    if (!syncSiteUrl) {
      const supabase = await createClient()
      const { data: client } = await supabase
        .from('clients')
        .select('settings')
        .eq('id', clientId)
        .single()

      syncSiteUrl = client?.settings?.searchConsole?.siteUrl

      if (!syncSiteUrl) {
        return NextResponse.json(
          { error: 'siteUrl is required or must be configured in client settings' },
          { status: 400 }
        )
      }
    }

    // Run sync
    const result = await syncSearchConsoleData(clientId, syncSiteUrl, {
      dateRangeDays,
    })

    // If sync was successful, also update cluster and group mappings
    if (result.success || result.queriesProcessed > 0) {
      try {
        await matchQueriesToClusters(clientId)
        await matchPagesToGroups(clientId)
      } catch (matchError) {
        console.error('Error matching queries/pages:', matchError)
        result.errors.push(
          `Matching error: ${matchError instanceof Error ? matchError.message : 'Unknown error'}`
        )
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        queriesProcessed: 0,
        queriesAdded: 0,
        queriesUpdated: 0,
        pagesProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        syncedAt: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
