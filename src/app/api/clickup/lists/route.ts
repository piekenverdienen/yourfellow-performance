import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClickUpClient } from '@/lib/clickup'

// GET - Fetch available ClickUp workspaces, spaces, folders, and lists
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const spaceId = searchParams.get('spaceId')
    const folderId = searchParams.get('folderId')
    const listId = searchParams.get('listId')

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'marketer'].includes(profile.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    // Get ClickUp API key from environment
    const clickupApiKey = process.env.CLICKUP_API_KEY

    if (!clickupApiKey) {
      return NextResponse.json({
        error: 'ClickUp API key niet geconfigureerd',
        needsSetup: true
      }, { status: 500 })
    }

    const clickup = createClickUpClient(clickupApiKey)

    // If listId is provided, get list details with statuses
    if (listId) {
      const list = await clickup.getList(listId)
      return NextResponse.json({ list })
    }

    // If folderId is provided, get lists in that folder
    if (folderId) {
      const { lists } = await clickup.getListsInFolder(folderId)
      return NextResponse.json({ lists })
    }

    // If spaceId is provided, get folders and folderless lists
    if (spaceId) {
      const [foldersResult, listsResult] = await Promise.all([
        clickup.getFolders(spaceId),
        clickup.getListsInSpace(spaceId),
      ])

      return NextResponse.json({
        folders: foldersResult.folders,
        lists: listsResult.lists,
      })
    }

    // Otherwise, get all workspaces and their spaces
    const { teams } = await clickup.getTeams()

    // Get spaces for each team
    const teamsWithSpaces = await Promise.all(
      teams.map(async (team) => {
        const { spaces } = await clickup.getSpaces(team.id)
        return {
          ...team,
          spaces,
        }
      })
    )

    return NextResponse.json({ teams: teamsWithSpaces })
  } catch (error) {
    console.error('ClickUp lists fetch error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Fout bij ophalen van ClickUp data'
    }, { status: 500 })
  }
}
