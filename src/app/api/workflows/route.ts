import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch user's workflows (including templates)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ workflows: [] })
    }

    const searchParams = request.nextUrl.searchParams
    const includeTemplates = searchParams.get('templates') === 'true'

    let query = supabase
      .from('workflows')
      .select('*')
      .order('updated_at', { ascending: false })

    if (includeTemplates) {
      query = query.or(`user_id.eq.${user.id},is_template.eq.true`)
    } else {
      query = query.eq('user_id', user.id)
    }

    const { data: workflows, error } = await query

    if (error) {
      console.error('Error fetching workflows:', error)
      return NextResponse.json({ workflows: [], error: error.message }, { status: 500 })
    }

    return NextResponse.json({ workflows: workflows || [] })
  } catch (error) {
    console.error('Workflows fetch error:', error)
    return NextResponse.json({ workflows: [], error: 'Failed to fetch workflows' }, { status: 500 })
  }
}

// POST - Create a new workflow
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, nodes, edges, is_template, client_id } = body

    // Verify client access if client_id provided
    if (client_id) {
      const { data: clientAccess } = await supabase
        .rpc('has_client_access', { check_client_id: client_id, min_role: 'editor' })

      if (!clientAccess) {
        return NextResponse.json({ error: 'Geen toegang tot deze client' }, { status: 403 })
      }
    }

    const { data: workflow, error } = await supabase
      .from('workflows')
      .insert({
        user_id: user.id,
        client_id: client_id || null,
        name: name || 'Nieuwe Workflow',
        description,
        nodes: nodes || [],
        edges: edges || [],
        is_template: is_template || false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating workflow:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ workflow })
  } catch (error) {
    console.error('Workflow create error:', error)
    return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 })
  }
}
