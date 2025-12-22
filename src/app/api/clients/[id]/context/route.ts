import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { GetContextResponse } from '@/lib/context/types'

/**
 * GET /api/clients/:id/context
 *
 * Returns the active context for a client.
 * This is the main endpoint all AI tools should use to get customer context.
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
      return NextResponse.json<GetContextResponse>(
        { success: false, context: null, summary: null, version: 0, status: 'pending', generatedAt: null, error: 'Niet geauthenticeerd' },
        { status: 401 }
      )
    }

    // Check client access
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'viewer',
    })

    if (!hasAccess) {
      return NextResponse.json<GetContextResponse>(
        { success: false, context: null, summary: null, version: 0, status: 'pending', generatedAt: null, error: 'Geen toegang tot deze klant' },
        { status: 403 }
      )
    }

    // Get client context
    const { data: clientContext, error: contextError } = await supabase
      .from('client_context')
      .select('*')
      .eq('client_id', clientId)
      .single()

    if (contextError && contextError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Error fetching client context:', contextError)
      return NextResponse.json<GetContextResponse>(
        { success: false, context: null, summary: null, version: 0, status: 'pending', generatedAt: null, error: contextError.message },
        { status: 500 }
      )
    }

    // If no context exists yet
    if (!clientContext) {
      // Check if client exists
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, name')
        .eq('id', clientId)
        .single()

      if (clientError || !client) {
        return NextResponse.json<GetContextResponse>(
          { success: false, context: null, summary: null, version: 0, status: 'pending', generatedAt: null, error: 'Klant niet gevonden' },
          { status: 404 }
        )
      }

      return NextResponse.json<GetContextResponse>({
        success: true,
        context: null,
        summary: null,
        version: 0,
        status: 'pending',
        generatedAt: null,
      })
    }

    // Get the active version details
    const { data: activeVersion, error: versionError } = await supabase
      .from('ai_context_versions')
      .select('generated_at')
      .eq('client_id', clientId)
      .eq('version', clientContext.active_version)
      .single()

    if (versionError) {
      console.error('Error fetching active version:', versionError)
    }

    return NextResponse.json<GetContextResponse>({
      success: true,
      context: clientContext.current_context_json,
      summary: clientContext.current_summary_json,
      version: clientContext.active_version,
      status: clientContext.status,
      generatedAt: activeVersion?.generated_at || clientContext.updated_at,
    })
  } catch (error) {
    console.error('Context fetch error:', error)
    return NextResponse.json<GetContextResponse>(
      { success: false, context: null, summary: null, version: 0, status: 'pending', generatedAt: null, error: 'Fout bij ophalen van context' },
      { status: 500 }
    )
  }
}
