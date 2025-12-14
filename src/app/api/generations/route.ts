import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface Generation {
  id: string
  tool: string
  input: {
    prompt?: string
    [key: string]: unknown
  }
  output: {
    imageUrl?: string
    revisedPrompt?: string
    [key: string]: unknown
  }
  rating: number | null
  is_favorite: boolean
  created_at: string
}

// GET - Fetch user's recent generations
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ generations: [] })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '6')
    const tool = searchParams.get('tool') // Optional filter by tool

    let query = supabase
      .from('generations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (tool) {
      query = query.eq('tool', tool)
    }

    const { data: generations, error } = await query

    if (error) {
      console.error('Error fetching generations:', error)
      return NextResponse.json({ generations: [], error: error.message }, { status: 500 })
    }

    return NextResponse.json({ generations: generations || [] })
  } catch (error) {
    console.error('Generations fetch error:', error)
    return NextResponse.json({ generations: [], error: 'Failed to fetch generations' }, { status: 500 })
  }
}

// POST - Save a new generation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { tool, input, output } = body

    if (!tool || !input || !output) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: generation, error } = await supabase
      .from('generations')
      .insert({
        user_id: user.id,
        tool,
        input,
        output,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving generation:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ generation })
  } catch (error) {
    console.error('Generation save error:', error)
    return NextResponse.json({ error: 'Failed to save generation' }, { status: 500 })
  }
}

// PATCH - Update generation (rating, favorite)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { id, rating, is_favorite } = body

    if (!id) {
      return NextResponse.json({ error: 'Generation ID required' }, { status: 400 })
    }

    const updates: { rating?: number; is_favorite?: boolean } = {}
    if (rating !== undefined) updates.rating = rating
    if (is_favorite !== undefined) updates.is_favorite = is_favorite

    const { data: generation, error } = await supabase
      .from('generations')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user owns this generation
      .select()
      .single()

    if (error) {
      console.error('Error updating generation:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ generation })
  } catch (error) {
    console.error('Generation update error:', error)
    return NextResponse.json({ error: 'Failed to update generation' }, { status: 500 })
  }
}
