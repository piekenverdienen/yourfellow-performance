/**
 * Branded Keywords API
 *
 * GET /api/search-console/branded-keywords - List branded keywords for a client
 * POST /api/search-console/branded-keywords - Add a branded keyword
 * DELETE /api/search-console/branded-keywords - Remove a branded keyword
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { brandedKeywordRowToModel } from '@/types/search-console'
import { updateBrandedStatus } from '@/services/search-console-sync'
import type { BrandedKeywordRow, BrandedKeywordMatchType } from '@/types/search-console'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const clientId = searchParams.get('clientId')
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('branded_keywords')
      .select('*')
      .eq('client_id', clientId)
      .order('keyword', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const keywords = (data as BrandedKeywordRow[]).map(brandedKeywordRowToModel)

    return NextResponse.json({ keywords })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { clientId, keyword, matchType = 'contains' } = body

    if (!clientId || !keyword) {
      return NextResponse.json(
        { error: 'clientId and keyword are required' },
        { status: 400 }
      )
    }

    // Validate match type
    const validMatchTypes: BrandedKeywordMatchType[] = ['contains', 'exact', 'starts_with']
    if (!validMatchTypes.includes(matchType)) {
      return NextResponse.json(
        { error: 'Invalid matchType. Must be: contains, exact, or starts_with' },
        { status: 400 }
      )
    }

    // Insert keyword
    const { data, error } = await supabase
      .from('branded_keywords')
      .insert({
        client_id: clientId,
        keyword: keyword.toLowerCase().trim(),
        match_type: matchType,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This keyword already exists for this client' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update branded status for existing queries
    try {
      await updateBrandedStatus(clientId)
    } catch (updateError) {
      console.error('Error updating branded status:', updateError)
    }

    return NextResponse.json({
      keyword: brandedKeywordRowToModel(data as BrandedKeywordRow),
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const id = searchParams.get('id')
    const clientId = searchParams.get('clientId')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Get the keyword first to find the client ID if not provided
    let actualClientId = clientId
    if (!actualClientId) {
      const { data: keyword } = await supabase
        .from('branded_keywords')
        .select('client_id')
        .eq('id', id)
        .single()

      actualClientId = keyword?.client_id
    }

    // Delete keyword
    const { error } = await supabase
      .from('branded_keywords')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update branded status for existing queries
    if (actualClientId) {
      try {
        await updateBrandedStatus(actualClientId)
      } catch (updateError) {
        console.error('Error updating branded status:', updateError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
