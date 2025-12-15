import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClickUpClient } from '@/lib/clickup'

// GET - Fetch tasks for a client from ClickUp
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const includeClosed = searchParams.get('includeClosed') === 'true'

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is vereist' }, { status: 400 })
    }

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Check if user has access to this client
    const { data: hasAccess } = await supabase
      .rpc('has_client_access', { check_client_id: clientId, required_role: 'viewer' })

    if (!hasAccess) {
      return NextResponse.json({ error: 'Geen toegang tot deze client' }, { status: 403 })
    }

    // Get client settings to find ClickUp list ID
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('settings')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client niet gevonden' }, { status: 404 })
    }

    const clickupListId = client.settings?.clickup?.listId

    if (!clickupListId) {
      return NextResponse.json({
        error: 'ClickUp niet geconfigureerd voor deze client',
        needsSetup: true
      }, { status: 400 })
    }

    // Get ClickUp API key from environment
    const clickupApiKey = process.env.CLICKUP_API_KEY

    if (!clickupApiKey) {
      return NextResponse.json({
        error: 'ClickUp API key niet geconfigureerd',
        needsSetup: true
      }, { status: 500 })
    }

    // Fetch tasks from ClickUp
    const clickup = createClickUpClient(clickupApiKey)

    const { tasks } = await clickup.getTasks(clickupListId, {
      include_closed: includeClosed,
      subtasks: true,
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('ClickUp tasks fetch error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Fout bij ophalen van taken'
    }, { status: 500 })
  }
}
