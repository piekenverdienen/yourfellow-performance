import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/clients/:id/context/export
 *
 * Exports the current context as a downloadable JSON file.
 * Query params:
 *   - version: specific version number (optional, defaults to active)
 *   - format: 'json' | 'pretty' (default: 'pretty')
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params
    const { searchParams } = new URL(request.url)
    const versionParam = searchParams.get('version')
    const format = searchParams.get('format') || 'pretty'

    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Niet geauthenticeerd' },
        { status: 401 }
      )
    }

    // Check client access
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'viewer',
    })

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Geen toegang tot deze klant' },
        { status: 403 }
      )
    }

    // Get client name for filename
    const { data: client } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single()

    const clientName = client?.name || 'unknown'

    let contextData
    let version: number

    if (versionParam) {
      // Get specific version
      version = parseInt(versionParam, 10)
      const { data, error } = await supabase
        .from('ai_context_versions')
        .select('context_json, summary_json, source_map, generated_by, generated_at')
        .eq('client_id', clientId)
        .eq('version', version)
        .single()

      if (error || !data) {
        return NextResponse.json(
          { error: 'Versie niet gevonden' },
          { status: 404 }
        )
      }

      contextData = data
    } else {
      // Get active version
      const { data: clientContext, error: contextError } = await supabase
        .from('client_context')
        .select('active_version, current_context_json, current_summary_json')
        .eq('client_id', clientId)
        .single()

      if (contextError || !clientContext) {
        return NextResponse.json(
          { error: 'Geen context gevonden' },
          { status: 404 }
        )
      }

      version = clientContext.active_version

      // Get full version data including source_map
      const { data: versionData } = await supabase
        .from('ai_context_versions')
        .select('source_map, generated_by, generated_at')
        .eq('client_id', clientId)
        .eq('version', version)
        .single()

      contextData = {
        context_json: clientContext.current_context_json,
        summary_json: clientContext.current_summary_json,
        source_map: versionData?.source_map,
        generated_by: versionData?.generated_by,
        generated_at: versionData?.generated_at,
      }
    }

    // Build export object
    const exportData = {
      _export: {
        clientId,
        clientName,
        version,
        exportedAt: new Date().toISOString(),
        exportedBy: user.email,
      },
      context: contextData.context_json,
      summary: contextData.summary_json,
      metadata: {
        sourceMap: contextData.source_map,
        generatedBy: contextData.generated_by,
        generatedAt: contextData.generated_at,
      },
    }

    // Format JSON
    const jsonString = format === 'pretty'
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData)

    // Create filename
    const safeClientName = clientName.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const filename = `context-${safeClientName}-v${version}.json`

    // Return as downloadable file
    return new NextResponse(jsonString, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Fout bij exporteren' },
      { status: 500 }
    )
  }
}
