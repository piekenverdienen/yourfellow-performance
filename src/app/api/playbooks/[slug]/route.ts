import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/playbooks/[slug] - Get a single playbook
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Fetch playbook (RLS will handle visibility)
    const { data: playbook, error } = await supabase
      .from('playbooks')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !playbook) {
      return NextResponse.json({ error: 'Playbook niet gevonden' }, { status: 404 })
    }

    return NextResponse.json({ playbook })
  } catch (error) {
    console.error('Get playbook error:', error)
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 })
  }
}

// PUT /api/playbooks/[slug] - Update a playbook (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
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
      return NextResponse.json({ error: 'Alleen admins kunnen playbooks bewerken' }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      category,
      description,
      input_schema,
      prompt_template,
      output_schema,
      status,
      icon,
      estimated_tokens,
      xp_reward
    } = body

    // Get current playbook to increment version if content changed
    const { data: currentPlaybook } = await supabase
      .from('playbooks')
      .select('version, prompt_template, input_schema, output_schema')
      .eq('slug', slug)
      .single()

    if (!currentPlaybook) {
      return NextResponse.json({ error: 'Playbook niet gevonden' }, { status: 404 })
    }

    // Increment version if prompt or schemas changed
    const contentChanged =
      (prompt_template && prompt_template !== currentPlaybook.prompt_template) ||
      (input_schema && JSON.stringify(input_schema) !== JSON.stringify(currentPlaybook.input_schema)) ||
      (output_schema && JSON.stringify(output_schema) !== JSON.stringify(currentPlaybook.output_schema))

    const newVersion = contentChanged ? currentPlaybook.version + 1 : currentPlaybook.version

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (category !== undefined) updateData.category = category
    if (description !== undefined) updateData.description = description
    if (input_schema !== undefined) updateData.input_schema = input_schema
    if (prompt_template !== undefined) updateData.prompt_template = prompt_template
    if (output_schema !== undefined) updateData.output_schema = output_schema
    if (status !== undefined) updateData.status = status
    if (icon !== undefined) updateData.icon = icon
    if (estimated_tokens !== undefined) updateData.estimated_tokens = estimated_tokens
    if (xp_reward !== undefined) updateData.xp_reward = xp_reward
    if (contentChanged) updateData.version = newVersion

    // Update playbook
    const { data: playbook, error } = await supabase
      .from('playbooks')
      .update(updateData)
      .eq('slug', slug)
      .select()
      .single()

    if (error) {
      console.error('Error updating playbook:', error)
      return NextResponse.json({ error: 'Fout bij bijwerken playbook' }, { status: 500 })
    }

    return NextResponse.json({ playbook })
  } catch (error) {
    console.error('Update playbook error:', error)
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 })
  }
}

// DELETE /api/playbooks/[slug] - Delete a playbook (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
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
      return NextResponse.json({ error: 'Alleen admins kunnen playbooks verwijderen' }, { status: 403 })
    }

    // Delete playbook
    const { error } = await supabase
      .from('playbooks')
      .delete()
      .eq('slug', slug)

    if (error) {
      console.error('Error deleting playbook:', error)
      return NextResponse.json({ error: 'Fout bij verwijderen playbook' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete playbook error:', error)
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 })
  }
}
