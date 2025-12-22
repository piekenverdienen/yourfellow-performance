import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { GetVersionsResponse, ContextVersionListItem } from '@/lib/context/types'

/**
 * GET /api/clients/:id/context/versions
 *
 * Returns all context versions for a client.
 * Allows users to see version history and revert if needed.
 */
export async function GET(
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
      return NextResponse.json<GetVersionsResponse>(
        { success: false, versions: [], activeVersion: 0, error: 'Niet geauthenticeerd' },
        { status: 401 }
      )
    }

    // Check client access
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'viewer',
    })

    if (!hasAccess) {
      return NextResponse.json<GetVersionsResponse>(
        { success: false, versions: [], activeVersion: 0, error: 'Geen toegang tot deze klant' },
        { status: 403 }
      )
    }

    // Get client context for active version
    const { data: clientContext } = await supabase
      .from('client_context')
      .select('active_version')
      .eq('client_id', clientId)
      .single()

    const activeVersion = clientContext?.active_version ?? 0

    // Get all versions
    const { data: versionsData, error: versionsError } = await supabase
      .from('ai_context_versions')
      .select('version, generated_by, generated_at, summary_json')
      .eq('client_id', clientId)
      .order('version', { ascending: false })

    if (versionsError) {
      console.error('Error fetching versions:', versionsError)
      return NextResponse.json<GetVersionsResponse>(
        { success: false, versions: [], activeVersion: 0, error: versionsError.message },
        { status: 500 }
      )
    }

    // Map to response format
    interface VersionData {
      version: number
      generated_by: string
      generated_at: string
      summary_json: { oneLiner?: string } | null
    }
    const versions: ContextVersionListItem[] = (versionsData || []).map((v: VersionData) => ({
      version: v.version,
      generatedBy: v.generated_by,
      generatedAt: v.generated_at,
      isActive: v.version === activeVersion,
      summary: v.summary_json?.oneLiner,
    }))

    return NextResponse.json<GetVersionsResponse>({
      success: true,
      versions,
      activeVersion,
    })
  } catch (error) {
    console.error('Versions fetch error:', error)
    return NextResponse.json<GetVersionsResponse>(
      { success: false, versions: [], activeVersion: 0, error: 'Fout bij ophalen van versies' },
      { status: 500 }
    )
  }
}
