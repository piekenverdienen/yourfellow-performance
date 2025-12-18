import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch a single client by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Fetch client - RLS will handle access control
    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Client niet gevonden of geen toegang' }, { status: 404 })
      }
      console.error('Error fetching client:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get user's role for this client
    const { data: roleData } = await supabase
      .rpc('get_client_role', { check_client_id: id, check_user_id: user.id })

    return NextResponse.json({
      client: {
        ...client,
        role: roleData || 'viewer',
      },
    })
  } catch (error) {
    console.error('Client fetch error:', error)
    return NextResponse.json({ error: 'Fout bij ophalen van client' }, { status: 500 })
  }
}

// PUT - Update a client (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Check if user has admin access to this client
    const { data: roleData } = await supabase
      .rpc('get_client_role', { check_client_id: id, check_user_id: user.id })

    if (!roleData || !['admin', 'owner'].includes(roleData)) {
      return NextResponse.json({ error: 'Geen toegang om deze client te bewerken' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, logo_url, settings, is_active } = body

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name.trim()
    if (description !== undefined) updates.description = description
    if (logo_url !== undefined) updates.logo_url = logo_url
    if (is_active !== undefined) updates.is_active = is_active

    // For settings, merge with existing settings to prevent data loss
    if (settings !== undefined) {
      // First fetch current settings from database
      const { data: currentClient } = await supabase
        .from('clients')
        .select('settings')
        .eq('id', id)
        .single()

      // Deep merge settings (new settings override existing)
      updates.settings = {
        ...(currentClient?.settings || {}),
        ...settings,
      }
    }

    const { data: client, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating client:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ client })
  } catch (error) {
    console.error('Client update error:', error)
    return NextResponse.json({ error: 'Fout bij bijwerken van client' }, { status: 500 })
  }
}

// DELETE - Delete a client (org admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Check if user is org admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Alleen org admins kunnen clients verwijderen' }, { status: 403 })
    }

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting client:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Client delete error:', error)
    return NextResponse.json({ error: 'Fout bij verwijderen van client' }, { status: 500 })
  }
}
