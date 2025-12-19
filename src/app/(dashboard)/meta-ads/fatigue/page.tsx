'use client'

import { useState, useEffect } from 'react'
import { useSelectedClientId } from '@/stores/client-store'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  RefreshCw,
  Loader2,
  CheckCircle,
  Facebook,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react'
import Link from 'next/link'
import type { MetaFatigueSignal, MetaFatigueSeverity } from '@/types/meta-ads'

const severityConfig: Record<MetaFatigueSeverity, { color: string; bg: string; label: string }> = {
  critical: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Kritiek' },
  high: { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: 'Hoog' },
  medium: { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', label: 'Medium' },
  low: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'Laag' },
}

export default function MetaAdsFatiguePage() {
  const selectedClientId = useSelectedClientId()
  const [signals, setSignals] = useState<MetaFatigueSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAcknowledged, setShowAcknowledged] = useState(false)
  const [expandedSignals, setExpandedSignals] = useState<Set<string>>(new Set())
  const [severityFilter, setSeverityFilter] = useState<MetaFatigueSeverity | 'all'>('all')

  useEffect(() => {
    if (selectedClientId) {
      fetchSignals()
    } else {
      setLoading(false)
    }
  }, [selectedClientId, showAcknowledged])

  const fetchSignals = async () => {
    if (!selectedClientId) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        clientId: selectedClientId,
        includeAcknowledged: showAcknowledged.toString(),
      })

      const response = await fetch(`/api/meta-ads/fatigue?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch fatigue signals')
      }

      const data = await response.json()
      setSignals(data.signals || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const runDetection = async () => {
    if (!selectedClientId) return

    setDetecting(true)
    setError(null)

    try {
      const response = await fetch('/api/meta-ads/fatigue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Detection failed')
      }

      await fetchSignals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detection failed')
    } finally {
      setDetecting(false)
    }
  }

  const acknowledgeSignal = async (signalId: string) => {
    if (!selectedClientId) return

    try {
      const response = await fetch('/api/meta-ads/fatigue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId, clientId: selectedClientId }),
      })

      if (!response.ok) {
        throw new Error('Failed to acknowledge signal')
      }

      // Update local state
      setSignals(prev =>
        prev.map(s =>
          s.id === signalId
            ? { ...s, is_acknowledged: true, acknowledged_at: new Date().toISOString() }
            : s
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to acknowledge')
    }
  }

  const toggleExpanded = (signalId: string) => {
    setExpandedSignals(prev => {
      const newSet = new Set(prev)
      if (newSet.has(signalId)) {
        newSet.delete(signalId)
      } else {
        newSet.add(signalId)
      }
      return newSet
    })
  }

  const filteredSignals = signals.filter(
    s => severityFilter === 'all' || s.severity === severityFilter
  )

  const signalCounts = {
    critical: signals.filter(s => s.severity === 'critical' && !s.is_acknowledged).length,
    high: signals.filter(s => s.severity === 'high' && !s.is_acknowledged).length,
    medium: signals.filter(s => s.severity === 'medium' && !s.is_acknowledged).length,
    low: signals.filter(s => s.severity === 'low' && !s.is_acknowledged).length,
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
            Selecteer een klant in de header om fatigue alerts te bekijken.
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
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Creative Fatigue</h1>
            <p className="text-sm text-surface-500">
              Detecteer vermoeide ads voordat performance daalt
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-surface-600">
            <input
              type="checkbox"
              checked={showAcknowledged}
              onChange={e => setShowAcknowledged(e.target.checked)}
              className="rounded border-surface-300"
            />
            Toon bevestigde
          </label>

          <Button onClick={runDetection} disabled={detecting}>
            {detecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Detectie Uitvoeren
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {(['critical', 'high', 'medium', 'low'] as const).map(severity => (
          <button
            key={severity}
            onClick={() => setSeverityFilter(severityFilter === severity ? 'all' : severity)}
            className={`p-4 rounded-lg border transition-all ${
              severityFilter === severity
                ? severityConfig[severity].bg + ' border-2'
                : 'bg-white border-surface-200 hover:border-surface-300'
            }`}
          >
            <div className={`text-2xl font-bold ${severityConfig[severity].color}`}>
              {signalCounts[severity]}
            </div>
            <div className="text-sm text-surface-600">{severityConfig[severity].label}</div>
          </button>
        ))}
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
      ) : filteredSignals.length === 0 ? (
        <div className="bg-white rounded-xl border border-surface-200 p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-surface-900 mb-2">
            Geen fatigue signalen
          </h2>
          <p className="text-surface-600 max-w-md mx-auto">
            {severityFilter !== 'all'
              ? `Geen ${severityConfig[severityFilter].label.toLowerCase()} fatigue signalen gevonden.`
              : 'Je ads presteren goed! Er zijn momenteel geen tekenen van creative fatigue.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSignals.map(signal => (
            <div
              key={signal.id}
              className={`rounded-lg border transition-all ${
                signal.is_acknowledged
                  ? 'bg-surface-50 border-surface-200 opacity-60'
                  : severityConfig[signal.severity].bg
              }`}
            >
              {/* Signal Header */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => signal.id && toggleExpanded(signal.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        signal.is_acknowledged ? 'bg-surface-200' : 'bg-white/50'
                      }`}
                    >
                      <AlertTriangle
                        className={`h-4 w-4 ${
                          signal.is_acknowledged
                            ? 'text-surface-400'
                            : severityConfig[signal.severity].color
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-surface-900">
                          {signal.entity_name}
                        </h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            signal.is_acknowledged
                              ? 'bg-surface-200 text-surface-600'
                              : severityConfig[signal.severity].color + ' bg-white/50'
                          }`}
                        >
                          {severityConfig[signal.severity].label}
                        </span>
                        {signal.is_acknowledged && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            Bevestigd
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-surface-600 mt-1">
                        {signal.campaign_name}
                        {signal.adset_name && ` > ${signal.adset_name}`}
                      </p>
                      <p className="text-sm text-surface-500 mt-2">
                        {signal.reasons[0]}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Metrics Summary */}
                    <div className="flex items-center gap-4 mr-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-surface-500">Frequency:</span>
                        <span className="font-medium">{signal.current_frequency.toFixed(1)}</span>
                        {signal.frequency_change > 0 && (
                          <TrendingUp className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-surface-500">CTR:</span>
                        <span className="font-medium">{signal.current_ctr.toFixed(2)}%</span>
                        {signal.ctr_change < 0 && (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                    </div>

                    {!signal.is_acknowledged && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={e => {
                          e.stopPropagation()
                          signal.id && acknowledgeSignal(signal.id)
                        }}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Bevestig
                      </Button>
                    )}

                    {signal.id && expandedSignals.has(signal.id) ? (
                      <ChevronUp className="h-5 w-5 text-surface-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-surface-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {signal.id && expandedSignals.has(signal.id) && (
                <div className="px-4 pb-4 border-t border-surface-200/50">
                  <div className="grid grid-cols-2 gap-6 mt-4">
                    {/* Metrics Comparison */}
                    <div>
                      <h4 className="font-medium text-surface-900 mb-3">Metrics Vergelijking</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-surface-600">Frequency</span>
                          <div className="text-right">
                            <span className="font-medium">
                              {signal.baseline_frequency.toFixed(1)} → {signal.current_frequency.toFixed(1)}
                            </span>
                            <span
                              className={`ml-2 ${
                                signal.frequency_change > 0 ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {signal.frequency_change > 0 ? '+' : ''}
                              {signal.frequency_change.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-surface-600">CTR</span>
                          <div className="text-right">
                            <span className="font-medium">
                              {signal.baseline_ctr.toFixed(2)}% → {signal.current_ctr.toFixed(2)}%
                            </span>
                            <span
                              className={`ml-2 ${
                                signal.ctr_change < 0 ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {signal.ctr_change > 0 ? '+' : ''}
                              {signal.ctr_change.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-surface-600">CPC</span>
                          <div className="text-right">
                            <span className="font-medium">
                              €{signal.baseline_cpc.toFixed(2)} → €{signal.current_cpc.toFixed(2)}
                            </span>
                            <span
                              className={`ml-2 ${
                                signal.cpc_change > 0 ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {signal.cpc_change > 0 ? '+' : ''}
                              {signal.cpc_change.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Suggested Actions */}
                    <div>
                      <h4 className="font-medium text-surface-900 mb-3">Aanbevolen Acties</h4>
                      <ul className="space-y-2">
                        {signal.suggested_actions.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-[#1877F2] mt-0.5">•</span>
                            <span className="text-surface-700">{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* All Reasons */}
                  {signal.reasons.length > 1 && (
                    <div className="mt-4 pt-4 border-t border-surface-200/50">
                      <h4 className="font-medium text-surface-900 mb-2">Alle Redenen</h4>
                      <ul className="space-y-1">
                        {signal.reasons.map((reason, i) => (
                          <li key={i} className="text-sm text-surface-600">
                            • {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-4 text-xs text-surface-400">
                    Gedetecteerd op{' '}
                    {new Date(signal.detected_at).toLocaleDateString('nl-NL', {
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
