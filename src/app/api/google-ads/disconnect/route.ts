import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/google-ads/disconnect
 * Disconnect Google Ads from a client
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { clientId } = body as { clientId: string };

  if (!clientId) {
    return NextResponse.json(
      { error: 'client_id is required' },
      { status: 400 }
    );
  }

  // Verify user has admin access to this client
  const { data: membership } = await supabase
    .from('client_memberships')
    .select('role')
    .eq('client_id', clientId)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  // Get current settings
  const { data: client } = await supabase
    .from('clients')
    .select('settings')
    .eq('id', clientId)
    .single();

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const settings = (client.settings || {}) as Record<string, unknown>;

  // Remove Google Ads settings (but keep the status as not_connected for UI)
  const { error } = await supabase
    .from('clients')
    .update({
      settings: {
        ...settings,
        googleAds: {
          status: 'not_connected',
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId);

  if (error) {
    console.error('Error disconnecting Google Ads:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Google Ads' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
