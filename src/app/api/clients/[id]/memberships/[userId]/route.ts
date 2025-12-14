import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PUT - Update a membership role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: clientId, userId: targetUserId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Check if user has admin access to this client
    const { data: roleData } = await supabase
      .rpc('get_client_role', { check_client_id: clientId, check_user_id: user.id })

    if (!roleData || !['admin', 'owner'].includes(roleData)) {
      return NextResponse.json({ error: 'Geen toegang om teamrollen te wijzigen' }, { status: 403 })
    }

    const body = await request.json()
    const { role } = body

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

    // Prevent removing own admin access
    if (targetUserId === user.id && roleData === 'owner' && role !== 'owner') {
      return NextResponse.json({ error: 'Je kunt je eigen owner rol niet wijzigen' }, { status: 400 })
    }

    // Update membership
    const { data: membership, error: membershipError } = await supabase
      .from('client_memberships')
      .update({ role })
      .eq('client_id', clientId)
      .eq('user_id', targetUserId)
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
      if (membershipError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Lidmaatschap niet gevonden' }, { status: 404 })
      }
      console.error('Error updating membership:', membershipError)
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

    return NextResponse.json({ membership: transformedMembership })
  } catch (error) {
    console.error('Membership update error:', error)
    return NextResponse.json({ error: 'Fout bij wijzigen van teamrol' }, { status: 500 })
  }
}

// DELETE - Remove a membership
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: clientId, userId: targetUserId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Check if user has owner access to this client (only owners can remove members)
    const { data: roleData } = await supabase
      .rpc('get_client_role', { check_client_id: clientId, check_user_id: user.id })

    // Check if current user is org admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isOrgAdmin = profile?.role === 'admin'

    if (!isOrgAdmin && (!roleData || !['admin', 'owner'].includes(roleData))) {
      return NextResponse.json({ error: 'Geen toegang om teamleden te verwijderen' }, { status: 403 })
    }

    // Prevent removing yourself if you're the only owner
    if (targetUserId === user.id) {
      // Check if there are other owners
      const { data: otherOwners } = await supabase
        .from('client_memberships')
        .select('id')
        .eq('client_id', clientId)
        .eq('role', 'owner')
        .neq('user_id', user.id)

      if (!otherOwners || otherOwners.length === 0) {
        return NextResponse.json({
          error: 'Je kunt jezelf niet verwijderen als enige owner. Wijs eerst een andere owner aan.'
        }, { status: 400 })
      }
    }

    // Delete membership
    const { error: deleteError } = await supabase
      .from('client_memberships')
      .delete()
      .eq('client_id', clientId)
      .eq('user_id', targetUserId)

    if (deleteError) {
      console.error('Error deleting membership:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Membership delete error:', error)
    return NextResponse.json({ error: 'Fout bij verwijderen van teamlid' }, { status: 500 })
  }
}
