import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET
const GOOGLE_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN

interface GoogleAdsRow {
  campaign: {
    id: string
    name: string
    status: string
  }
  metrics: {
    impressions: string
    clicks: string
    costMicros: string
    conversions: number
  }
}

async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text())
      return null
    }

    const data = await response.json()
    return data.access_token
  } catch (error) {
    console.error('Error refreshing token:', error)
    return null
  }
}

async function fetchGoogleAdsCampaigns(
  accessToken: string,
  customerId: string
): Promise<GoogleAdsRow[]> {
  // Google Ads Query Language (GAQL) query
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY metrics.impressions DESC
    LIMIT 50
  `

  const response = await fetch(
    `https://googleads.googleapis.com/v15/customers/${customerId}/googleAds:search`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': GOOGLE_DEVELOPER_TOKEN!,
        'login-customer-id': customerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Google Ads API error:', errorText)
    throw new Error(`Google Ads API error: ${response.status}`)
  }

  const data = await response.json()
  return data.results || []
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: integrationId } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .eq('user_id', user.id)
      .single()

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    if (integration.provider !== 'google_ads') {
      return NextResponse.json(
        { error: 'Invalid provider for this sync endpoint' },
        { status: 400 }
      )
    }

    if (!integration.refresh_token) {
      return NextResponse.json(
        { error: 'No refresh token available. Please reconnect.' },
        { status: 400 }
      )
    }

    if (!GOOGLE_DEVELOPER_TOKEN) {
      return NextResponse.json(
        { error: 'Google Ads Developer Token not configured' },
        { status: 500 }
      )
    }

    // Check if token needs refresh
    let accessToken = integration.access_token
    const tokenExpiry = new Date(integration.token_expires_at)

    if (tokenExpiry <= new Date()) {
      accessToken = await refreshGoogleToken(integration.refresh_token)

      if (!accessToken) {
        // Update integration status to expired
        await supabase
          .from('integrations')
          .update({
            connection_status: 'expired',
            last_error: 'Token refresh failed. Please reconnect.',
          })
          .eq('id', integrationId)

        return NextResponse.json(
          { error: 'Token expired. Please reconnect.' },
          { status: 401 }
        )
      }

      // Update access token
      await supabase
        .from('integrations')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        })
        .eq('id', integrationId)
    }

    // Fetch campaigns from Google Ads
    const campaigns = await fetchGoogleAdsCampaigns(
      accessToken,
      integration.account_id
    )

    // Transform data
    const transformedCampaigns = campaigns.map((row: GoogleAdsRow) => ({
      id: row.campaign.id,
      name: row.campaign.name,
      status: row.campaign.status,
      impressions: parseInt(row.metrics.impressions || '0'),
      clicks: parseInt(row.metrics.clicks || '0'),
      cost: parseInt(row.metrics.costMicros || '0') / 1000000, // Convert micros to currency
      conversions: row.metrics.conversions || 0,
      ctr: parseInt(row.metrics.impressions || '0') > 0
        ? (parseInt(row.metrics.clicks || '0') / parseInt(row.metrics.impressions)) * 100
        : 0,
      cpc: parseInt(row.metrics.clicks || '0') > 0
        ? (parseInt(row.metrics.costMicros || '0') / 1000000) / parseInt(row.metrics.clicks)
        : 0,
    }))

    // Calculate totals
    const totals = transformedCampaigns.reduce(
      (acc, campaign) => ({
        impressions: acc.impressions + campaign.impressions,
        clicks: acc.clicks + campaign.clicks,
        cost: acc.cost + campaign.cost,
        conversions: acc.conversions + campaign.conversions,
      }),
      { impressions: 0, clicks: 0, cost: 0, conversions: 0 }
    )

    // Cache the data
    await supabase.from('analytics_cache').upsert(
      {
        integration_id: integrationId,
        data_type: 'campaigns',
        date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        date_to: new Date().toISOString().split('T')[0],
        data: {
          campaigns: transformedCampaigns,
          totals,
          date_range: 'last_30_days',
        },
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour cache
      },
      {
        onConflict: 'integration_id,data_type,date_from,date_to',
      }
    )

    // Update integration last sync time
    await supabase
      .from('integrations')
      .update({
        last_synced_at: new Date().toISOString(),
        connection_status: 'connected',
        last_error: null,
      })
      .eq('id', integrationId)

    // Log the sync
    await supabase.from('integration_logs').insert({
      integration_id: integrationId,
      user_id: user.id,
      action: 'sync',
      provider: 'google_ads',
      details: {
        campaigns_synced: transformedCampaigns.length,
        totals,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        campaigns: transformedCampaigns,
        totals,
        synced_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Sync error:', error)

    // Try to update integration with error
    try {
      const { id: integrationId } = await params
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        await supabase
          .from('integrations')
          .update({
            connection_status: 'error',
            last_error: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', integrationId)
          .eq('user_id', user.id)
      }
    } catch {
      // Ignore update error
    }

    return NextResponse.json(
      { error: 'Sync failed. Please try again.' },
      { status: 500 }
    )
  }
}
