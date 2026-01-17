'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useClientStore } from '@/stores/client-store'
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  Eye,
  EyeOff,
  ChevronDown,
  Target,
  TrendingUp,
  DollarSign,
  Settings,
  Palette,
  Zap,
  Filter,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Insight, InsightType, InsightImpact, InsightStatus } from '@/types'

const TYPE_CONFIG: Record<InsightType, { label: string; icon: typeof Target; color: string }> = {
  performance: { label: 'Performance', icon: TrendingUp, color: 'bg-blue-100 text-blue-800' },
  budget: { label: 'Budget', icon: DollarSign, color: 'bg-green-100 text-green-800' },
  bidding: { label: 'Bidding', icon: Target, color: 'bg-purple-100 text-purple-800' },
  structure: { label: 'Structuur', icon: Settings, color: 'bg-orange-100 text-orange-800' },
  creative: { label: 'Creative', icon: Palette, color: 'bg-pink-100 text-pink-800' },
}

const IMPACT_CONFIG: Record<InsightImpact, { label: string; color: string; bgColor: string }> = {
  high: { label: 'Hoog', color: 'text-red-700', bgColor: 'bg-red-100 border-red-200' },
  medium: { label: 'Medium', color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-200' },
  low: { label: 'Laag', color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-200' },
}

const STATUS_CONFIG: Record<InsightStatus, { label: string; color: string }> = {
  new: { label: 'Nieuw', color: 'bg-primary text-black' },
  picked_up: { label: 'In behandeling', color: 'bg-blue-100 text-blue-800' },
  ignored: { label: 'Genegeerd', color: 'bg-surface-100 text-surface-600' },
  resolved: { label: 'Opgelost', color: 'bg-green-100 text-green-800' },
}

interface InsightWithExpanded extends Insight {
  isExpanded?: boolean
}

export default function InsightsPage() {
  const { selectedClient } = useClientStore()
  const [insights, setInsights] = useState<InsightWithExpanded[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  // Filters
  const [typeFilter, setTypeFilter] = useState<InsightType | ''>('')
  const [impactFilter, setImpactFilter] = useState<InsightImpact | ''>('')
  const [statusFilter, setStatusFilter] = useState<string>('new,picked_up')
  const [showResolved, setShowResolved] = useState(false)

  const fetchInsights = async () => {
    if (!selectedClient) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('status', statusFilter)
      if (typeFilter) params.set('type', typeFilter)
      if (impactFilter) params.set('impact', impactFilter)

      const res = await fetch(`/api/clients/${selectedClient.id}/google-ads/insights?${params}`)
      const json = await res.json()

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch insights')
      }

      setInsights(json.insights || [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const generateInsights = async () => {
    if (!selectedClient) return

    setGenerating(true)
    setError(null)

    try {
      const res = await fetch(`/api/clients/${selectedClient.id}/google-ads/insights`, {
        method: 'POST',
      })
      const json = await res.json()

      if (!json.success) {
        throw new Error(json.error || 'Failed to generate insights')
      }

      // Refresh the list
      await fetchInsights()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const updateStatus = async (insightId: string, status: InsightStatus) => {
    setUpdating(insightId)

    try {
      const res = await fetch(`/api/insights/${insightId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        throw new Error('Failed to update insight')
      }

      // Update local state
      setInsights(prev =>
        prev.map(i => (i.id === insightId ? { ...i, status } : i))
      )
    } catch (err) {
      console.error('Error updating insight:', err)
    } finally {
      setUpdating(null)
    }
  }

  const toggleExpanded = (insightId: string) => {
    setInsights(prev =>
      prev.map(i => (i.id === insightId ? { ...i, isExpanded: !i.isExpanded } : i))
    )
  }

  useEffect(() => {
    fetchInsights()
  }, [selectedClient, typeFilter, impactFilter, statusFilter])

  if (!selectedClient) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <CardContent>
            <Lightbulb className="h-12 w-12 text-surface-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">
              Selecteer een klant
            </h3>
            <p className="text-surface-600">
              Selecteer een klant om AI insights te bekijken.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const googleAdsConfigured = selectedClient.settings?.googleAds?.customerId

  if (!googleAdsConfigured) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/google-ads/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Terug naar Dashboard
            </Button>
          </Link>
        </div>
        <Card className="text-center py-12">
          <CardContent>
            <Lightbulb className="h-12 w-12 text-surface-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">
              Google Ads niet geconfigureerd
            </h3>
            <p className="text-surface-600 mb-4">
              Configureer eerst de Google Ads koppeling.
            </p>
            <Link href={`/clients/${selectedClient.id}?tab=settings`}>
              <Button>Configureer Google Ads</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/google-ads/dashboard">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Terug naar Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100">
              <Lightbulb className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900">
                AI Insights
              </h1>
              <p className="text-surface-600">
                Automatische optimalisatie aanbevelingen voor {selectedClient.name}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={generateInsights}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Genereer Insights
          </Button>
          <Button variant="outline" size="sm" onClick={fetchInsights} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Vernieuwen
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-gradient-to-br from-amber-50 to-transparent border-amber-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Zap className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-surface-900">Over AI Insights</p>
              <p className="text-sm text-surface-600 mt-1">
                Deze insights worden gegenereerd door deterministische regels gebaseerd op je Google Ads data.
                Elke insight heeft een duidelijke actie en is volledig verklaarbaar - geen black box AI.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-surface-500" />
          <span className="text-sm text-surface-600">Filters:</span>
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as InsightType | '')}
          className="text-sm px-3 py-1.5 border border-surface-200 rounded-lg focus:ring-2 focus:ring-primary"
        >
          <option value="">Alle types</option>
          {Object.entries(TYPE_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>

        <select
          value={impactFilter}
          onChange={(e) => setImpactFilter(e.target.value as InsightImpact | '')}
          className="text-sm px-3 py-1.5 border border-surface-200 rounded-lg focus:ring-2 focus:ring-primary"
        >
          <option value="">Alle impact levels</option>
          {Object.entries(IMPACT_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm px-3 py-1.5 border border-surface-200 rounded-lg focus:ring-2 focus:ring-primary"
        >
          <option value="new,picked_up">Actief</option>
          <option value="new">Alleen nieuw</option>
          <option value="picked_up">In behandeling</option>
          <option value="ignored">Genegeerd</option>
          <option value="resolved">Opgelost</option>
          <option value="new,picked_up,ignored,resolved">Alle</option>
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <p className="text-red-900">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No insights */}
      {!loading && !error && insights.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">
              Geen insights gevonden
            </h3>
            <p className="text-surface-600 mb-4">
              {statusFilter.includes('new')
                ? 'Er zijn momenteel geen nieuwe optimalisatie mogelijkheden gedetecteerd.'
                : 'Geen insights met deze filters.'}
            </p>
            <Button onClick={generateInsights} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Genereer nieuwe insights
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Insights List */}
      {!loading && !error && insights.length > 0 && (
        <div className="space-y-4">
          {insights.map((insight) => {
            const typeConfig = TYPE_CONFIG[insight.type]
            const impactConfig = IMPACT_CONFIG[insight.impact]
            const statusConfig = STATUS_CONFIG[insight.status]
            const TypeIcon = typeConfig.icon

            return (
              <Card
                key={insight.id}
                className={cn(
                  'overflow-hidden transition-all',
                  insight.impact === 'high' && insight.status === 'new' && 'border-red-200'
                )}
              >
                {/* Header */}
                <button
                  onClick={() => toggleExpanded(insight.id)}
                  className="w-full p-4 flex items-start gap-4 text-left hover:bg-surface-50 transition-colors"
                >
                  <div className={cn('p-2 rounded-lg', typeConfig.color)}>
                    <TypeIcon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className={impactConfig.bgColor}>
                        {impactConfig.label} impact
                      </Badge>
                      <Badge className={statusConfig.color}>
                        {statusConfig.label}
                      </Badge>
                      {insight.scope_name && (
                        <span className="text-xs text-surface-500">
                          {insight.scope_name}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-surface-900">
                      {insight.summary}
                    </p>
                    <p className="text-sm text-surface-600 mt-1 line-clamp-2">
                      {insight.explanation}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-surface-500">
                      {new Date(insight.detected_at).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-5 w-5 text-surface-400 transition-transform',
                        insight.isExpanded && 'rotate-180'
                      )}
                    />
                  </div>
                </button>

                {/* Expanded Content */}
                {insight.isExpanded && (
                  <div className="border-t border-surface-200 p-4 bg-surface-50">
                    <div className="space-y-4">
                      {/* Explanation */}
                      <div>
                        <h4 className="text-sm font-medium text-surface-700 mb-1">
                          Uitleg
                        </h4>
                        <p className="text-surface-600">{insight.explanation}</p>
                      </div>

                      {/* Recommendation */}
                      <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <h4 className="text-sm font-medium text-surface-900 mb-1 flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-primary" />
                          Aanbeveling
                        </h4>
                        <p className="text-surface-700">{insight.recommendation}</p>
                      </div>

                      {/* Confidence */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-surface-500">Betrouwbaarheid:</span>
                        <Badge variant="outline">
                          {insight.confidence === 'high'
                            ? 'Hoog'
                            : insight.confidence === 'medium'
                            ? 'Medium'
                            : 'Laag'}
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 pt-4 border-t border-surface-200">
                        {insight.status === 'new' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => updateStatus(insight.id, 'picked_up')}
                              disabled={updating === insight.id}
                            >
                              {updating === insight.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Eye className="h-4 w-4 mr-1" />
                              )}
                              Oppakken
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(insight.id, 'ignored')}
                              disabled={updating === insight.id}
                            >
                              <EyeOff className="h-4 w-4 mr-1" />
                              Negeren
                            </Button>
                          </>
                        )}

                        {insight.status === 'picked_up' && (
                          <Button
                            size="sm"
                            onClick={() => updateStatus(insight.id, 'resolved')}
                            disabled={updating === insight.id}
                          >
                            {updating === insight.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-1" />
                            )}
                            Markeer als opgelost
                          </Button>
                        )}

                        {insight.status === 'resolved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(insight.id, 'new')}
                            disabled={updating === insight.id}
                          >
                            Heropenen
                          </Button>
                        )}

                        {insight.status === 'ignored' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(insight.id, 'new')}
                            disabled={updating === insight.id}
                          >
                            Toch bekijken
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
