import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface RollbackResponse {
  success: boolean
  previousVersion: number
  currentVersion: number
  error?: string
}

/**
 * POST /api/clients/:id/context/rollback
 *
 * Rolls back to the previous context version.
 * This is a convenience endpoint that activates version (current - 1).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json<RollbackResponse>(
        { success: false, previousVersion: 0, currentVersion: 0, error: 'Niet geauthenticeerd' },
        { status: 401 }
      )
    }

    // Check client access (need admin role to rollback)
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'admin',
    })

    if (!hasAccess) {
      return NextResponse.json<RollbackResponse>(
        { success: false, previousVersion: 0, currentVersion: 0, error: 'Alleen admins kunnen terugdraaien' },
        { status: 403 }
      )
    }

    // Get current active version
    const { data: clientContext, error: contextError } = await supabase
      .from('client_context')
      .select('active_version')
      .eq('client_id', clientId)
      .single()

    if (contextError || !clientContext) {
      return NextResponse.json<RollbackResponse>(
        { success: false, previousVersion: 0, currentVersion: 0, error: 'Geen context gevonden' },
        { status: 404 }
      )
    }

    const currentVersion = clientContext.active_version

    if (currentVersion <= 1) {
      return NextResponse.json<RollbackResponse>(
        { success: false, previousVersion: 0, currentVersion, error: 'Kan niet terugdraaien: dit is de eerste versie' },
        { status: 400 }
      )
    }

    const previousVersion = currentVersion - 1

    // Check if previous version exists
    const { data: versionData, error: versionError } = await supabase
      .from('ai_context_versions')
      .select('version')
      .eq('client_id', clientId)
      .eq('version', previousVersion)
      .single()

    if (versionError || !versionData) {
      return NextResponse.json<RollbackResponse>(
        { success: false, previousVersion: 0, currentVersion, error: 'Vorige versie niet gevonden' },
        { status: 404 }
      )
    }

    // Activate the previous version
    const { data: activated, error: activateError } = await supabase.rpc(
      'activate_context_version',
      {
        p_client_id: clientId,
        p_version: previousVersion,
      }
    )

    if (activateError || !activated) {
      console.error('Error rolling back:', activateError)
      return NextResponse.json<RollbackResponse>(
        { success: false, previousVersion, currentVersion, error: 'Kon niet terugdraaien' },
        { status: 500 }
      )
    }

    return NextResponse.json<RollbackResponse>({
      success: true,
      previousVersion,
      currentVersion,
    })
  } catch (error) {
    console.error('Rollback error:', error)
    return NextResponse.json<RollbackResponse>(
      { success: false, previousVersion: 0, currentVersion: 0, error: 'Fout bij terugdraaien' },
      { status: 500 }
    )
  }
}
