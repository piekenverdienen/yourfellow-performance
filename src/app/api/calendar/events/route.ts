import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface MarketingEvent {
  id: string
  title: string
  description: string | null
  event_date: string
  event_type: 'holiday' | 'sale' | 'campaign' | 'deadline' | 'life' | 'launch'
  color: string
  is_global: boolean
  client_id: string | null
  created_by: string | null
  client?: {
    id: string
    name: string
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const searchParams = request.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())
    const clientId = searchParams.get('client_id') // Optional: filter by specific client
    const mode = searchParams.get('mode') || 'month' // 'month' or 'week'

    // Calculate date range
    let startDate: Date
    let endDate: Date

    if (mode === 'week') {
      // Get current week (Monday to Sunday)
      const now = new Date()
      const dayOfWeek = now.getDay()
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      startDate = new Date(now)
      startDate.setDate(now.getDate() + diffToMonday)
      startDate.setHours(0, 0, 0, 0)

      endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + 6)
    } else {
      // Month view with padding
      startDate = new Date(year, month - 1, 1)
      startDate.setDate(startDate.getDate() - 7)

      endDate = new Date(year, month, 0)
      endDate.setDate(endDate.getDate() + 7)
    }

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Get user's session
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Only global events for unauthenticated users
      const { data: events, error } = await supabase
        .from('marketing_events')
        .select('*')
        .eq('is_global', true)
        .gte('event_date', startDateStr)
        .lte('event_date', endDateStr)
        .order('event_date', { ascending: true })

      if (error) {
        console.error('Error fetching events:', error)
        return NextResponse.json({ events: [], error: error.message }, { status: 500 })
      }

      return NextResponse.json({ events: events || [] })
    }

    // Get user's client memberships
    const { data: memberships } = await supabase
      .from('client_memberships')
      .select('client_id')
      .eq('user_id', user.id)

    const clientIds = memberships?.map(m => m.client_id) || []

    // Build query for authenticated users
    // Fetch: global events + own events + events from accessible clients
    let query = supabase
      .from('marketing_events')
      .select(`
        *,
        client:clients(id, name)
      `)
      .gte('event_date', startDateStr)
      .lte('event_date', endDateStr)
      .order('event_date', { ascending: true })

    if (clientId) {
      // Filter by specific client
      query = query.or(`is_global.eq.true,created_by.eq.${user.id},client_id.eq.${clientId}`)
    } else if (clientIds.length > 0) {
      // Get events for all accessible clients
      query = query.or(`is_global.eq.true,created_by.eq.${user.id},client_id.in.(${clientIds.join(',')})`)
    } else {
      // User has no client access, only global and own events
      query = query.or(`is_global.eq.true,created_by.eq.${user.id}`)
    }

    const { data: events, error } = await query

    if (error) {
      console.error('Error fetching events:', error)
      return NextResponse.json({ events: [], error: error.message }, { status: 500 })
    }

    return NextResponse.json({ events: events || [] })
  } catch (error) {
    console.error('Calendar events error:', error)
    return NextResponse.json({ events: [], error: 'Failed to fetch events' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, event_date, event_type, color, client_id, is_global } = body

    // Validate required fields
    if (!title || !event_date || !event_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if user can create global events (must be admin)
    if (is_global) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Only admins can create global events' }, { status: 403 })
      }
    }

    // Check if user has access to the client (if client_id provided)
    if (client_id) {
      const { data: membership } = await supabase
        .from('client_memberships')
        .select('role')
        .eq('client_id', client_id)
        .eq('user_id', user.id)
        .single()

      if (!membership || !['owner', 'admin', 'editor'].includes(membership.role)) {
        return NextResponse.json({ error: 'No permission to add events for this client' }, { status: 403 })
      }
    }

    // Default colors based on event type
    const defaultColors: Record<string, string> = {
      holiday: '#22C55E',
      sale: '#EF4444',
      campaign: '#3B82F6',
      deadline: '#F97316',
      life: '#8B5CF6',
      launch: '#00FFCC',
    }

    const { data: event, error } = await supabase
      .from('marketing_events')
      .insert({
        title,
        description: description || null,
        event_date,
        event_type,
        color: color || defaultColors[event_type] || '#00FFCC',
        client_id: client_id || null,
        is_global: is_global || false,
        created_by: user.id,
      })
      .select(`
        *,
        client:clients(id, name)
      `)
      .single()

    if (error) {
      console.error('Error creating event:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ event })
  } catch (error) {
    console.error('Create event error:', error)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get('id')

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 })
    }

    // Check if user owns the event or is admin
    const { data: event } = await supabase
      .from('marketing_events')
      .select('created_by')
      .eq('id', eventId)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (event.created_by !== user.id && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'No permission to delete this event' }, { status: 403 })
    }

    const { error } = await supabase
      .from('marketing_events')
      .delete()
      .eq('id', eventId)

    if (error) {
      console.error('Error deleting event:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete event error:', error)
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  }
}

