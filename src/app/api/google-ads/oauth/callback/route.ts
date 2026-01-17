import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsOAuth, GoogleAdsClient } from '@/monitoring/google-ads';
import { createLogger } from '@/monitoring/utils/logger';

const GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID!;
const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET!;
const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const logger = createLogger('info');

interface OAuthState {
  clientId: string;
  userId: string;
  timestamp: number;
}

/**
 * GET /api/google-ads/oauth/callback
 * Handles the OAuth callback from Google
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    logger.error('OAuth error from Google', { error });
    return NextResponse.redirect(
      new URL(`/clients?error=oauth_${error}`, request.nextUrl.origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/clients?error=missing_params', request.nextUrl.origin)
    );
  }

  // Parse state
  let oauthState: OAuthState;
  try {
    oauthState = JSON.parse(Buffer.from(state, 'base64').toString());
  } catch {
    return NextResponse.redirect(
      new URL('/clients?error=invalid_state', request.nextUrl.origin)
    );
  }

  // Verify state is not too old (15 minutes)
  if (Date.now() - oauthState.timestamp > 15 * 60 * 1000) {
    return NextResponse.redirect(
      new URL('/clients?error=expired_state', request.nextUrl.origin)
    );
  }

  const { clientId, userId } = oauthState;
  const redirectUri = `${request.nextUrl.origin}/api/google-ads/oauth/callback`;

  try {
    // Exchange code for tokens
    const oauth = new GoogleAdsOAuth(GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET);
    const tokens = await oauth.exchangeCode(code, redirectUri);

    logger.info('OAuth tokens received', { clientId });

    // Use service role client for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Update client status to pending while we verify
    await supabase
      .from('clients')
      .update({
        settings: supabase.rpc('jsonb_set_nested', {
          target: 'settings',
          path: ['googleAds'],
          value: {
            status: 'pending',
            refreshToken: tokens.refreshToken,
            lastVerifiedAt: null,
          },
        }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    // Create client to verify and get customer info
    // First, we need to get accessible customers
    const accessibleCustomers = await getAccessibleCustomers(tokens.accessToken);

    if (accessibleCustomers.length === 0) {
      logger.warn('No accessible Google Ads customers found', { clientId });

      await supabase
        .from('clients')
        .update({
          settings: supabase.rpc('jsonb_set_nested', {
            target: 'settings',
            path: ['googleAds'],
            value: {
              status: 'not_connected',
              refreshToken: null,
              error: 'No accessible Google Ads accounts found',
            },
          }),
        })
        .eq('id', clientId);

      return NextResponse.redirect(
        new URL(`/clients/${clientId}?error=no_accounts`, request.nextUrl.origin)
      );
    }

    // For now, use the first accessible customer
    // TODO: Allow user to select which account to connect
    const customerId = accessibleCustomers[0];

    // Verify connection with the customer
    const adsClient = new GoogleAdsClient({
      credentials: {
        type: 'oauth',
        developerToken: GOOGLE_ADS_DEVELOPER_TOKEN,
        clientId: GOOGLE_ADS_CLIENT_ID,
        clientSecret: GOOGLE_ADS_CLIENT_SECRET,
        refreshToken: tokens.refreshToken,
      },
      customerId,
      logger,
    });

    const customerInfo = await adsClient.getCustomerInfo();

    if (!customerInfo) {
      throw new Error('Failed to get customer info');
    }

    // Get current settings to preserve other fields
    const { data: currentClient } = await supabase
      .from('clients')
      .select('settings')
      .eq('id', clientId)
      .single();

    const currentSettings = (currentClient?.settings || {}) as Record<string, unknown>;

    // Update client with connected status and customer info
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        settings: {
          ...currentSettings,
          googleAds: {
            status: 'connected',
            customerId: formatCustomerId(customerId),
            refreshToken: tokens.refreshToken,
            lastVerifiedAt: new Date().toISOString(),
            monitoringEnabled: true,
            customerName: customerInfo.descriptiveName,
            currency: customerInfo.currencyCode,
            timezone: customerInfo.timeZone,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    if (updateError) {
      throw updateError;
    }

    logger.info('Google Ads connected successfully', {
      clientId,
      customerId,
      customerName: customerInfo.descriptiveName,
    });

    // Redirect to client page with success
    return NextResponse.redirect(
      new URL(`/clients/${clientId}?success=google_ads_connected`, request.nextUrl.origin)
    );
  } catch (error) {
    logger.error('Failed to complete OAuth flow', {
      clientId,
      error: (error as Error).message,
    });

    // Update client with error status
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: currentClient } = await supabase
      .from('clients')
      .select('settings')
      .eq('id', clientId)
      .single();

    const currentSettings = (currentClient?.settings || {}) as Record<string, unknown>;

    await supabase
      .from('clients')
      .update({
        settings: {
          ...currentSettings,
          googleAds: {
            status: 'not_connected',
            error: (error as Error).message,
          },
        },
      })
      .eq('id', clientId);

    return NextResponse.redirect(
      new URL(`/clients/${clientId}?error=connection_failed`, request.nextUrl.origin)
    );
  }
}

/**
 * Get list of accessible Google Ads customer IDs
 */
async function getAccessibleCustomers(accessToken: string): Promise<string[]> {
  const response = await fetch(
    'https://googleads.googleapis.com/v22/customers:listAccessibleCustomers',
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': GOOGLE_ADS_DEVELOPER_TOKEN,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    logger.error('Failed to list accessible customers', { error });
    return [];
  }

  const data = await response.json();

  // Response format: { resourceNames: ["customers/1234567890", ...] }
  return (data.resourceNames || []).map((name: string) =>
    name.replace('customers/', '')
  );
}

/**
 * Format customer ID with dashes (xxx-xxx-xxxx)
 */
function formatCustomerId(customerId: string): string {
  const clean = customerId.replace(/-/g, '');
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 10)}`;
}
