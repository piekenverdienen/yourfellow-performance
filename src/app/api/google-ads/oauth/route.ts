import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleAdsOAuth } from '@/monitoring/google-ads';

const GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID!;
const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET!;

/**
 * GET /api/google-ads/oauth
 * Initiates the OAuth flow for Google Ads
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const clientId = searchParams.get('client_id');

  if (!clientId) {
    return NextResponse.json(
      { error: 'client_id is required' },
      { status: 400 }
    );
  }

  // Verify user has access to this client
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

  // Create state with client_id for callback
  const state = Buffer.from(JSON.stringify({
    clientId,
    userId: user.id,
    timestamp: Date.now(),
  })).toString('base64');

  // Get redirect URI
  const redirectUri = `${request.nextUrl.origin}/api/google-ads/oauth/callback`;

  // Generate authorization URL
  const oauth = new GoogleAdsOAuth(GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET);
  const authUrl = oauth.getAuthorizationUrl(redirectUri, state);

  return NextResponse.json({ authUrl });
}
