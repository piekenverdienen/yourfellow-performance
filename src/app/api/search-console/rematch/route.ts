/**
 * Re-match API - Re-runs cluster and group matching without a full sync
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  matchQueriesToClusters,
  matchPagesToGroups,
} from '@/services/search-console-sync'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId } = body

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    // Run matching
    await matchQueriesToClusters(clientId)
    await matchPagesToGroups(clientId)

    return NextResponse.json({
      success: true,
      message: 'Matching completed successfully',
    })
  } catch (error) {
    console.error('Rematch error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
