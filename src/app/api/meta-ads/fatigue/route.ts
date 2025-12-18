/**
 * Meta Ads Fatigue API
 *
 * GET /api/meta-ads/fatigue - Get fatigue signals
 * POST /api/meta-ads/fatigue - Run fatigue detection
 * PATCH /api/meta-ads/fatigue - Acknowledge a signal
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMetaFatigueDetector } from '@/services/meta-fatigue-detector'
import type { MetaFatigueSeverity } from '@/types/meta-ads'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const severity = searchParams.getAll('severity') as MetaFatigueSeverity[]
    const includeAcknowledged = searchParams.get('includeAcknowledged') === 'true'

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    // Verify access
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'viewer',
    })

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get fatigue signals
    const detector = getMetaFatigueDetector()
    const signals = await detector.getActiveSignals(clientId, {
      severity: severity.length > 0 ? severity : undefined,
      includeAcknowledged,
    })

    return NextResponse.json({ signals })
  } catch (error) {
    console.error('Fatigue GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const body = await request.json()
    const { clientId, adAccountId } = body

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    // Verify access
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'editor',
    })

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get ad account ID from settings if not provided
    let accountId = adAccountId
    if (!accountId) {
      const { data: client } = await supabase
        .from('clients')
        .select('settings')
        .eq('id', clientId)
        .single()

      accountId = client?.settings?.meta?.adAccountId
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'Meta Ads not configured for this client' },
        { status: 400 }
      )
    }

    // Run fatigue detection
    const detector = getMetaFatigueDetector()
    const signals = await detector.detectFatigue(
      clientId,
      `act_${accountId.replace(/^act_/, '')}`
    )

    return NextResponse.json({
      success: true,
      detected: signals.length,
      signals,
    })
  } catch (error) {
    console.error('Fatigue POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const body = await request.json()
    const { signalId, clientId } = body

    if (!signalId || !clientId) {
      return NextResponse.json(
        { error: 'signalId and clientId are required' },
        { status: 400 }
      )
    }

    // Verify access
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'editor',
    })

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Acknowledge signal
    const detector = getMetaFatigueDetector()
    await detector.acknowledgeSignal(signalId, user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Fatigue PATCH error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
