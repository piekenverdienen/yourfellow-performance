'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Settings,
  Tag,
  Layers,
  FolderOpen,
  Plus,
  X,
  Trash2,
  Edit2,
  Save,
  AlertCircle,
  HelpCircle,
  Loader2,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSelectedClient } from '@/stores/client-store'
import type {
  BrandedKeyword,
  TopicCluster,
  ContentGroup,
} from '@/types/search-console'

type Tab = 'branded' | 'clusters' | 'groups'

const PRESET_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
]

export default function SEOSettingsPage() {
  const selectedClient = useSelectedClient()
  const clientId = selectedClient?.id

  const [activeTab, setActiveTab] = useState<Tab>('branded')

  if (!selectedClient) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <AlertCircle className="h-12 w-12 text-surface-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-900 mb-2">Geen client geselecteerd</h3>
            <p className="text-surface-600">Selecteer eerst een client om instellingen te beheren.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">SEO Instellingen</h1>
          <Badge variant="secondary">{selectedClient.name}</Badge>
        </div>
        <p className="text-surface-600">
          Configureer branded keywords, topic clusters en content groups.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-100 rounded-lg mb-6">
        <TabButton
          active={activeTab === 'branded'}
          onClick={() => setActiveTab('branded')}
          icon={Tag}
        >
          Branded Keywords
        </TabButton>
        <TabButton
          active={activeTab === 'clusters'}
          onClick={() => setActiveTab('clusters')}
          icon={Layers}
        >
          Topic Clusters
        </TabButton>
        <TabButton
          active={activeTab === 'groups'}
          onClick={() => setActiveTab('groups')}
          icon={FolderOpen}
        >
          Content Groups
        </TabButton>
      </div>

      {/* Tab Content */}
      {activeTab === 'branded' && <BrandedKeywordsTab clientId={clientId!} />}
      {activeTab === 'clusters' && <TopicClustersTab clientId={clientId!} />}
      {activeTab === 'groups' && <ContentGroupsTab clientId={clientId!} />}
    </div>
  )
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Tag
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
        active
          ? 'bg-white text-surface-900 shadow-sm'
          : 'text-surface-600 hover:text-surface-900'
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  )
}

