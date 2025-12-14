import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface MarketingEvent {
  id: string
  title: string
  description: string | null
  event_date: string
  event_type: 'holiday' | 'sale' | 'campaign' | 'deadline'
  color: string
  is_global: boolean
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const searchParams = request.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    // Calculate date range for the month (including padding days for calendar view)
    const startDate = new Date(year, month - 1, 1)
    startDate.setDate(startDate.getDate() - 7) // Include previous week

    const endDate = new Date(year, month, 0)
    endDate.setDate(endDate.getDate() + 7) // Include next week

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Get user's session for personal events
    const { data: { user } } = await supabase.auth.getUser()

    // Fetch events: global events + user's personal events
    let query = supabase
      .from('marketing_events')
      .select('*')
      .gte('event_date', startDateStr)
      .lte('event_date', endDateStr)
      .order('event_date', { ascending: true })

    if (user) {
      // Get global events OR user's own events
      query = query.or(`is_global.eq.true,created_by.eq.${user.id}`)
    } else {
      // Only global events for unauthenticated users
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

