'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Layers,
  FolderOpen,
  Eye,
  MousePointerClick,
  RefreshCw,
  ChevronRight,
  BarChart3,
  AlertCircle,
  Loader2,
  Sparkles,
  X,
  Target,
  AlertTriangle,
  Link2,
  ListChecks,
  TrendingUp,
  FileText,
  Zap,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSelectedClient } from '@/stores/client-store'
import { usePersistedState, useOnClientChange } from '@/hooks/use-persisted-form'
import type { TopicCluster, ContentGroup } from '@/types/search-console'
import type { TopicalClusterReport } from '@/seo/topical'

type ViewMode = 'clusters' | 'groups'

// Type for cached analyses
interface CachedAnalyses {
  [clusterId: string]: {
    report: TopicalClusterReport
    cachedAt: string
  }
}

export default function ClustersPage() {
  const selectedClient = useSelectedClient()
  const clientId = selectedClient?.id

  const [viewMode, setViewMode] = useState<ViewMode>('clusters')
  const [clusters, setClusters] = useState<TopicCluster[]>([])
  const [groups, setGroups] = useState<ContentGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRematching, setIsRematching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cached analyses in localStorage
  const [cachedAnalyses, setCachedAnalyses] = usePersistedState<CachedAnalyses>(
    `cluster-analyses-${clientId || 'default'}`,
    {}
  )

  // Analysis state
  const [selectedCluster, setSelectedCluster] = useState<TopicCluster | null>(null)
  const [analysisReport, setAnalysisReport] = useState<TopicalClusterReport | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  // Reset state when client changes
  useOnClientChange(useCallback(() => {
    setSelectedCluster(null)
    setAnalysisReport(null)
    setAnalysisError(null)
  }, []))

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

  // Open cluster analysis (load from cache or run new)
  const handleAnalyzeCluster = async (cluster: TopicCluster, forceRefresh = false) => {
    if (!clientId) return

    setSelectedCluster(cluster)
    setAnalysisError(null)

    // Check for cached analysis
    const cached = cachedAnalyses[cluster.id]
    if (cached && !forceRefresh) {
      setAnalysisReport(cached.report)
      setIsAnalyzing(false)
      return
    }

    // Run new analysis
    setAnalysisReport(null)
    setIsAnalyzing(true)

    try {
      const response = await fetch('/api/seo/clusters/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clusterId: cluster.id }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setAnalysisReport(data.data)
        // Save to cache
        setCachedAnalyses((prev) => ({
          ...prev,
          [cluster.id]: {
            report: data.data,
            cachedAt: new Date().toISOString(),
          },
        }))
      } else {
        setAnalysisError(data.error || 'Analyse mislukt')
      }
    } catch (err) {
      setAnalysisError('Fout bij het analyseren van het cluster')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Refresh analysis (ignore cache)
  const handleRefreshAnalysis = () => {
    if (selectedCluster) {
      handleAnalyzeCluster(selectedCluster, true)
    }
  }

  // Get cache info for a cluster
  const getCacheInfo = (clusterId: string) => {
    const cached = cachedAnalyses[clusterId]
    if (!cached) return null
    return {
      cachedAt: new Date(cached.cachedAt),
      hasCache: true,
    }
  }

  // Close analysis modal
  const closeAnalysis = () => {
    setSelectedCluster(null)
    setAnalysisReport(null)
    setAnalysisError(null)
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
        <ClustersView clusters={clusters} onAnalyze={handleAnalyzeCluster} getCacheInfo={getCacheInfo} />
      ) : (
        <GroupsView groups={groups} />
      )}

      {/* Analysis Modal */}
      {selectedCluster && (
        <ClusterAnalysisModal
          cluster={selectedCluster}
          report={analysisReport}
          isLoading={isAnalyzing}
          error={analysisError}
          onClose={closeAnalysis}
          onRefresh={handleRefreshAnalysis}
          cacheInfo={getCacheInfo(selectedCluster.id)}
        />
      )}
    </div>
  )
}

