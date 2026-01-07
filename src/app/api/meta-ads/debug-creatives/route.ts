/**
 * Debug endpoint for Meta Ad Creatives
 *
 * GET /api/meta-ads/debug-creatives?clientId=xxx
 *
 * Shows what creative data is stored and what Meta returns
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    // Check if table exists and has data
    const { data: creatives, error: creativesError } = await supabase
      .from('meta_ad_creatives')
      .select('*')
      .eq('client_id', clientId)
      .limit(5)

    // Get one raw creative to see what Meta returned
    const { data: rawSample } = await supabase
      .from('meta_ad_creatives')
      .select('ad_id, ad_name, image_url, thumbnail_url, raw_creative_json')
      .eq('client_id', clientId)
      .not('raw_creative_json', 'is', null)
      .limit(1)
      .single()

    // Count total creatives
    const { count } = await supabase
      .from('meta_ad_creatives')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)

    // Check how many have images
    const { count: withImages } = await supabase
      .from('meta_ad_creatives')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .not('image_url', 'is', null)

    const { count: withThumbnails } = await supabase
      .from('meta_ad_creatives')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .not('thumbnail_url', 'is', null)

    return NextResponse.json({
      status: creativesError ? 'error' : 'ok',
      error: creativesError?.message,
      stats: {
        total_creatives: count || 0,
        with_image_url: withImages || 0,
        with_thumbnail_url: withThumbnails || 0,
      },
      sample_creatives: creatives?.map(c => ({
        ad_id: c.ad_id,
        ad_name: c.ad_name,
        has_image: !!c.image_url,
        has_thumbnail: !!c.thumbnail_url,
        image_url: c.image_url?.substring(0, 50) + '...',
        cta_type: c.cta_type,
      })),
      raw_creative_sample: rawSample?.raw_creative_json,
      message: count === 0
        ? 'No creatives found. Run a sync first: POST /api/meta-ads/sync'
        : `Found ${count} creatives, ${withImages} have image URLs`,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      hint: 'The meta_ad_creatives table might not exist. Run the migration first.',
    }, { status: 500 })
  }
}
