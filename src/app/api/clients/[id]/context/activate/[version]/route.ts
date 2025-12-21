import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ActivateVersionResponse } from '@/lib/context/types'

/**
 * POST /api/clients/:id/context/activate/:version
 *
 * Activates a specific context version.
 * This is an explicit user action - new versions are NOT automatically activated.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  try {
    const { id: clientId, version: versionStr } = await params
    const version = parseInt(versionStr, 10)

    if (isNaN(version) || version < 1) {
      return NextResponse.json<ActivateVersionResponse>(
        { success: false, version: 0, error: 'Ongeldige versie' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json<ActivateVersionResponse>(
        { success: false, version: 0, error: 'Niet geauthenticeerd' },
        { status: 401 }
      )
    }

    // Check client access (need admin role to activate versions)
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'admin',
    })

    if (!hasAccess) {
      return NextResponse.json<ActivateVersionResponse>(
        { success: false, version: 0, error: 'Alleen admins kunnen versies activeren' },
        { status: 403 }
      )
    }

    // Check if version exists
    const { data: versionData, error: versionError } = await supabase
      .from('ai_context_versions')
      .select('version, context_json, summary_json')
      .eq('client_id', clientId)
      .eq('version', version)
      .single()

    if (versionError || !versionData) {
      return NextResponse.json<ActivateVersionResponse>(
        { success: false, version: 0, error: 'Versie niet gevonden' },
        { status: 404 }
      )
    }

    // Call the activate function
    const { data: activated, error: activateError } = await supabase.rpc(
      'activate_context_version',
      {
        p_client_id: clientId,
        p_version: version,
      }
    )

    if (activateError) {
      console.error('Error activating version:', activateError)
      return NextResponse.json<ActivateVersionResponse>(
        { success: false, version: 0, error: activateError.message },
        { status: 500 }
      )
    }

    if (!activated) {
      return NextResponse.json<ActivateVersionResponse>(
        { success: false, version: 0, error: 'Kon versie niet activeren' },
        { status: 500 }
      )
    }

    return NextResponse.json<ActivateVersionResponse>({
      success: true,
      version,
    })
  } catch (error) {
    console.error('Activate version error:', error)
    return NextResponse.json<ActivateVersionResponse>(
      { success: false, version: 0, error: 'Fout bij activeren van versie' },
      { status: 500 }
    )
  }
}
