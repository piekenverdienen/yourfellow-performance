import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Alert, AlertChannel, AlertType, AlertSeverity, AlertStatus } from '@/types';

/**
 * GET /api/alerts
 * Get alerts with optional filtering
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const clientId = searchParams.get('client_id');
  const channel = searchParams.get('channel') as AlertChannel | null;
  const type = searchParams.get('type') as AlertType | null;
  const severity = searchParams.get('severity') as AlertSeverity | null;
  const status = searchParams.get('status') as AlertStatus | null;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('per_page') || '20', 10);

  // Build query
  let query = supabase
    .from('alerts')
    .select('*, clients!inner(name, slug)', { count: 'exact' })
    .order('detected_at', { ascending: false });

  // Apply filters
  if (clientId) {
    query = query.eq('client_id', clientId);
  } else {
    // If no client specified, only show alerts for clients user has access to
    const { data: memberships } = await supabase
      .from('client_memberships')
      .select('client_id')
      .eq('user_id', user.id);

    if (memberships && memberships.length > 0) {
      query = query.in('client_id', memberships.map((m: { client_id: string }) => m.client_id));
    } else {
      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        return NextResponse.json({ alerts: [], pagination: { total: 0, page, per_page: perPage } });
      }
    }
  }

  if (channel) {
    query = query.eq('channel', channel);
  }
  if (type) {
    query = query.eq('type', type);
  }
  if (severity) {
    query = query.eq('severity', severity);
  }
  if (status) {
    query = query.eq('status', status);
  } else {
    // Default to open alerts
    query = query.eq('status', 'open');
  }

  // Pagination
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  query = query.range(from, to);

  const { data: alerts, error, count } = await query;

  if (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }

  // Transform response
  const transformedAlerts = (alerts || []).map((alert: Record<string, unknown> & { clients?: { name?: string; slug?: string } }) => ({
    id: alert.id,
    client_id: alert.client_id,
    client_name: alert.clients?.name,
    client_slug: alert.clients?.slug,
    type: alert.type,
    channel: alert.channel,
    check_id: alert.check_id,
    severity: alert.severity,
    status: alert.status,
    title: alert.title,
    short_description: alert.short_description,
    impact: alert.impact,
    suggested_actions: alert.suggested_actions,
    details: alert.details,
    detected_at: alert.detected_at,
    acknowledged_at: alert.acknowledged_at,
    resolved_at: alert.resolved_at,
  }));

  return NextResponse.json({
    alerts: transformedAlerts,
    pagination: {
      total: count || 0,
      page,
      per_page: perPage,
    },
  });
}
