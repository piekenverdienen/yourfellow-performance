import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch user's accessible clients
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Use RPC function to get accessible clients with role
    const { data: clients, error } = await supabase
      .rpc('get_user_clients', { user_uuid: user.id })

    if (error) {
      console.error('Error fetching clients:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ clients: clients || [] })
  } catch (error) {
    console.error('Clients fetch error:', error)
    return NextResponse.json({ error: 'Fout bij ophalen van klanten' }, { status: 500 })
  }
}

// POST - Create a new client (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Check if user is org admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profiel niet gevonden' }, { status: 404 })
    }

    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Alleen admins kunnen klanten aanmaken' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, logo_url, settings } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      + '-' + Date.now().toString(36)

    // Create the client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: name.trim(),
        slug,
        description: description || null,
        logo_url: logo_url || null,
        settings: settings || {},
        created_by: user.id,
      })
      .select()
      .single()

    if (clientError) {
      console.error('Error creating client:', clientError)
      return NextResponse.json({ error: clientError.message }, { status: 500 })
    }

    // Automatically add the creator as owner
    const { error: membershipError } = await supabase
      .from('client_memberships')
      .insert({
        client_id: client.id,
        user_id: user.id,
        role: 'owner',
      })

    if (membershipError) {
      console.error('Error creating owner membership:', membershipError)
      // Don't fail the request, client is created
    }

    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    console.error('Client create error:', error)
    return NextResponse.json({ error: 'Fout bij aanmaken van klant' }, { status: 500 })
  }
}
