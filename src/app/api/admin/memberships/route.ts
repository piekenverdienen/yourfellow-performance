import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { auditLog } from '@/lib/audit-log'

/**
 * GET /api/admin/memberships
 * Get all pending memberships for admin review
 * Only accessible by org admins
 */
export async function GET() {
  try {
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
      return NextResponse.json({ error: 'Alleen org admins hebben toegang' }, { status: 403 })
    }

    // Fetch all pending memberships with related data
    const { data: pendingMemberships, error } = await supabase
      .from('client_memberships')
      .select(`
        id,
        role,
        approval_status,
        request_reason,
        created_at,
        user_id,
        client_id,
        requested_by,
        user:user_id (
          id,
          email,
          full_name,
          avatar_url
        ),
        client:client_id (
          id,
          name,
          slug
        ),
        requester:requested_by (
          id,
          email,
          full_name
        )
      `)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching pending memberships:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform data for cleaner response
    const transformedMemberships = (pendingMemberships || []).map((m: Record<string, unknown>) => ({
      id: m.id,
      user_id: m.user_id,
      client_id: m.client_id,
      requested_role: m.role,
      request_reason: m.request_reason,
      created_at: m.created_at,
      user: m.user,
      client: m.client,
      requester: m.requester,
    }))

    return NextResponse.json({
      pending_memberships: transformedMemberships,
      count: transformedMemberships.length,
    })
  } catch (error) {
    console.error('Admin memberships fetch error:', error)
    return NextResponse.json({ error: 'Fout bij ophalen van pending memberships' }, { status: 500 })
  }
}

/**
 * POST /api/admin/memberships
 * Approve or reject a pending membership
 * Only accessible by org admins
 *
 * Body: { membership_id: string, action: 'approve' | 'reject', reason?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Check if user is org admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Alleen org admins kunnen memberships goedkeuren/afwijzen' }, { status: 403 })
    }

    const body = await request.json()
    const { membership_id, action, reason } = body

    if (!membership_id) {
      return NextResponse.json({ error: 'membership_id is verplicht' }, { status: 400 })
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action moet "approve" of "reject" zijn' }, { status: 400 })
    }

    // Fetch the pending membership to validate it exists and is pending
    const { data: membership, error: fetchError } = await supabase
      .from('client_memberships')
      .select(`
        id,
        approval_status,
        user_id,
        client_id,
        role,
        user:user_id (
          email,
          full_name
        ),
        client:client_id (
          name
        )
      `)
      .eq('id', membership_id)
      .single()

    if (fetchError || !membership) {
      return NextResponse.json({ error: 'Membership niet gevonden' }, { status: 404 })
    }

    if (membership.approval_status !== 'pending') {
      return NextResponse.json({
        error: `Membership is al ${membership.approval_status === 'approved' ? 'goedgekeurd' : 'afgewezen'}`,
      }, { status: 400 })
    }

    // Update membership based on action
    const updateData = action === 'approve'
      ? {
          approval_status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejected_at: null,
          rejection_reason: null,
        }
      : {
          approval_status: 'rejected',
          approved_by: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason || null,
          approved_at: null,
        }

    const { error: updateError } = await supabase
      .from('client_memberships')
      .update(updateData)
      .eq('id', membership_id)

    if (updateError) {
      console.error('Error updating membership:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log audit event
    const userInfo = membership.user as { email?: string; full_name?: string } | null
    const clientInfo = membership.client as { name?: string } | null
    await auditLog({
      action: action === 'approve' ? 'membership.approved' : 'membership.rejected',
      resourceType: 'client_membership',
      resourceId: membership_id,
      userId: user.id,
      userEmail: profile.email || 'unknown',
      details: {
        target_user_id: membership.user_id,
        target_user_email: userInfo?.email,
        client_id: membership.client_id,
        client_name: clientInfo?.name,
        role: membership.role,
        action,
        reason: reason || null,
      },
    })

    const actionText = action === 'approve' ? 'goedgekeurd' : 'afgewezen'

    return NextResponse.json({
      success: true,
      message: `Membership ${actionText}`,
      membership_id,
      action,
    })
  } catch (error) {
    console.error('Admin membership action error:', error)
    return NextResponse.json({ error: 'Fout bij verwerken van membership actie' }, { status: 500 })
  }
}
