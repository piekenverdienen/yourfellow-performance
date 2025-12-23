import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AlertChannel, AlertSummary } from '@/types';

/**
 * GET /api/alerts/summary
 * Get critical alerts summary for homepage
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const clientId = searchParams.get('client_id');

  // Build query for critical/high fundamental alerts
  let query = supabase
    .from('alerts')
    .select('id, client_id, channel, title, short_description, severity, check_id, detected_at, clients!inner(name)')
    .eq('status', 'open')
    .eq('type', 'fundamental')
    .in('severity', ['critical', 'high'])
    .order('detected_at', { ascending: false });

  if (clientId) {
    query = query.eq('client_id', clientId);
  } else {
    // Only show alerts for clients user has access to
    const { data: memberships } = await supabase
      .from('client_memberships')
      .select('client_id')
      .eq('user_id', user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (memberships && memberships.length > 0) {
      query = query.in('client_id', memberships.map(m => m.client_id));
    } else if (profile?.role !== 'admin') {
      // Not an admin and no memberships
      return NextResponse.json({
        total_critical: 0,
        by_channel: {},
      } as AlertSummary);
    }
  }

  const { data: alerts, error } = await query;

  if (error) {
    console.error('Error fetching alert summary:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }

  // Group by channel
  const byChannel: Record<string, { count: number; items: unknown[] }> = {};

  for (const alert of alerts || []) {
    const channel = alert.channel as AlertChannel;
    if (!byChannel[channel]) {
      byChannel[channel] = { count: 0, items: [] };
    }
    byChannel[channel].count++;

    // Only include first 3 items per channel
    if (byChannel[channel].items.length < 3) {
      byChannel[channel].items.push({
        id: alert.id,
        client_id: alert.client_id,
        client_name: alert.clients?.name,
        title: alert.title,
        short_description: alert.short_description,
        severity: alert.severity,
        check_id: alert.check_id,
        detected_at: alert.detected_at,
      });
    }
  }

  const summary: AlertSummary = {
    total_critical: alerts?.length || 0,
    by_channel: byChannel as AlertSummary['by_channel'],
  };

  return NextResponse.json(summary);
}