// =============================================
// Branded Keywords Tab
// =============================================
function BrandedKeywordsTab({ clientId }: { clientId: string }) {
  const [keywords, setKeywords] = useState<BrandedKeyword[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newKeyword, setNewKeyword] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch keywords
  useEffect(() => {
    async function fetchKeywords() {
      try {
        const response = await fetch(`/api/search-console/branded-keywords?clientId=${clientId}`)
        const data = await response.json()
        if (response.ok) {
          setKeywords(data.keywords)
        }
      } catch (err) {
        setError('Failed to load keywords')
      } finally {
        setIsLoading(false)
      }
    }
    fetchKeywords()
  }, [clientId])

  // Add keyword
  const handleAdd = async () => {
    if (!newKeyword.trim()) return

    setIsAdding(true)
    try {
      const response = await fetch('/api/search-console/branded-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, keyword: newKeyword.trim() }),
      })

      const data = await response.json()
      if (response.ok) {
        setKeywords([...keywords, data.keyword])
        setNewKeyword('')
        setError(null)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to add keyword')
    } finally {
      setIsAdding(false)
    }
  }

  // Delete keyword
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/search-console/branded-keywords?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setKeywords(keywords.filter(k => k.id !== id))
      }
    } catch (err) {
      setError('Failed to delete keyword')
    }
  }

  // Remove all
  const handleRemoveAll = async () => {
    if (!confirm('Weet je zeker dat je alle branded keywords wilt verwijderen?')) return

    for (const keyword of keywords) {
      await handleDelete(keyword.id)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Branded Keywords
            </CardTitle>
            <CardDescription className="mt-1">
              Configureer branded keywords om je merk-performance te monitoren.
              We gebruiken Broad Match / Contains voor deze keywords.
            </CardDescription>
          </div>
          <button className="text-surface-400 hover:text-surface-600">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Box */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          Als je &quot;bracefox&quot; toevoegt, matcht dit met queries zoals &quot;bracefox zooltjes&quot; of &quot;bracefox review&quot;.
        </div>

        {/* Existing Keywords */}
        {isLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-6 w-6 text-surface-400 mx-auto animate-spin" />
          </div>
        ) : keywords.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {keywords.map(keyword => (
              <div
                key={keyword.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-100 rounded-full text-sm"
              >
                <span className="font-medium">{keyword.keyword}</span>
                <button
                  onClick={() => handleDelete(keyword.id)}
                  className="text-surface-400 hover:text-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {keywords.length > 1 && (
              <button
                onClick={handleRemoveAll}
                className="text-sm text-red-500 hover:text-red-700 underline"
              >
                Remove All
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-surface-500">Nog geen branded keywords toegevoegd.</p>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Add Form */}
        <div className="flex gap-2">
          <Input
            placeholder="Voer een keyword in..."
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button
            onClick={handleAdd}
            isLoading={isAdding}
            disabled={!newKeyword.trim()}
          >
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// =============================================
// Topic Clusters Tab
// =============================================
function TopicClustersTab({ clientId }: { clientId: string }) {
  const [clusters, setClusters] = useState<TopicCluster[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingCluster, setEditingCluster] = useState<TopicCluster | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch clusters
  useEffect(() => {
    async function fetchClusters() {
      try {
        const response = await fetch(`/api/search-console/topic-clusters?clientId=${clientId}`)
        const data = await response.json()
        if (response.ok) {
          setClusters(data.clusters)
        }
      } catch (err) {
        setError('Failed to load clusters')
      } finally {
        setIsLoading(false)
      }
    }
    fetchClusters()
  }, [clientId])

  // Delete cluster
  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze cluster wilt verwijderen?')) return

    try {
      const response = await fetch(`/api/search-console/topic-clusters/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setClusters(clusters.filter(c => c.id !== id))
      }
    } catch (err) {
      setError('Failed to delete cluster')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Topic Clusters
            </CardTitle>
            <CardDescription className="mt-1">
              Groepeer gerelateerde queries om performance efficiënter te analyseren.
            </CardDescription>
          </div>
          <button className="text-surface-400 hover:text-surface-600">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-6 w-6 text-surface-400 mx-auto animate-spin" />
          </div>
        ) : (
          <>
            {/* Existing Clusters */}
            {clusters.length > 0 ? (
              <div className="space-y-3">
                {clusters.map(cluster => (
                  <div
                    key={cluster.id}
                    className="p-4 border border-surface-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-4 h-4 rounded-full mt-1"
                          style={{ backgroundColor: cluster.color }}
                        />
                        <div>
                          <h4 className="font-medium text-surface-900">{cluster.name}</h4>
                          <p className="text-sm text-surface-500 mt-0.5">
                            Keywords: {cluster.matchKeywords.join(', ')}
                          </p>
                          <div className="flex gap-4 mt-2 text-xs text-surface-500">
                            <span>{cluster.queryCount} queries</span>
                            <span>{formatNumber(cluster.totalImpressions)} impressies</span>
                            <span>{formatNumber(cluster.totalClicks)} clicks</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingCluster(cluster)}
                          className="p-1.5 text-surface-400 hover:text-surface-600 rounded"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cluster.id)}
                          className="p-1.5 text-surface-400 hover:text-red-500 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Layers className="h-8 w-8 text-surface-300 mx-auto mb-2" />
                <p className="text-surface-500">Nog geen topic clusters aangemaakt.</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Create Button / Form */}
            {isCreating || editingCluster ? (
              <ClusterForm
                cluster={editingCluster}
                clientId={clientId}
                onSave={(saved) => {
                  if (editingCluster) {
                    setClusters(clusters.map(c => c.id === saved.id ? saved : c))
                  } else {
                    setClusters([...clusters, saved])
                  }
                  setIsCreating(false)
                  setEditingCluster(null)
                }}
                onCancel={() => {
                  setIsCreating(false)
                  setEditingCluster(null)
                }}
              />
            ) : (
              <Button
                variant="outline"
                onClick={() => setIsCreating(true)}
                leftIcon={<Plus className="h-4 w-4" />}
                className="w-full"
              >
                Create Topic Cluster
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Cluster Form Component
function ClusterForm({
  cluster,
  clientId,
  onSave,
  onCancel,
}: {
  cluster: TopicCluster | null
  clientId: string
  onSave: (cluster: TopicCluster) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(cluster?.name || '')
  const [keywords, setKeywords] = useState(cluster?.matchKeywords.join(', ') || '')
  const [color, setColor] = useState(cluster?.color || PRESET_COLORS[0])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim() || !keywords.trim()) return

    setIsSaving(true)
    setError(null)

    try {
      const matchKeywords = keywords.split(',').map(k => k.trim()).filter(k => k)

      const url = cluster
        ? `/api/search-console/topic-clusters/${cluster.id}`
        : '/api/search-console/topic-clusters'

      const response = await fetch(url, {
        method: cluster ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          name: name.trim(),
          matchKeywords,
          color,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        onSave(data.cluster)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to save cluster')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-4 border border-primary/30 bg-primary/5 rounded-lg space-y-4">
      <div>
        <label className="label">Naam</label>
        <Input
          placeholder="bijv. Hielspoor"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Keywords (komma-gescheiden)</label>
        <Input
          placeholder="bijv. hielspoor, heel spur, fasciitis"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        <p className="text-xs text-surface-500 mt-1">
          Queries die deze keywords bevatten worden automatisch gegroepeerd.
        </p>
      </div>
      <div>
        <label className="label">Kleur</label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                'w-8 h-8 rounded-full transition-transform',
                color === c && 'ring-2 ring-offset-2 ring-surface-400 scale-110'
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>
          Annuleren
        </Button>
        <Button
          onClick={handleSave}
          isLoading={isSaving}
          disabled={!name.trim() || !keywords.trim()}
          leftIcon={<Save className="h-4 w-4" />}
        >
          {cluster ? 'Opslaan' : 'Aanmaken'}
        </Button>
      </div>
    </div>
  )
}

// =============================================
// Content Groups Tab
// =============================================
function ContentGroupsTab({ clientId }: { clientId: string }) {
  const [groups, setGroups] = useState<ContentGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingGroup, setEditingGroup] = useState<ContentGroup | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch groups
  useEffect(() => {
    async function fetchGroups() {
      try {
        const response = await fetch(`/api/search-console/content-groups?clientId=${clientId}`)
        const data = await response.json()
        if (response.ok) {
          setGroups(data.groups)
        }
      } catch (err) {
        setError('Failed to load groups')
      } finally {
        setIsLoading(false)
      }
    }
    fetchGroups()
  }, [clientId])

  // Delete group
  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze group wilt verwijderen?')) return

    try {
      const response = await fetch(`/api/search-console/content-groups/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setGroups(groups.filter(g => g.id !== id))
      }
    } catch (err) {
      setError('Failed to delete group')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Content Groups
            </CardTitle>
            <CardDescription className="mt-1">
              Groepeer gerelateerde pagina&apos;s om performance van meerdere pagina&apos;s efficiënter te analyseren.
            </CardDescription>
          </div>
          <button className="text-surface-400 hover:text-surface-600">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Box */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          Veelgebruikte groepen: Blog posts, Landing pages, pSEO pages.
          Gebruik URL patterns zoals <code className="bg-blue-100 px-1 rounded">/blog/*</code> of <code className="bg-blue-100 px-1 rounded">/locatie/*</code>
        </div>

        {isLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-6 w-6 text-surface-400 mx-auto animate-spin" />
          </div>
        ) : (
          <>
            {/* Existing Groups */}
            {groups.length > 0 ? (
              <div className="space-y-3">
                {groups.map(group => (
                  <div
                    key={group.id}
                    className="p-4 border border-surface-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-4 h-4 rounded-full mt-1"
                          style={{ backgroundColor: group.color }}
                        />
                        <div>
                          <h4 className="font-medium text-surface-900">{group.name}</h4>
                          <p className="text-sm text-surface-500 mt-0.5">
                            Patterns: {group.urlPatterns.join(', ') || group.urlRegex || '-'}
                          </p>
                          <div className="flex gap-4 mt-2 text-xs text-surface-500">
                            <span>{group.pageCount} pagina&apos;s</span>
                            <span>{formatNumber(group.totalImpressions)} impressies</span>
                            <span>{formatNumber(group.totalClicks)} clicks</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingGroup(group)}
                          className="p-1.5 text-surface-400 hover:text-surface-600 rounded"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(group.id)}
                          className="p-1.5 text-surface-400 hover:text-red-500 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <FolderOpen className="h-8 w-8 text-surface-300 mx-auto mb-2" />
                <p className="text-surface-500">Nog geen content groups aangemaakt.</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Create Button / Form */}
            {isCreating || editingGroup ? (
              <GroupForm
                group={editingGroup}
                clientId={clientId}
                onSave={(saved) => {
                  if (editingGroup) {
                    setGroups(groups.map(g => g.id === saved.id ? saved : g))
                  } else {
                    setGroups([...groups, saved])
                  }
                  setIsCreating(false)
                  setEditingGroup(null)
                }}
                onCancel={() => {
                  setIsCreating(false)
                  setEditingGroup(null)
                }}
              />
            ) : (
              <Button
                variant="outline"
                onClick={() => setIsCreating(true)}
                leftIcon={<Plus className="h-4 w-4" />}
                className="w-full"
              >
                Create Content Group
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Group Form Component
function GroupForm({
  group,
  clientId,
  onSave,
  onCancel,
}: {
  group: ContentGroup | null
  clientId: string
  onSave: (group: ContentGroup) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(group?.name || '')
  const [patterns, setPatterns] = useState(group?.urlPatterns.join(', ') || '')
  const [color, setColor] = useState(group?.color || PRESET_COLORS[4])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim() || !patterns.trim()) return

    setIsSaving(true)
    setError(null)

    try {
      const urlPatterns = patterns.split(',').map(p => p.trim()).filter(p => p)

      const url = group
        ? `/api/search-console/content-groups/${group.id}`
        : '/api/search-console/content-groups'

      const response = await fetch(url, {
        method: group ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          name: name.trim(),
          urlPatterns,
          color,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        onSave(data.group)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to save group')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-4 border border-primary/30 bg-primary/5 rounded-lg space-y-4">
      <div>
        <label className="label">Naam</label>
        <Input
          placeholder="bijv. Blog Posts"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="label">URL Patterns (komma-gescheiden)</label>
        <Input
          placeholder="bijv. /blog/*, /artikel/*"
          value={patterns}
          onChange={(e) => setPatterns(e.target.value)}
        />
        <p className="text-xs text-surface-500 mt-1">
          Gebruik * als wildcard. Pagina&apos;s die matchen worden automatisch gegroepeerd.
        </p>
      </div>
      <div>
        <label className="label">Kleur</label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                'w-8 h-8 rounded-full transition-transform',
                color === c && 'ring-2 ring-offset-2 ring-surface-400 scale-110'
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>
          Annuleren
        </Button>
        <Button
          onClick={handleSave}
          isLoading={isSaving}
          disabled={!name.trim() || !patterns.trim()}
          leftIcon={<Save className="h-4 w-4" />}
        >
          {group ? 'Opslaan' : 'Aanmaken'}
        </Button>
      </div>
    </div>
  )
}

// Utility
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}
