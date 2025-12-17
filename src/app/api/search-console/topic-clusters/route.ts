/**
 * Topic Clusters API
 *
 * GET /api/search-console/topic-clusters - List topic clusters for a client
 * POST /api/search-console/topic-clusters - Create a topic cluster
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { topicClusterRowToModel } from '@/types/search-console'
import { matchQueriesToClusters } from '@/services/search-console-sync'
import type { TopicClusterRow } from '@/types/search-console'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const clientId = searchParams.get('clientId')
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('topic_clusters')
      .select('*')
      .eq('client_id', clientId)
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const clusters = (data as TopicClusterRow[]).map(topicClusterRowToModel)

    return NextResponse.json({ clusters })
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

    const { clientId, name, description, color, matchKeywords, matchRegex } = body

    if (!clientId || !name) {
      return NextResponse.json(
        { error: 'clientId and name are required' },
        { status: 400 }
      )
    }

    if (!matchKeywords || matchKeywords.length === 0) {
      return NextResponse.json(
        { error: 'At least one match keyword is required' },
        { status: 400 }
      )
    }

    // Insert cluster
    const { data, error } = await supabase
      .from('topic_clusters')
      .insert({
        client_id: clientId,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#6366f1',
        match_keywords: matchKeywords.map((k: string) => k.toLowerCase().trim()),
        match_regex: matchRegex?.trim() || null,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A cluster with this name already exists' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Match existing queries to this cluster
    try {
      await matchQueriesToClusters(clientId)
    } catch (matchError) {
      console.error('Error matching queries to cluster:', matchError)
    }

    return NextResponse.json({
      cluster: topicClusterRowToModel(data as TopicClusterRow),
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
