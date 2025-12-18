/**
 * Content Groups API
 *
 * GET /api/search-console/content-groups - List content groups for a client
 * POST /api/search-console/content-groups - Create a content group
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { contentGroupRowToModel } from '@/types/search-console'
import { matchPagesToGroups } from '@/services/search-console-sync'
import type { ContentGroupRow } from '@/types/search-console'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const clientId = searchParams.get('clientId')
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('content_groups')
      .select('*')
      .eq('client_id', clientId)
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const groups = (data as ContentGroupRow[]).map(contentGroupRowToModel)

    return NextResponse.json({ groups })
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

    const { clientId, name, description, color, urlPatterns, urlRegex } = body

    if (!clientId || !name) {
      return NextResponse.json(
        { error: 'clientId and name are required' },
        { status: 400 }
      )
    }

    if ((!urlPatterns || urlPatterns.length === 0) && !urlRegex) {
      return NextResponse.json(
        { error: 'At least one URL pattern or regex is required' },
        { status: 400 }
      )
    }

    // Insert group
    const { data, error } = await supabase
      .from('content_groups')
      .insert({
        client_id: clientId,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#10b981',
        url_patterns: urlPatterns?.map((p: string) => p.trim()) || [],
        url_regex: urlRegex?.trim() || null,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A group with this name already exists' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Match existing pages to this group
    try {
      await matchPagesToGroups(clientId)
    } catch (matchError) {
      console.error('Error matching pages to group:', matchError)
    }

    return NextResponse.json({
      group: contentGroupRowToModel(data as ContentGroupRow),
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