// Clusters View Component
function ClustersView({
  clusters,
  onAnalyze,
  getCacheInfo,
}: {
  clusters: TopicCluster[]
  onAnalyze: (cluster: TopicCluster) => void
  getCacheInfo: (clusterId: string) => { cachedAt: Date; hasCache: boolean } | null
}) {
  if (clusters.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Layers className="h-12 w-12 text-surface-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-surface-900 mb-2">Geen Topic Clusters</h3>
          <p className="text-surface-600 mb-4">
            Maak eerst topic clusters aan in SEO Instellingen.
          </p>
          <Link href="/seo/settings">
            <Button variant="outline">
              Naar Instellingen
            </Button>
          </Link>
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
            Klik op "Analyseer" voor een diepgaande AI-analyse van het cluster.
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
              const cacheInfo = getCacheInfo(cluster.id)

              return (
                <div
                  key={cluster.id}
                  className="p-4 border border-surface-200 rounded-lg hover:border-surface-300 transition-colors"
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

                    <div className="flex items-center gap-6">
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
                      <div className="w-20">
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
                      <Button
                        size="sm"
                        variant={cacheInfo ? 'primary' : 'outline'}
                        onClick={() => onAnalyze(cluster)}
                        leftIcon={cacheInfo ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                        disabled={cluster.queryCount < 5}
                      >
                        {cacheInfo ? 'Bekijk' : 'Analyseer'}
                      </Button>
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

// Analysis Modal Component
function ClusterAnalysisModal({
  cluster,
  report,
  isLoading,
  error,
  onClose,
  onRefresh,
  cacheInfo,
}: {
  cluster: TopicCluster
  report: TopicalClusterReport | null
  isLoading: boolean
  error: string | null
  onClose: () => void
  onRefresh: () => void
  cacheInfo: { cachedAt: Date; hasCache: boolean } | null
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'pillars' | 'gaps' | 'issues' | 'roadmap'>('overview')

  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'zojuist'
    if (diffMins < 60) return `${diffMins} min geleden`
    if (diffHours < 24) return `${diffHours} uur geleden`
    return `${diffDays} dagen geleden`
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative min-h-screen flex items-start justify-center p-4 pt-20">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-surface-200">
            <div className="flex items-center gap-4">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: cluster.color }}
              />
              <div>
                <h2 className="text-xl font-bold text-surface-900">
                  Cluster Analyse: {cluster.name}
                </h2>
                <p className="text-sm text-surface-500">
                  {cluster.queryCount} queries • {formatNumber(cluster.totalImpressions)} impressies
                  {cacheInfo && !isLoading && (
                    <span className="ml-2 text-surface-400">
                      • Gecached {formatRelativeTime(cacheInfo.cachedAt)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {report && !isLoading && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRefresh}
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                >
                  Vernieuw
                </Button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-surface-400 hover:text-surface-600 rounded-lg hover:bg-surface-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="py-20 text-center">
                <div className="inline-flex items-center gap-3 px-6 py-4 bg-violet-50 rounded-xl">
                  <Loader2 className="h-6 w-6 text-violet-600 animate-spin" />
                  <div className="text-left">
                    <p className="font-medium text-violet-900">AI-analyse wordt uitgevoerd...</p>
                    <p className="text-sm text-violet-600">Dit kan 10-20 seconden duren</p>
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="p-8">
                <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
                  <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-red-900 mb-1">Analyse mislukt</h3>
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            ) : report ? (
              <>
                {/* Tabs */}
                <div className="flex gap-1 p-2 bg-surface-50 border-b border-surface-200">
                  {[
                    { id: 'overview', label: 'Overzicht', icon: BarChart3 },
                    { id: 'pillars', label: 'Pillar Pages', icon: Target },
                    { id: 'gaps', label: 'Content Gaps', icon: FileText },
                    { id: 'issues', label: 'Issues', icon: AlertTriangle },
                    { id: 'roadmap', label: 'Roadmap', icon: ListChecks },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                        activeTab === tab.id
                          ? 'bg-white text-surface-900 shadow-sm'
                          : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {activeTab === 'overview' && <OverviewTab report={report} />}
                  {activeTab === 'pillars' && <PillarsTab report={report} />}
                  {activeTab === 'gaps' && <ContentGapsTab report={report} />}
                  {activeTab === 'issues' && <IssuesTab report={report} />}
                  {activeTab === 'roadmap' && <RoadmapTab report={report} />}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

// Overview Tab
function OverviewTab({ report }: { report: TopicalClusterReport }) {
  const maturityColors = {
    emerging: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Emerging' },
    developing: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Developing' },
    established: { bg: 'bg-green-100', text: 'text-green-700', label: 'Established' },
    dominant: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Dominant' },
  }

  const maturityStyle = maturityColors[report.maturity.stage]

  return (
    <div className="space-y-6">
      {/* Maturity Score */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-surface-900">Maturity Score</h3>
              <Badge className={cn(maturityStyle.bg, maturityStyle.text)}>
                {maturityStyle.label}
              </Badge>
            </div>
            <div className="flex items-end gap-4">
              <span className="text-5xl font-bold text-surface-900">{report.maturity.score}</span>
              <span className="text-surface-500 mb-2">/ 100</span>
            </div>
            <div className="mt-4 h-3 bg-surface-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  report.maturity.score >= 75 ? 'bg-purple-500' :
                  report.maturity.score >= 50 ? 'bg-green-500' :
                  report.maturity.score >= 25 ? 'bg-blue-500' : 'bg-gray-400'
                )}
                style={{ width: `${report.maturity.score}%` }}
              />
            </div>
            <p className="mt-4 text-sm text-surface-600">{report.maturity.explanation}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold text-surface-900 mb-4">Cluster Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-surface-500">Queries</p>
                <p className="text-2xl font-bold text-surface-900">{report.metrics.totalQueries}</p>
              </div>
              <div>
                <p className="text-sm text-surface-500">URLs</p>
                <p className="text-2xl font-bold text-surface-900">{report.metrics.urlCount}</p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Top 10 Queries</p>
                <p className="text-2xl font-bold text-green-600">{report.metrics.top10Queries}</p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Gem. Positie</p>
                <p className="text-2xl font-bold text-surface-900">{report.metrics.avgPosition.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100">
                <Target className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-surface-500">Pillar Pages</p>
                <p className="text-lg font-bold text-surface-900">{report.pillars.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-surface-500">Content Gaps</p>
                <p className="text-lg font-bold text-surface-900">{report.contentGaps.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-surface-500">Cannibalisatie</p>
                <p className="text-lg font-bold text-surface-900">{report.cannibalization.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <ListChecks className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-surface-500">Acties</p>
                <p className="text-lg font-bold text-surface-900">{report.roadmap.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Pillars Tab
function PillarsTab({ report }: { report: TopicalClusterReport }) {
  if (report.pillars.length === 0) {
    return (
      <div className="py-12 text-center text-surface-500">
        <Target className="h-10 w-10 mx-auto mb-3 text-surface-300" />
        <p>Geen pillar pages geïdentificeerd</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-600 mb-4">
        Pillar pages zijn de hoofdpagina's die als autoriteit dienen voor dit topic cluster.
      </p>
      {report.pillars.map((pillar, index) => (
        <Card key={index}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={pillar.role === 'primary' ? 'default' : 'secondary'}>
                    {pillar.role === 'primary' ? 'Primary Pillar' : 'Secondary Pillar'}
                  </Badge>
                  <div className="flex gap-1">
                    {pillar.coveredIntents.map((intent) => (
                      <Badge key={intent} variant="outline" className="text-xs">
                        {intent}
                      </Badge>
                    ))}
                  </div>
                </div>
                <a
                  href={pillar.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium break-all"
                >
                  {pillar.url}
                </a>
                <p className="text-sm text-surface-600 mt-2">{pillar.reasoning}</p>
                {pillar.topQueries.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-surface-500 mb-1">Top queries:</p>
                    <div className="flex flex-wrap gap-1">
                      {pillar.topQueries.map((q, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {q}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {report.supportingPages.length > 0 && (
        <>
          <h3 className="font-semibold text-surface-900 mt-8 mb-4">Supporting Pages</h3>
          <div className="space-y-2">
            {report.supportingPages.map((page, index) => (
              <div key={index} className="p-3 border border-surface-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all"
                  >
                    {page.url}
                  </a>
                  <Badge variant="outline" className="text-xs">
                    {page.primaryIntent}
                  </Badge>
                </div>
                <p className="text-xs text-surface-500 mt-1">
                  Ondersteunt: {page.pillarUrl}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Content Gaps Tab
function ContentGapsTab({ report }: { report: TopicalClusterReport }) {
  if (report.contentGaps.length === 0) {
    return (
      <div className="py-12 text-center text-surface-500">
        <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
        <p>Geen content gaps gedetecteerd - goede dekking!</p>
      </div>
    )
  }

  const priorityColors = {
    high: 'border-l-red-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-gray-300',
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-600 mb-4">
        Content gaps zijn onderwerpen waarvoor je nog geen content hebt, maar waar wel vraag naar is.
      </p>
      {report.contentGaps.map((gap, index) => (
        <Card key={index} className={cn('border-l-4', priorityColors[gap.priority])}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant={gap.priority === 'high' ? 'error' : gap.priority === 'medium' ? 'warning' : 'secondary'}
                  >
                    {gap.priority}
                  </Badge>
                  <Badge variant="outline">{gap.intent}</Badge>
                </div>
                <h4 className="font-semibold text-surface-900">{gap.suggestedPageTitle}</h4>
                {gap.suggestedUrl && (
                  <p className="text-sm text-blue-600 mt-1">{gap.suggestedUrl}</p>
                )}
                <p className="text-sm text-surface-600 mt-2">{gap.reason}</p>
                <p className="text-sm text-green-600 mt-1">{gap.expectedImpact}</p>
                {gap.targetQueries.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-surface-500 mb-1">Target queries:</p>
                    <div className="flex flex-wrap gap-1">
                      {gap.targetQueries.map((q, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {q}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Issues Tab
function IssuesTab({ report }: { report: TopicalClusterReport }) {
  const hasCannibalization = report.cannibalization.length > 0
  const hasLinkingIssues = report.internalLinking.length > 0

  if (!hasCannibalization && !hasLinkingIssues) {
    return (
      <div className="py-12 text-center text-surface-500">
        <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
        <p>Geen issues gedetecteerd!</p>
      </div>
    )
  }

  const severityColors = {
    high: 'border-l-red-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-gray-300',
  }

  return (
    <div className="space-y-6">
      {/* Cannibalization */}
      {hasCannibalization && (
        <div>
          <h3 className="font-semibold text-surface-900 flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Keyword Cannibalisatie ({report.cannibalization.length})
          </h3>
          <div className="space-y-3">
            {report.cannibalization.map((issue, index) => (
              <Card key={index} className={cn('border-l-4', severityColors[issue.severity])}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-surface-900">"{issue.query}"</span>
                    <Badge variant={issue.severity === 'high' ? 'error' : 'secondary'}>
                      {issue.impressions.toLocaleString()} impressies
                    </Badge>
                  </div>
                  <div className="text-sm text-surface-600 mb-2">
                    <p className="font-medium">Concurrerende URLs:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {issue.competingUrls.map((url, i) => (
                        <li key={i} className="break-all">
                          {url} {issue.currentPositions[i] && <span className="text-surface-400">(pos: {issue.currentPositions[i].toFixed(1)})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-sm text-blue-600 mt-2">{issue.recommendation}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Internal Linking */}
      {hasLinkingIssues && (
        <div>
          <h3 className="font-semibold text-surface-900 flex items-center gap-2 mb-4">
            <Link2 className="h-5 w-5 text-blue-500" />
            Interne Linking Issues ({report.internalLinking.length})
          </h3>
          <div className="space-y-3">
            {report.internalLinking.map((issue, index) => {
              const issueLabels = {
                missing_pillar_links: 'Ontbrekende pillar links',
                orphan_page: 'Orphan pagina',
                weak_cluster_density: 'Zwakke cluster densiteit',
                no_supporting_links: 'Geen supporting links',
              }

              return (
                <Card key={index} className={cn('border-l-4', severityColors[issue.priority])}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{issueLabels[issue.issue]}</Badge>
                      <Badge variant={issue.priority === 'high' ? 'error' : 'secondary'}>
                        {issue.priority}
                      </Badge>
                    </div>
                    {issue.affectedUrls.length > 0 && (
                      <div className="text-sm text-surface-600 mb-2">
                        <p className="font-medium">Betrokken URLs:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          {issue.affectedUrls.slice(0, 5).map((url, i) => (
                            <li key={i} className="break-all">{url}</li>
                          ))}
                          {issue.affectedUrls.length > 5 && (
                            <li className="text-surface-400">+{issue.affectedUrls.length - 5} meer...</li>
                          )}
                        </ul>
                      </div>
                    )}
                    <p className="text-sm text-blue-600 mt-2">{issue.recommendation}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Roadmap Tab
function RoadmapTab({ report }: { report: TopicalClusterReport }) {
  if (report.roadmap.length === 0) {
    return (
      <div className="py-12 text-center text-surface-500">
        <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
        <p>Geen acties nodig - alles ziet er goed uit!</p>
      </div>
    )
  }

  const categoryIcons = {
    content_creation: FileText,
    content_optimization: Zap,
    internal_linking: Link2,
    consolidation: Layers,
  }

  const categoryLabels = {
    content_creation: 'Content Creatie',
    content_optimization: 'Content Optimalisatie',
    internal_linking: 'Interne Linking',
    consolidation: 'Consolidatie',
  }

  const effortLabels = {
    low: { label: '1-2 uur', color: 'text-green-600' },
    medium: { label: '3-5 uur', color: 'text-yellow-600' },
    high: { label: '5+ uur', color: 'text-red-600' },
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const sortedRoadmap = [...report.roadmap].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-600 mb-4">
        Actiegerichte roadmap gesorteerd op prioriteit. Begin met de high-priority items.
      </p>
      {sortedRoadmap.map((item, index) => {
        const Icon = categoryIcons[item.category]
        const effort = effortLabels[item.effort]

        return (
          <Card
            key={index}
            className={cn(
              'border-l-4',
              item.priority === 'high' ? 'border-l-red-500' :
              item.priority === 'medium' ? 'border-l-yellow-500' : 'border-l-gray-300'
            )}
          >
            <CardContent className="pt-4">
              <div className="flex items-start gap-4">
                <div className={cn(
                  'p-2 rounded-lg',
                  item.category === 'content_creation' ? 'bg-blue-100' :
                  item.category === 'content_optimization' ? 'bg-purple-100' :
                  item.category === 'internal_linking' ? 'bg-green-100' : 'bg-orange-100'
                )}>
                  <Icon className={cn(
                    'h-5 w-5',
                    item.category === 'content_creation' ? 'text-blue-600' :
                    item.category === 'content_optimization' ? 'text-purple-600' :
                    item.category === 'internal_linking' ? 'text-green-600' : 'text-orange-600'
                  )} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={item.priority === 'high' ? 'error' : item.priority === 'medium' ? 'default' : 'secondary'}>
                      {item.priority}
                    </Badge>
                    <Badge variant="outline">{categoryLabels[item.category]}</Badge>
                    <span className={cn('text-xs flex items-center gap-1', effort.color)}>
                      <Clock className="h-3 w-3" />
                      {effort.label}
                    </span>
                  </div>
                  <p className="font-medium text-surface-900">{item.action}</p>
                  {item.targetUrl && (
                    <p className="text-sm text-blue-600 mt-1 break-all">{item.targetUrl}</p>
                  )}
                  <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    {item.expectedImpact}
                  </p>
                  {item.targetQueries && item.targetQueries.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.targetQueries.map((q, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {q}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
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
          <Link href="/seo/settings">
            <Button variant="outline">
              Naar Instellingen
            </Button>
          </Link>
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
