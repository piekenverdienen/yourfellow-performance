import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EventType } from '@/types'

const EVENT_COLORS: Record<EventType, string> = {
  holiday: '#22C55E',   // green
  sale: '#EF4444',      // red
  campaign: '#3B82F6',  // blue
  deadline: '#F59E0B',  // amber
  life: '#8B5CF6',      // purple
  launch: '#00FFCC',    // primary/mint
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const searchParams = request.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())
    const clientId = searchParams.get('clientId')

    // Calculate date range for the month (including padding days for calendar view)
    const startDate = new Date(year, month - 1, 1)
    startDate.setDate(startDate.getDate() - 7)

    const endDate = new Date(year, month, 0)
    endDate.setDate(endDate.getDate() + 14)

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    const { data: { user } } = await supabase.auth.getUser()

    // Build query with client info
    let query = supabase
      .from('marketing_events')
      .select('*, client:clients(id, name)')
      .gte('event_date', startDateStr)
      .lte('event_date', endDateStr)
      .order('event_date', { ascending: true })

    if (user) {
      // Get: global events OR user's personal events OR client events user has access to
      if (clientId) {
        // Filter to specific client + global events
        query = query.or(`is_global.eq.true,client_id.eq.${clientId},and(created_by.eq.${user.id},client_id.is.null)`)
      } else {
        // All events user can see
        query = query.or(`is_global.eq.true,created_by.eq.${user.id}`)
      }
    } else {
      query = query.eq('is_global', true)
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
    const { title, description, event_date, event_type, client_id, is_global } = body

    // Validate required fields
    if (!title || !event_date || !event_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if user is admin for global events
    if (is_global) {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (userData?.role !== 'admin') {
        return NextResponse.json({ error: 'Only admins can create global events' }, { status: 403 })
      }
    }

    // Check client access if client_id provided
    if (client_id) {
      const { data: membership } = await supabase
        .from('client_memberships')
        .select('role')
        .eq('client_id', client_id)
        .eq('user_id', user.id)
        .single()

      if (!membership || !['owner', 'admin', 'editor'].includes(membership.role)) {
        return NextResponse.json({ error: 'No editor access to this client' }, { status: 403 })
      }
    }

    const color = EVENT_COLORS[event_type as EventType] || '#6B7280'

    const { data: event, error } = await supabase
      .from('marketing_events')
      .insert({
        title,
        description: description || null,
        event_date,
        event_type,
        color,
        is_global: is_global || false,
        client_id: client_id || null,
        created_by: user.id,
      })
      .select('*, client:clients(id, name)')
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

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (event.created_by !== user.id && userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Cannot delete this event' }, { status: 403 })
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
