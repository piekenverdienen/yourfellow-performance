'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Layers,
  FolderOpen,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointerClick,
  RefreshCw,
  ChevronRight,
  BarChart3,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSelectedClient } from '@/stores/client-store'
import type { TopicCluster, ContentGroup } from '@/types/search-console'

type ViewMode = 'clusters' | 'groups'

export default function ClustersPage() {
  const selectedClient = useSelectedClient()
  const clientId = selectedClient?.id

  const [viewMode, setViewMode] = useState<ViewMode>('clusters')
  const [clusters, setClusters] = useState<TopicCluster[]>([])
  const [groups, setGroups] = useState<ContentGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRematching, setIsRematching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch data
  useEffect(() => {
    if (!clientId) return

    async function fetchData() {
      setIsLoading(true)
      setError(null)

      try {
        const [clustersRes, groupsRes] = await Promise.all([
          fetch(`/api/search-console/topic-clusters?clientId=${clientId}`),
          fetch(`/api/search-console/content-groups?clientId=${clientId}`),
        ])

        const clustersData = await clustersRes.json()
        const groupsData = await groupsRes.json()

        if (clustersRes.ok) setClusters(clustersData.clusters || [])
        if (groupsRes.ok) setGroups(groupsData.groups || [])
      } catch (err) {
        setError('Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [clientId])

  // Re-match queries and pages
  const handleRematch = async () => {
    if (!clientId) return

    setIsRematching(true)
    try {
      const response = await fetch('/api/search-console/rematch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })

      if (response.ok) {
        // Refresh data
        const [clustersRes, groupsRes] = await Promise.all([
          fetch(`/api/search-console/topic-clusters?clientId=${clientId}`),
          fetch(`/api/search-console/content-groups?clientId=${clientId}`),
        ])

        const clustersData = await clustersRes.json()
        const groupsData = await groupsRes.json()

        if (clustersRes.ok) setClusters(clustersData.clusters || [])
        if (groupsRes.ok) setGroups(groupsData.groups || [])
      }
    } catch (err) {
      setError('Failed to rematch')
    } finally {
      setIsRematching(false)
    }
  }

  if (!selectedClient) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <AlertCircle className="h-12 w-12 text-surface-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-900 mb-2">Geen client geselecteerd</h3>
            <p className="text-surface-600">Selecteer eerst een client om data te bekijken.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-surface-900">Topical Authority</h1>
            <Badge variant="secondary">{selectedClient.name}</Badge>
          </div>
          <p className="text-surface-600">
            Analyseer je topical authority per cluster en content group.
          </p>
        </div>

        <Button
          onClick={handleRematch}
          isLoading={isRematching}
          leftIcon={<RefreshCw className="h-4 w-4" />}
          variant="outline"
        >
          Re-match Data
        </Button>
      </div>

      {/* View Toggle */}
      <div className="flex gap-1 p-1 bg-surface-100 rounded-lg w-fit">
        <button
          onClick={() => setViewMode('clusters')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
            viewMode === 'clusters'
              ? 'bg-white text-surface-900 shadow-sm'
              : 'text-surface-600 hover:text-surface-900'
          )}
        >
          <Layers className="h-4 w-4" />
          Topic Clusters ({clusters.length})
        </button>
        <button
          onClick={() => setViewMode('groups')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
            viewMode === 'groups'
              ? 'bg-white text-surface-900 shadow-sm'
              : 'text-surface-600 hover:text-surface-900'
          )}
        >
          <FolderOpen className="h-4 w-4" />
          Content Groups ({groups.length})
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="h-8 w-8 text-surface-400 mx-auto animate-spin" />
          <p className="text-surface-500 mt-2">Data laden...</p>
        </div>
      ) : viewMode === 'clusters' ? (
        <ClustersView clusters={clusters} />
      ) : (
        <GroupsView groups={groups} />
      )}
    </div>
  )
}

// Clusters View Component
function ClustersView({ clusters }: { clusters: TopicCluster[] }) {
  if (clusters.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Layers className="h-12 w-12 text-surface-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-surface-900 mb-2">Geen Topic Clusters</h3>
          <p className="text-surface-600 mb-4">
            Maak eerst topic clusters aan in SEO Instellingen.
          </p>
          <Button href="/seo/settings" variant="outline">
            Naar Instellingen
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Sort by impressions
  const sortedClusters = [...clusters].sort((a, b) => b.totalImpressions - a.totalImpressions)
  const totalImpressions = clusters.reduce((sum, c) => sum + c.totalImpressions, 0)
  const totalClicks = clusters.reduce((sum, c) => sum + c.totalClicks, 0)
  const totalQueries = clusters.reduce((sum, c) => sum + c.queryCount, 0)

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Layers className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-surface-500">Totaal Queries</p>
                <p className="text-2xl font-bold text-surface-900">{totalQueries.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Eye className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-surface-500">Totaal Impressies</p>
                <p className="text-2xl font-bold text-surface-900">{formatNumber(totalImpressions)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <MousePointerClick className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-surface-500">Totaal Clicks</p>
                <p className="text-2xl font-bold text-surface-900">{formatNumber(totalClicks)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clusters List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Topic Clusters Performance</CardTitle>
          <CardDescription>
            Gesorteerd op impressies. Klik op een cluster voor meer details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedClusters.map((cluster, index) => {
              const impressionShare = totalImpressions > 0
                ? (cluster.totalImpressions / totalImpressions) * 100
                : 0
              const avgCtr = cluster.totalImpressions > 0
                ? (cluster.totalClicks / cluster.totalImpressions) * 100
                : 0

              return (
                <div
                  key={cluster.id}
                  className="p-4 border border-surface-200 rounded-lg hover:border-surface-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-surface-400 w-6">
                          #{index + 1}
                        </span>
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: cluster.color }}
                        />
                      </div>
                      <div>
                        <h4 className="font-semibold text-surface-900">{cluster.name}</h4>
                        <p className="text-sm text-surface-500">
                          {cluster.queryCount} queries • Keywords: {cluster.matchKeywords.slice(0, 3).join(', ')}
                          {cluster.matchKeywords.length > 3 && ` +${cluster.matchKeywords.length - 3}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-sm text-surface-500">Impressies</p>
                        <p className="font-semibold text-surface-900">
                          {formatNumber(cluster.totalImpressions)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-surface-500">Clicks</p>
                        <p className="font-semibold text-surface-900">
                          {formatNumber(cluster.totalClicks)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-surface-500">CTR</p>
                        <p className="font-semibold text-surface-900">
                          {avgCtr.toFixed(1)}%
                        </p>
                      </div>
                      <div className="w-24">
                        <p className="text-xs text-surface-500 mb-1">Share</p>
                        <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${impressionShare}%`,
                              backgroundColor: cluster.color,
                            }}
                          />
                        </div>
                        <p className="text-xs text-surface-500 mt-0.5">{impressionShare.toFixed(1)}%</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-surface-400" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Groups View Component
function GroupsView({ groups }: { groups: ContentGroup[] }) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <FolderOpen className="h-12 w-12 text-surface-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-surface-900 mb-2">Geen Content Groups</h3>
          <p className="text-surface-600 mb-4">
            Maak eerst content groups aan in SEO Instellingen.
          </p>
          <Button href="/seo/settings" variant="outline">
            Naar Instellingen
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Sort by impressions
  const sortedGroups = [...groups].sort((a, b) => b.totalImpressions - a.totalImpressions)
  const totalImpressions = groups.reduce((sum, g) => sum + g.totalImpressions, 0)
  const totalClicks = groups.reduce((sum, g) => sum + g.totalClicks, 0)
  const totalPages = groups.reduce((sum, g) => sum + g.pageCount, 0)

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <FolderOpen className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-surface-500">Totaal Pagina's</p>
                <p className="text-2xl font-bold text-surface-900">{totalPages.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Eye className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-surface-500">Totaal Impressies</p>
                <p className="text-2xl font-bold text-surface-900">{formatNumber(totalImpressions)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <MousePointerClick className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-surface-500">Totaal Clicks</p>
                <p className="text-2xl font-bold text-surface-900">{formatNumber(totalClicks)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Content Groups Performance</CardTitle>
          <CardDescription>
            Gesorteerd op impressies. Klik op een group voor meer details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedGroups.map((group, index) => {
              const impressionShare = totalImpressions > 0
                ? (group.totalImpressions / totalImpressions) * 100
                : 0
              const avgCtr = group.totalImpressions > 0
                ? (group.totalClicks / group.totalImpressions) * 100
                : 0

              return (
                <div
                  key={group.id}
                  className="p-4 border border-surface-200 rounded-lg hover:border-surface-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-surface-400 w-6">
                          #{index + 1}
                        </span>
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
                      </div>
                      <div>
                        <h4 className="font-semibold text-surface-900">{group.name}</h4>
                        <p className="text-sm text-surface-500">
                          {group.pageCount} pagina's • Patterns: {group.urlPatterns.slice(0, 2).join(', ')}
                          {group.urlPatterns.length > 2 && ` +${group.urlPatterns.length - 2}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-sm text-surface-500">Impressies</p>
                        <p className="font-semibold text-surface-900">
                          {formatNumber(group.totalImpressions)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-surface-500">Clicks</p>
                        <p className="font-semibold text-surface-900">
                          {formatNumber(group.totalClicks)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-surface-500">CTR</p>
                        <p className="font-semibold text-surface-900">
                          {avgCtr.toFixed(1)}%
                        </p>
                      </div>
                      <div className="w-24">
                        <p className="text-xs text-surface-500 mb-1">Share</p>
                        <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${impressionShare}%`,
                              backgroundColor: group.color,
                            }}
                          />
                        </div>
                        <p className="text-xs text-surface-500 mt-0.5">{impressionShare.toFixed(1)}%</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-surface-400" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Utility
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}
