import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - List memberships for a client
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

    // Check if user has access to this client (RLS will handle this)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', id)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client niet gevonden of geen toegang' }, { status: 404 })
    }

    // Fetch memberships with user profiles
    const { data: memberships, error } = await supabase
      .from('client_memberships')
      .select(`
        id,
        role,
        created_at,
        updated_at,
        user_id,
        profiles:user_id (
          id,
          email,
          full_name,
          avatar_url,
          role
        )
      `)
      .eq('client_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching memberships:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform data to include user info at top level
    const transformedMemberships = (memberships || []).map((m: Record<string, unknown>) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      updated_at: m.updated_at,
      user: m.profiles,
    }))

    return NextResponse.json({ memberships: transformedMemberships })
  } catch (error) {
    console.error('Memberships fetch error:', error)
    return NextResponse.json({ error: 'Fout bij ophalen van teamleden' }, { status: 500 })
  }
}

// POST - Add a new membership (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Check if user has admin access to this client
    const { data: roleData } = await supabase
      .rpc('get_client_role', { check_client_id: clientId, check_user_id: user.id })

    if (!roleData || !['admin', 'owner'].includes(roleData)) {
      return NextResponse.json({ error: 'Geen toegang om teamleden toe te voegen' }, { status: 403 })
    }

    const body = await request.json()
    const { user_id, email, role } = body

    // Validate role
    const validRoles = ['owner', 'admin', 'editor', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Ongeldige rol' }, { status: 400 })
    }

    // Owners can only be set by org admins
    if (role === 'owner') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        return NextResponse.json({ error: 'Alleen org admins kunnen owners toewijzen' }, { status: 403 })
      }
    }

    // Find user by ID or email
    let targetUserId = user_id

    if (!targetUserId && email) {
      const { data: targetUser, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

      if (userError || !targetUser) {
        return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })
      }
      targetUserId = targetUser.id
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'user_id of email is verplicht' }, { status: 400 })
    }

    // Check if membership already exists
    const { data: existingMembership } = await supabase
      .from('client_memberships')
      .select('id')
      .eq('client_id', clientId)
      .eq('user_id', targetUserId)
      .single()

    if (existingMembership) {
      return NextResponse.json({ error: 'Gebruiker is al lid van deze client' }, { status: 409 })
    }

    // Create membership
    const { data: membership, error: membershipError } = await supabase
      .from('client_memberships')
      .insert({
        client_id: clientId,
        user_id: targetUserId,
        role,
      })
      .select(`
        id,
        role,
        created_at,
        updated_at,
        user_id,
        profiles:user_id (
          id,
          email,
          full_name,
          avatar_url,
          role
        )
      `)
      .single()

    if (membershipError) {
      console.error('Error creating membership:', membershipError)
      return NextResponse.json({ error: membershipError.message }, { status: 500 })
    }

    // Transform response
    const transformedMembership = {
      id: membership.id,
      user_id: membership.user_id,
      role: membership.role,
      created_at: membership.created_at,
      updated_at: membership.updated_at,
      user: (membership as Record<string, unknown>).profiles,
    }

    return NextResponse.json({ membership: transformedMembership }, { status: 201 })
  } catch (error) {
    console.error('Membership create error:', error)
    return NextResponse.json({ error: 'Fout bij toevoegen van teamlid' }, { status: 500 })
  }
}
