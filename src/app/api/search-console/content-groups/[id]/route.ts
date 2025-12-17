/**
 * Content Group API - Single Group Operations
 *
 * GET /api/search-console/content-groups/[id] - Get group details with pages
 * PATCH /api/search-console/content-groups/[id] - Update group
 * DELETE /api/search-console/content-groups/[id] - Delete group
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { contentGroupRowToModel } from '@/types/search-console'
import { matchPagesToGroups } from '@/services/search-console-sync'
import type { ContentGroupRow, ContentGroupPage } from '@/types/search-console'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get group
    const { data: groupData, error: groupError } = await supabase
      .from('content_groups')
      .select('*')
      .eq('id', id)
      .single()

    if (groupError || !groupData) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const group = contentGroupRowToModel(groupData as ContentGroupRow)

    // Get pages in this group
    const { data: pagesData } = await supabase
      .from('content_group_pages')
      .select('*')
      .eq('group_id', id)
      .order('impressions', { ascending: false })

    group.pages = (pagesData || []).map(p => ({
      id: p.id,
      groupId: p.group_id,
      pageUrl: p.page_url,
      impressions: p.impressions,
      clicks: p.clicks,
      matchedBy: p.matched_by,
      createdAt: p.created_at,
    })) as ContentGroupPage[]

    return NextResponse.json({ group })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Get current group for client ID
    const { data: currentGroup } = await supabase
      .from('content_groups')
      .select('client_id')
      .eq('id', id)
      .single()

    if (!currentGroup) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.description !== undefined) updates.description = body.description?.trim() || null
    if (body.color !== undefined) updates.color = body.color
    if (body.urlPatterns !== undefined) {
      updates.url_patterns = body.urlPatterns.map((p: string) => p.trim())
    }
    if (body.urlRegex !== undefined) updates.url_regex = body.urlRegex?.trim() || null

    // Update group
    const { data, error } = await supabase
      .from('content_groups')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Re-match pages if patterns changed
    if (body.urlPatterns !== undefined || body.urlRegex !== undefined) {
      try {
        // Clear existing mappings for this group
        await supabase
          .from('content_group_pages')
          .delete()
          .eq('group_id', id)

        // Re-match
        await matchPagesToGroups(currentGroup.client_id)
      } catch (matchError) {
        console.error('Error re-matching pages:', matchError)
      }
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Delete group (cascades to content_group_pages)
    const { error } = await supabase
      .from('content_groups')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
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
