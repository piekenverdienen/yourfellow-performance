'use client'

import { useState, useEffect } from 'react'
import { useSelectedClientId } from '@/stores/client-store'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Target,
  Lightbulb,
  CheckCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { MetaAIInsight } from '@/types/meta-ads'

const insightTypeLabels = {
  daily: 'Dagelijks',
  weekly: 'Wekelijks',
  monthly: 'Maandelijks',
}

export default function MetaAdsInsightsPage() {
  const selectedClientId = useSelectedClientId()
  const [insights, setInsights] = useState<MetaAIInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null)

  useEffect(() => {
    if (selectedClientId) {
      fetchInsights()
    } else {
      setLoading(false)
    }
  }, [selectedClientId])

  const fetchInsights = async () => {
    if (!selectedClientId) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        clientId: selectedClientId,
        limit: '10',
      })

      const response = await fetch(`/api/meta-ads/insights?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch insights')
      }

      const data = await response.json()
      setInsights(data.insights || [])

      // Auto-expand first insight
      if (data.insights?.length > 0 && data.insights[0].id) {
        setExpandedInsight(data.insights[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const generateInsights = async () => {
    if (!selectedClientId) return

    setGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/meta-ads/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          insightType: selectedType,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate insights')
      }

      const data = await response.json()
      if (data.insight) {
        setInsights(prev => [data.insight, ...prev])
        setExpandedInsight(data.insight.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  if (!selectedClientId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-surface-200 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-surface-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-surface-900 mb-2">
            Selecteer een klant
          </h2>
          <p className="text-surface-600">
            Selecteer een klant in de header om AI insights te bekijken.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900">AI Insights</h1>
            <p className="text-sm text-surface-500">
              AI-gegenereerde analyses en aanbevelingen
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value as 'daily' | 'weekly' | 'monthly')}
            className="appearance-none bg-white border border-surface-200 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-surface-700 hover:border-surface-300 focus:outline-none focus:ring-2 focus:ring-purple-200"
          >
            <option value="daily">Dagelijkse analyse</option>
            <option value="weekly">Wekelijkse analyse</option>
            <option value="monthly">Maandelijkse analyse</option>
          </select>

          <Button
            onClick={generateInsights}
            disabled={generating}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Genereer Analyse
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Er ging iets mis</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-surface-400" />
        </div>
      ) : insights.length === 0 ? (
        <div className="bg-white rounded-xl border border-surface-200 p-8 text-center">
          <Sparkles className="h-12 w-12 text-purple-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-surface-900 mb-2">
            Nog geen AI analyses
          </h2>
          <p className="text-surface-600 max-w-md mx-auto mb-6">
            Genereer je eerste AI-analyse om inzichten te krijgen in je Meta Ads performance.
          </p>
          <Button
            onClick={generateInsights}
            disabled={generating}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Eerste Analyse Genereren
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map(insight => (
            <div
              key={insight.id}
              className="bg-white rounded-xl border border-surface-200 overflow-hidden"
            >
              {/* Insight Header */}
              <div
                className="p-4 cursor-pointer hover:bg-surface-50 transition-colors"
                onClick={() =>
                  setExpandedInsight(expandedInsight === insight.id ? null : insight.id || null)
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-surface-900">
                          {insightTypeLabels[insight.insight_type]} Analyse
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          {insightTypeLabels[insight.insight_type]}
                        </span>
                      </div>
                      <p className="text-sm text-surface-500">
                        {formatDate(insight.period_start)} - {formatDate(insight.period_end)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Quick Stats */}
                    {insight.metrics_summary && (
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-surface-500">Spend:</span>
                          <span className="font-medium">
                            €{insight.metrics_summary.total_spend?.toLocaleString('nl-NL') || 0}
                          </span>
                          {insight.metrics_summary.spend_vs_previous !== 0 && (
                            insight.metrics_summary.spend_vs_previous > 0 ? (
                              <TrendingUp className="h-3 w-3 text-green-500" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-red-500" />
                            )
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-surface-500">ROAS:</span>
                          <span className="font-medium">
                            {insight.metrics_summary.avg_roas?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                      </div>
                    )}

                    {expandedInsight === insight.id ? (
                      <ChevronUp className="h-5 w-5 text-surface-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-surface-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedInsight === insight.id && (
                <div className="border-t border-surface-100">
                  {/* Executive Summary */}
                  <div className="p-6 bg-gradient-to-r from-purple-50 to-white">
                    <h4 className="font-semibold text-surface-900 mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      Samenvatting
                    </h4>
                    <p className="text-surface-700 leading-relaxed">
                      {insight.executive_summary}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6 p-6">
                    {/* Top Performers */}
                    {insight.top_performers && insight.top_performers.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          Top Performers
                        </h4>
                        <div className="space-y-3">
                          {insight.top_performers.slice(0, 3).map((perf, i) => (
                            <div
                              key={i}
                              className="p-3 bg-green-50 rounded-lg border border-green-100"
                            >
                              <div className="font-medium text-surface-900 text-sm">
                                {perf.entity_name}
                              </div>
                              <div className="text-xs text-surface-600 mt-1">
                                {perf.metric}: {typeof perf.value === 'number' ? perf.value.toFixed(2) : perf.value}
                              </div>
                              <div className="text-xs text-green-700 mt-1">
                                {perf.insight}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Problems */}
                    {insight.problems && insight.problems.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          Problemen
                        </h4>
                        <div className="space-y-3">
                          {insight.problems.slice(0, 3).map((problem, i) => (
                            <div
                              key={i}
                              className={`p-3 rounded-lg border ${
                                problem.severity === 'high'
                                  ? 'bg-red-50 border-red-100'
                                  : problem.severity === 'medium'
                                  ? 'bg-orange-50 border-orange-100'
                                  : 'bg-yellow-50 border-yellow-100'
                              }`}
                            >
                              <div className="font-medium text-surface-900 text-sm">
                                {problem.title}
                              </div>
                              <div className="text-xs text-surface-600 mt-1">
                                {problem.description}
                              </div>
                              <div className="text-xs text-surface-500 mt-1">
                                Impact: {problem.impact}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Opportunities */}
                  {insight.opportunities && insight.opportunities.length > 0 && (
                    <div className="px-6 pb-6">
                      <h4 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-yellow-600" />
                        Kansen
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {insight.opportunities.slice(0, 4).map((opp, i) => (
                          <div
                            key={i}
                            className="p-3 bg-yellow-50 rounded-lg border border-yellow-100"
                          >
                            <div className="font-medium text-surface-900 text-sm">
                              {opp.title}
                            </div>
                            <div className="text-xs text-surface-600 mt-1">
                              {opp.description}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-yellow-700">
                                Impact: {opp.potential_impact}
                              </span>
                              <span className="text-xs text-surface-400">•</span>
                              <span className="text-xs text-surface-500">
                                Effort: {opp.effort}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommended Actions */}
                  {insight.recommended_actions && insight.recommended_actions.length > 0 && (
                    <div className="px-6 pb-6">
                      <h4 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-600" />
                        Aanbevolen Acties
                      </h4>
                      <div className="space-y-2">
                        {insight.recommended_actions.map((action, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100"
                          >
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {action.priority}
                            </div>
                            <div>
                              <div className="font-medium text-surface-900 text-sm">
                                {action.action}
                              </div>
                              <div className="text-xs text-surface-600 mt-1">
                                {action.rationale}
                              </div>
                              <div className="text-xs text-blue-700 mt-1">
                                Verwacht resultaat: {action.expected_outcome}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generated timestamp */}
                  <div className="px-6 pb-4 text-xs text-surface-400">
                    Gegenereerd op{' '}
                    {new Date(insight.generated_at).toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
