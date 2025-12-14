import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Playbook, PlaybookCategory, PlaybookStatus } from '@/types'

// GET /api/playbooks - List playbooks
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check if user is org admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isOrgAdmin = profile?.role === 'admin'

    // Get query params
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as PlaybookCategory | null
    const status = searchParams.get('status') as PlaybookStatus | null

    // Build query - non-admins only see published playbooks (RLS handles this too)
    let query = supabase
      .from('playbooks')
      .select('*')
      .order('title', { ascending: true })

    // Filter by category if provided
    if (category) {
      query = query.eq('category', category)
    }

    // Filter by status if provided (only matters for admins)
    if (status && isOrgAdmin) {
      query = query.eq('status', status)
    } else if (!isOrgAdmin) {
      // Non-admins only see published
      query = query.eq('status', 'published')
    }

    const { data: playbooks, error } = await query

    if (error) {
      console.error('Error fetching playbooks:', error)
      return NextResponse.json({ error: 'Fout bij ophalen playbooks' }, { status: 500 })
    }

    return NextResponse.json({ playbooks, isOrgAdmin })
  } catch (error) {
    console.error('Playbooks list error:', error)
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 })
  }
}

// POST /api/playbooks - Create a new playbook (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check if user is org admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Alleen admins kunnen playbooks aanmaken' }, { status: 403 })
    }

    const body = await request.json()
    const {
      slug,
      title,
      category,
      description,
      input_schema,
      prompt_template,
      output_schema,
      icon,
      estimated_tokens,
      xp_reward
    } = body

    // Validate required fields
    if (!slug || !title || !category || !prompt_template) {
      return NextResponse.json(
        { error: 'Slug, titel, categorie en prompt template zijn verplicht' },
        { status: 400 }
      )
    }

    // Insert playbook
    const { data: playbook, error } = await supabase
      .from('playbooks')
      .insert({
        org_id: user.id,
        slug,
        title,
        category,
        description,
        input_schema: input_schema || { type: 'object', properties: {}, required: [] },
        prompt_template,
        output_schema: output_schema || { type: 'object' },
        icon: icon || 'file-text',
        estimated_tokens: estimated_tokens || 1000,
        xp_reward: xp_reward || 10,
        status: 'draft',
        version: 1,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating playbook:', error)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Een playbook met deze slug bestaat al' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Fout bij aanmaken playbook' }, { status: 500 })
    }

    return NextResponse.json({ playbook }, { status: 201 })
  } catch (error) {
    console.error('Create playbook error:', error)
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 })
  }
}
