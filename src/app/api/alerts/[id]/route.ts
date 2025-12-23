import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AlertStatus } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/alerts/:id
 * Get a single alert by ID
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const { data: alert, error } = await supabase
    .from('alerts')
    .select('*, clients!inner(name, slug)')
    .eq('id', id)
    .single();

  if (error || !alert) {
    return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
  }

  // Check user has access to the client
  const { data: membership } = await supabase
    .from('client_memberships')
    .select('role')
    .eq('client_id', alert.client_id)
    .eq('user_id', user.id)
    .single();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!membership && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  return NextResponse.json({
    ...alert,
    client_name: alert.clients?.name,
    client_slug: alert.clients?.slug,
  });
}

/**
 * PATCH /api/alerts/:id
 * Update alert status
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const { status } = body as { status: AlertStatus };

  if (!status || !['open', 'acknowledged', 'resolved'].includes(status)) {
    return NextResponse.json(
      { error: 'Invalid status. Must be: open, acknowledged, or resolved' },
      { status: 400 }
    );
  }

  // Get the alert first to check access
  const { data: alert } = await supabase
    .from('alerts')
    .select('client_id')
    .eq('id', id)
    .single();

  if (!alert) {
    return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
  }

  // Check user has access to the client
  const { data: membership } = await supabase
    .from('client_memberships')
    .select('role')
    .eq('client_id', alert.client_id)
    .eq('user_id', user.id)
    .single();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!membership && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Build update object
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'acknowledged') {
    updates.acknowledged_at = new Date().toISOString();
  } else if (status === 'resolved') {
    updates.resolved_at = new Date().toISOString();
  }

  const { data: updatedAlert, error } = await supabase
    .from('alerts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating alert:', error);
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
  }

  return NextResponse.json(updatedAlert);
}
