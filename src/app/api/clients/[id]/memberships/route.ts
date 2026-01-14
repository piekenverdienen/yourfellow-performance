import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { auditLog } from '@/lib/audit-log'

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

    // Fetch memberships with user profiles including approval status
    const { data: memberships, error } = await supabase
      .from('client_memberships')
      .select(`
        id,
        role,
        approval_status,
        approved_by,
        approved_at,
        rejected_at,
        rejection_reason,
        request_reason,
        created_at,
        updated_at,
        user_id,
        profiles:user_id (
          id,
          email,
          full_name,
          avatar_url,
          role
        ),
        approver:approved_by (
          id,
          email,
          full_name
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
      approval_status: m.approval_status,
      approved_by: m.approved_by,
      approved_at: m.approved_at,
      rejected_at: m.rejected_at,
      rejection_reason: m.rejection_reason,
      request_reason: m.request_reason,
      created_at: m.created_at,
      updated_at: m.updated_at,
      user: m.profiles,
      approver: m.approver,
    }))

    return NextResponse.json({ memberships: transformedMemberships })
  } catch (error) {
    console.error('Memberships fetch error:', error)
    return NextResponse.json({ error: 'Fout bij ophalen van teamleden' }, { status: 500 })
  }
}

// POST - Add a new membership (admin only)
// New memberships start with 'pending' status and require org admin approval
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

    // Check if requester is org admin (for auto-approval)
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()

    const isOrgAdmin = requesterProfile?.role === 'admin'

    const body = await request.json()
    const { user_id, email, role, request_reason } = body

    // Validate role
    const validRoles = ['owner', 'admin', 'editor', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Ongeldige rol' }, { status: 400 })
    }

    // Owners can only be set by org admins
    if (role === 'owner' && !isOrgAdmin) {
      return NextResponse.json({ error: 'Alleen org admins kunnen owners toewijzen' }, { status: 403 })
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
      .select('id, approval_status')
      .eq('client_id', clientId)
      .eq('user_id', targetUserId)
      .single()

    if (existingMembership) {
      const statusMsg = existingMembership.approval_status === 'pending'
        ? ' (wacht op goedkeuring)'
        : existingMembership.approval_status === 'rejected'
          ? ' (eerder afgewezen)'
          : ''
      return NextResponse.json({ error: `Gebruiker is al lid van deze client${statusMsg}` }, { status: 409 })
    }

    // Create membership with pending status (auto-approve if org admin)
    const { data: membership, error: membershipError } = await supabase
      .from('client_memberships')
      .insert({
        client_id: clientId,
        user_id: targetUserId,
        role,
        approval_status: isOrgAdmin ? 'approved' : 'pending',
        approved_by: isOrgAdmin ? user.id : null,
        approved_at: isOrgAdmin ? new Date().toISOString() : null,
        requested_by: user.id,
        request_reason: request_reason || null,
      })
      .select(`
        id,
        role,
        approval_status,
        approved_by,
        approved_at,
        request_reason,
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

    // Log audit event for membership creation
    await auditLog({
      action: isOrgAdmin ? 'membership.approved' : 'membership.requested',
      resourceType: 'client_membership',
      resourceId: membership.id,
      userId: user.id,
      userEmail: requesterProfile?.email || user.email || 'unknown',
      details: {
        client_id: clientId,
        target_user_id: targetUserId,
        role,
        approval_status: membership.approval_status,
        auto_approved: isOrgAdmin,
        request_reason: request_reason || null,
      },
    })

    // Transform response
    const transformedMembership = {
      id: membership.id,
      user_id: membership.user_id,
      role: membership.role,
      approval_status: membership.approval_status,
      approved_by: membership.approved_by,
      approved_at: membership.approved_at,
      request_reason: membership.request_reason,
      created_at: membership.created_at,
      updated_at: membership.updated_at,
      user: (membership as Record<string, unknown>).profiles,
    }

    const message = isOrgAdmin
      ? 'Teamlid toegevoegd en goedgekeurd'
      : 'Teamlid aangevraagd - wacht op goedkeuring door org admin'

    return NextResponse.json({
      membership: transformedMembership,
      message,
      requires_approval: !isOrgAdmin,
    }, { status: 201 })
  } catch (error) {
    console.error('Membership create error:', error)
    return NextResponse.json({ error: 'Fout bij toevoegen van teamlid' }, { status: 500 })
  }
}
