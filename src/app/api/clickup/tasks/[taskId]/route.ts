import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClickUpClient } from '@/lib/clickup'

// PUT - Update a task in ClickUp (e.g., mark as complete)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { status, clientId } = body

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is vereist' }, { status: 400 })
    }

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Check if user has editor access to this client (can modify tasks)
    const { data: hasAccess } = await supabase
      .rpc('has_client_access', { check_client_id: clientId, required_role: 'editor' })

    if (!hasAccess) {
      return NextResponse.json({ error: 'Geen toegang om taken te bewerken' }, { status: 403 })
    }

    // Get ClickUp API key from environment
    const clickupApiKey = process.env.CLICKUP_API_KEY

    if (!clickupApiKey) {
      return NextResponse.json({
        error: 'ClickUp API key niet geconfigureerd'
      }, { status: 500 })
    }

    // Update task in ClickUp
    const clickup = createClickUpClient(clickupApiKey)

    const updates: {
      status?: string
      name?: string
      description?: string
    } = {}

    if (status) {
      updates.status = status
    }

    const updatedTask = await clickup.updateTask(taskId, updates)

    return NextResponse.json({ task: updatedTask })
  } catch (error) {
    console.error('ClickUp task update error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Fout bij bijwerken van taak'
    }, { status: 500 })
  }
}
