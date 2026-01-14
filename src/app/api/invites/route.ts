import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { auditLog } from '@/lib/audit-log'

/**
 * GET /api/invites
 * Get all invites (filtered by client if specified)
 * Query params: client_id, status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const status = searchParams.get('status')

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Build query
    let query = supabase
      .from('invites')
      .select(`
        id,
        email,
        client_id,
        role,
        token,
        status,
        message,
        expires_at,
        accepted_at,
        created_at,
        client:client_id (
          id,
          name,
          slug
        ),
        inviter:invited_by (
          id,
          email,
          full_name
        ),
        accepter:accepted_by (
          id,
          email,
          full_name
        )
      `)
      .order('created_at', { ascending: false })

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: invites, error } = await query

    if (error) {
      console.error('Error fetching invites:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ invites: invites || [] })
  } catch (error) {
    console.error('Invites fetch error:', error)
    return NextResponse.json({ error: 'Fout bij ophalen van invites' }, { status: 500 })
  }
}

/**
 * POST /api/invites
 * Create a new invite
 * Body: { email, client_id, role, message? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    const body = await request.json()
    const { email, client_id, role, message } = body

    if (!email || !client_id) {
      return NextResponse.json({ error: 'email en client_id zijn verplicht' }, { status: 400 })
    }

    // Validate role
    const validRoles = ['owner', 'admin', 'editor', 'viewer']
    const inviteRole = role || 'viewer'
    if (!validRoles.includes(inviteRole)) {
      return NextResponse.json({ error: 'Ongeldige rol' }, { status: 400 })
    }

    // Check if user has admin access to this client
    const { data: roleData } = await supabase
      .rpc('get_client_role', { check_client_id: client_id, check_user_id: user.id })

    if (!roleData || !['admin', 'owner'].includes(roleData)) {
      return NextResponse.json({ error: 'Geen toegang om mensen uit te nodigen voor deze client' }, { status: 403 })
    }

    // Check if user is org admin (for owner role)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (inviteRole === 'owner' && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Alleen org admins kunnen owners uitnodigen' }, { status: 403 })
    }

    // Check if there's already a pending invite for this email/client
    const { data: existingInvite } = await supabase
      .from('invites')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('client_id', client_id)
      .eq('status', 'pending')
      .single()

    if (existingInvite) {
      return NextResponse.json({ error: 'Er staat al een openstaande invite uit voor dit e-mailadres' }, { status: 409 })
    }

    // Check if user already has membership
    const { data: existingMember } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existingMember) {
      const { data: existingMembership } = await supabase
        .from('client_memberships')
        .select('id, approval_status')
        .eq('client_id', client_id)
        .eq('user_id', existingMember.id)
        .single()

      if (existingMembership?.approval_status === 'approved') {
        return NextResponse.json({ error: 'Deze gebruiker heeft al toegang tot deze client' }, { status: 409 })
      }
    }

    // Get client name for response
    const { data: client } = await supabase
      .from('clients')
      .select('name')
      .eq('id', client_id)
      .single()

    // Create invite
    const { data: invite, error: createError } = await supabase
      .from('invites')
      .insert({
        email: email.toLowerCase(),
        client_id,
        role: inviteRole,
        message: message || null,
        invited_by: user.id,
      })
      .select(`
        id,
        email,
        client_id,
        role,
        token,
        status,
        message,
        expires_at,
        created_at
      `)
      .single()

    if (createError) {
      console.error('Error creating invite:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    // Log audit event
    await auditLog({
      action: 'membership.requested',
      resourceType: 'invite',
      resourceId: invite.id,
      userId: user.id,
      userEmail: profile?.email || 'unknown',
      details: {
        invited_email: email,
        client_id,
        client_name: client?.name,
        role: inviteRole,
      },
    })

    // Build invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yourfellow.nl'
    const inviteUrl = `${baseUrl}/invite/${invite.token}`

    return NextResponse.json({
      invite: {
        ...invite,
        client: { name: client?.name },
      },
      invite_url: inviteUrl,
      message: `Invite verstuurd naar ${email}`,
    }, { status: 201 })
  } catch (error) {
    console.error('Invite create error:', error)
    return NextResponse.json({ error: 'Fout bij maken van invite' }, { status: 500 })
  }
}
