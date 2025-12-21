import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch user's kudos (sent and received)
export async function GET() {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get kudos remaining today
    const { data: remainingData } = await supabase
      .rpc('get_kudos_remaining', { user_uuid: user.id })

    const kudosRemaining = remainingData ?? 3

    // Get received kudos (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: receivedKudos } = await supabase
      .from('kudos')
      .select(`
        id,
        message,
        xp_amount,
        created_at,
        from_user:from_user_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('to_user_id', user.id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20)

    // Get sent kudos (today only for limit display)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: sentKudosToday } = await supabase
      .from('kudos')
      .select(`
        id,
        message,
        created_at,
        to_user:to_user_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('from_user_id', user.id)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })

    // Get total kudos received (all time)
    const { count: totalReceived } = await supabase
      .from('kudos')
      .select('*', { count: 'exact', head: true })
      .eq('to_user_id', user.id)

    // Get total XP from kudos
    const { data: xpData } = await supabase
      .from('kudos')
      .select('xp_amount')
      .eq('to_user_id', user.id)

    const totalXpFromKudos = xpData?.reduce((sum: number, k: { xp_amount: number | null }) => sum + (k.xp_amount || 5), 0) || 0

    return NextResponse.json({
      kudosRemaining,
      maxDailyKudos: 3,
      receivedKudos: receivedKudos || [],
      sentKudosToday: sentKudosToday || [],
      totalReceived: totalReceived || 0,
      totalXpFromKudos,
    })

  } catch (error) {
    console.error('Kudos fetch error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis bij het ophalen van kudos.' },
      { status: 500 }
    )
  }
}

// POST - Send kudos to another user
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { toUserId, message } = body

    if (!toUserId) {
      return NextResponse.json(
        { error: 'Ontvanger ID is verplicht' },
        { status: 400 }
      )
    }

    // Can't kudos yourself
    if (toUserId === user.id) {
      return NextResponse.json(
        { error: 'Je kunt jezelf geen kudos geven!' },
        { status: 400 }
      )
    }

    // Try using the RPC function first
    const { data: result, error: rpcError } = await supabase
      .rpc('send_kudos', {
        from_uuid: user.id,
        to_uuid: toUserId,
        kudos_message: message || null,
      })

    if (rpcError) {
      console.error('RPC error:', rpcError)
      // Fallback to manual insert
      return await sendKudosFallback(supabase, user.id, toUserId, message)
    }

    const rpcResult = result?.[0]

    if (!rpcResult?.success) {
      return NextResponse.json(
        { error: rpcResult?.message || 'Kon kudos niet versturen' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: rpcResult.message,
      kudosRemaining: 3 - rpcResult.kudos_today,
    })

  } catch (error) {
    console.error('Send kudos error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis bij het versturen van kudos.' },
      { status: 500 }
    )
  }
}

// Fallback kudos send if RPC doesn't exist
async function sendKudosFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fromUserId: string,
  toUserId: string,
  message?: string
) {
  // Check daily limit
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('kudos')
    .select('*', { count: 'exact', head: true })
    .eq('from_user_id', fromUserId)
    .gte('created_at', today.toISOString())

  if ((count || 0) >= 3) {
    return NextResponse.json(
      { error: 'Je hebt vandaag al 3 kudos gegeven' },
      { status: 400 }
    )
  }

  // Insert kudos
  const { error: insertError } = await supabase
    .from('kudos')
    .insert({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      message: message || null,
      xp_amount: 5,
    })

  if (insertError) {
    console.error('Insert kudos error:', insertError)
    return NextResponse.json(
      { error: 'Kon kudos niet versturen' },
      { status: 500 }
    )
  }

  // Add XP to receiver
  const { data: profile } = await supabase
    .from('profiles')
    .select('xp, full_name')
    .eq('id', toUserId)
    .single()

  if (profile) {
    await supabase
      .from('profiles')
      .update({ xp: profile.xp + 5 })
      .eq('id', toUserId)

    return NextResponse.json({
      success: true,
      message: `Kudos verzonden! +5 XP voor ${profile.full_name}`,
      kudosRemaining: 2 - (count || 0),
    })
  }

  return NextResponse.json({
    success: true,
    message: 'Kudos verzonden!',
    kudosRemaining: 2 - (count || 0),
  })
}
