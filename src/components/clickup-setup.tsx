'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Link2, Unlink, ChevronRight, ExternalLink } from 'lucide-react'

interface Space {
  id: string
  name: string
}

interface Folder {
  id: string
  name: string
  lists: List[]
}

interface List {
  id: string
  name: string
}

interface Team {
  id: string
  name: string
  spaces: Space[]
}

interface ClickUpSetupProps {
  clientId: string
  currentListId?: string
  onSave: (listId: string | null) => Promise<void>
  disabled?: boolean
}

export function ClickUpSetup({ clientId, currentListId, onSave, disabled }: ClickUpSetupProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data states
  const [teams, setTeams] = useState<Team[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [lists, setLists] = useState<List[]>([])

  // Selection states
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [selectedSpace, setSelectedSpace] = useState<string>('')
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [selectedList, setSelectedList] = useState<string>(currentListId || '')

  const [isConfigured, setIsConfigured] = useState(!!currentListId)
  const [showConfig, setShowConfig] = useState(!currentListId)

  // Fetch teams on mount
  useEffect(() => {
    if (showConfig && teams.length === 0) {
      fetchTeams()
    }
  }, [showConfig])

  // Fetch folders/lists when space changes
  useEffect(() => {
    if (selectedSpace) {
      fetchSpaceContents(selectedSpace)
    }
  }, [selectedSpace])

  // Fetch lists when folder changes
  useEffect(() => {
    if (selectedFolder) {
      fetchFolderLists(selectedFolder)
    }
  }, [selectedFolder])

  const fetchTeams = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/clickup/lists')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error)
      }

      setTeams(data.teams || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij ophalen van ClickUp data')
    } finally {
      setLoading(false)
    }
  }

  const fetchSpaceContents = async (spaceId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/clickup/lists?spaceId=${spaceId}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error)
      }

      setFolders(data.folders || [])
      setLists(data.lists || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij ophalen van folders')
    } finally {
      setLoading(false)
    }
  }

  const fetchFolderLists = async (folderId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/clickup/lists?folderId=${folderId}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error)
      }

      setLists(data.lists || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij ophalen van lists')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!selectedList) return

    setSaving(true)
    try {
      await onSave(selectedList)
      setIsConfigured(true)
      setShowConfig(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij opslaan')
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Weet je zeker dat je de ClickUp koppeling wilt verwijderen?')) return

    setSaving(true)
    try {
      await onSave(null)
      setIsConfigured(false)
      setSelectedList('')
      setSelectedFolder('')
      setSelectedSpace('')
      setSelectedTeam('')
      setShowConfig(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij ontkoppelen')
    } finally {
      setSaving(false)
    }
  }

  const selectedSpaceData = teams
    .flatMap(t => t.spaces)
    .find(s => s.id === selectedSpace)

  const selectedTeamData = teams.find(t => t.id === selectedTeam)

  if (isConfigured && !showConfig) {
    return (
      <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Link2 className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-green-900">ClickUp gekoppeld</p>
            <p className="text-sm text-green-700">List ID: {currentListId}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig(true)}
            disabled={disabled}
          >
            Wijzigen
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={disabled || saving}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading && teams.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-surface-600">ClickUp laden...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Workspace Selection */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Workspace
            </label>
            <Select
              value={selectedTeam}
              onChange={(e) => {
                setSelectedTeam(e.target.value)
                setSelectedSpace('')
                setSelectedFolder('')
                setSelectedList('')
                setFolders([])
                setLists([])
              }}
              options={[
                { value: '', label: 'Selecteer workspace...' },
                ...teams.map(t => ({ value: t.id, label: t.name }))
              ]}
              disabled={disabled || loading}
            />
          </div>

          {/* Space Selection */}
          {selectedTeam && (
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Space
              </label>
              <Select
                value={selectedSpace}
                onChange={(e) => {
                  setSelectedSpace(e.target.value)
                  setSelectedFolder('')
                  setSelectedList('')
                }}
                options={[
                  { value: '', label: 'Selecteer space...' },
                  ...(selectedTeamData?.spaces || []).map(s => ({ value: s.id, label: s.name }))
                ]}
                disabled={disabled || loading}
              />
            </div>
          )}

          {/* Folder Selection (optional) */}
          {selectedSpace && folders.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Folder <span className="text-surface-400">(optioneel)</span>
              </label>
              <Select
                value={selectedFolder}
                onChange={(e) => {
                  setSelectedFolder(e.target.value)
                  setSelectedList('')
                }}
                options={[
                  { value: '', label: 'Geen folder (root lists)' },
                  ...folders.map(f => ({ value: f.id, label: f.name }))
                ]}
                disabled={disabled || loading}
              />
            </div>
          )}

          {/* List Selection */}
          {selectedSpace && (lists.length > 0 || !selectedFolder) && (
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                List
              </label>
              {loading ? (
                <div className="flex items-center gap-2 text-surface-500 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Lists laden...</span>
                </div>
              ) : lists.length > 0 ? (
                <Select
                  value={selectedList}
                  onChange={(e) => setSelectedList(e.target.value)}
                  options={[
                    { value: '', label: 'Selecteer list...' },
                    ...lists.map(l => ({ value: l.id, label: l.name }))
                  ]}
                  disabled={disabled || loading}
                />
              ) : selectedFolder === '' && folders.length > 0 ? (
                <p className="text-sm text-surface-500 py-2">
                  Selecteer een folder of er zijn geen root lists
                </p>
              ) : (
                <p className="text-sm text-surface-500 py-2">
                  Geen lists gevonden
                </p>
              )}
            </div>
          )}

          {/* Manual List ID input as fallback */}
          <div className="pt-2 border-t border-surface-100">
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Of voer direct een List ID in
            </label>
            <div className="flex gap-2">
              <Input
                value={selectedList}
                onChange={(e) => setSelectedList(e.target.value)}
                placeholder="Bijv. 901234567890"
                disabled={disabled}
              />
            </div>
            <p className="text-xs text-surface-500 mt-1">
              Je vindt de List ID in de URL van je ClickUp list
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            {isConfigured && (
              <Button
                variant="outline"
                onClick={() => setShowConfig(false)}
                disabled={saving}
              >
                Annuleren
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={!selectedList || saving || disabled}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Opslaan...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Koppelen
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
