import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/playbooks/runs - Get playbook run history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const playbookId = searchParams.get('playbookId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('playbook_runs')
      .select(`
        *,
        playbook:playbooks(id, slug, title, category, icon),
        client:clients(id, name, slug)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by client if provided
    if (clientId) {
      // Check client access
      const { data: clientAccess } = await supabase
        .rpc('has_client_access', { check_client_id: clientId, min_role: 'viewer' })

      if (!clientAccess) {
        return NextResponse.json({ error: 'Geen toegang tot deze client' }, { status: 403 })
      }

      query = query.eq('client_id', clientId)
    }

    // Filter by playbook if provided
    if (playbookId) {
      query = query.eq('playbook_id', playbookId)
    }

    const { data: runs, error, count } = await query

    if (error) {
      console.error('Error fetching playbook runs:', error)
      return NextResponse.json({ error: 'Fout bij ophalen runs' }, { status: 500 })
    }

    return NextResponse.json({
      runs,
      total: count,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Playbook runs error:', error)
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 })
  }
}
