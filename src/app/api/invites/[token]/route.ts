import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { auditLog } from '@/lib/audit-log'

/**
 * GET /api/invites/[token]
 * Get invite details by token (public endpoint for accept page)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = await createClient()

    // Use the public function to get invite details
    const { data, error } = await supabase
      .rpc('get_invite_details', { invite_token: token })

    if (error) {
      console.error('Error fetching invite:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0 || data[0].status === 'not_found') {
      return NextResponse.json({ error: 'Invite niet gevonden' }, { status: 404 })
    }

    const invite = data[0]

    return NextResponse.json({
      valid: invite.valid,
      status: invite.status,
      email: invite.email,
      client_name: invite.client_name,
      role: invite.role,
      invited_by: invite.invited_by_name,
      message: invite.message,
      expires_at: invite.expires_at,
    })
  } catch (error) {
    console.error('Invite fetch error:', error)
    return NextResponse.json({ error: 'Fout bij ophalen van invite' }, { status: 500 })
  }
}

/**
 * POST /api/invites/[token]
 * Accept an invite
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        error: 'Je moet ingelogd zijn om een invite te accepteren',
        redirect_to_login: true,
      }, { status: 401 })
    }

    // Get user's email to verify it matches the invite
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    // Accept the invite using the database function
    const { data, error } = await supabase
      .rpc('accept_invite', { invite_token: token })

    if (error) {
      console.error('Error accepting invite:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Fout bij accepteren van invite' }, { status: 500 })
    }

    const result = data[0]

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    // Log audit event
    await auditLog({
      action: 'membership.approved',
      resourceType: 'invite',
      resourceId: token,
      userId: user.id,
      userEmail: profile?.email || user.email || 'unknown',
      details: {
        client_id: result.client_id,
        client_name: result.client_name,
        role: result.role,
        accepted_via: 'invite',
      },
    })

    return NextResponse.json({
      success: true,
      message: result.message,
      client_id: result.client_id,
      client_name: result.client_name,
      role: result.role,
    })
  } catch (error) {
    console.error('Invite accept error:', error)
    return NextResponse.json({ error: 'Fout bij accepteren van invite' }, { status: 500 })
  }
}

/**
 * DELETE /api/invites/[token]
 * Revoke an invite (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // First get the invite to check permissions
    const { data: invite, error: fetchError } = await supabase
      .from('invites')
      .select('id, client_id, email, status, invited_by')
      .eq('token', token)
      .single()

    if (fetchError || !invite) {
      return NextResponse.json({ error: 'Invite niet gevonden' }, { status: 404 })
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'Alleen openstaande invites kunnen worden ingetrokken' }, { status: 400 })
    }

    // Check if user has permission (org admin, client admin, or original inviter)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()

    const isOrgAdmin = profile?.role === 'admin'
    const isInviter = invite.invited_by === user.id

    if (!isOrgAdmin && !isInviter) {
      // Check client admin access
      const { data: roleData } = await supabase
        .rpc('get_client_role', { check_client_id: invite.client_id, check_user_id: user.id })

      if (!roleData || !['admin', 'owner'].includes(roleData)) {
        return NextResponse.json({ error: 'Geen toegang om deze invite in te trekken' }, { status: 403 })
      }
    }

    // Revoke the invite
    const { error: updateError } = await supabase
      .from('invites')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
      })
      .eq('id', invite.id)

    if (updateError) {
      console.error('Error revoking invite:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log audit event
    await auditLog({
      action: 'membership.rejected',
      resourceType: 'invite',
      resourceId: invite.id,
      userId: user.id,
      userEmail: profile?.email || 'unknown',
      details: {
        invited_email: invite.email,
        client_id: invite.client_id,
        action: 'revoked',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Invite ingetrokken',
    })
  } catch (error) {
    console.error('Invite revoke error:', error)
    return NextResponse.json({ error: 'Fout bij intrekken van invite' }, { status: 500 })
  }
}
