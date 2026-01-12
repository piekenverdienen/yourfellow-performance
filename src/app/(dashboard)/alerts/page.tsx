'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Loader2,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useClientStore } from '@/stores/client-store'
import type { Alert, AlertChannel, AlertStatus, AlertSeverity } from '@/types'

const CHANNEL_LABELS: Record<AlertChannel, string> = {
  google_ads: 'Google Ads',
  meta: 'Meta Ads',
  website: 'Website',
  tracking: 'Tracking',
  seo: 'SEO',
}

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200',
}

const STATUS_ICONS = {
  open: AlertTriangle,
  acknowledged: Clock,
  resolved: CheckCircle,
}

interface AlertWithClient extends Alert {
  client_name?: string
  client_slug?: string
}

export default function AlertsPage() {
  const searchParams = useSearchParams()
  const { selectedClient, clients } = useClientStore()
  const [alerts, setAlerts] = useState<AlertWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  // Filters
  const [channelFilter, setChannelFilter] = useState<AlertChannel | ''>('')
  const [statusFilter, setStatusFilter] = useState<AlertStatus | ''>('open')
  const [clientFilter, setClientFilter] = useState<string>('selected') // 'all', 'selected', or client_id
  const [expandedAlert, setExpandedAlert] = useState<string | null>(
    searchParams.get('id')
  )

  // Determine which client ID to filter on
  const effectiveClientId = clientFilter === 'all'
    ? undefined
    : clientFilter === 'selected'
      ? selectedClient?.id
      : clientFilter

  const fetchAlerts = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (channelFilter) params.set('channel', channelFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (effectiveClientId) params.set('client_id', effectiveClientId)

      const response = await fetch(`/api/alerts?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch alerts')

      const data = await response.json()
      setAlerts(data.alerts)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [channelFilter, statusFilter, effectiveClientId])

  const handleUpdateStatus = async (alertId: string, newStatus: AlertStatus) => {
    setUpdating(alertId)
    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) throw new Error('Failed to update alert')

      // Refresh alerts
      await fetchAlerts()
    } catch (err) {
      console.error('Error updating alert:', err)
      alert('Kon status niet updaten')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Alerts</h1>
          <p className="text-surface-600 mt-1">
            Monitoring meldingen en kritieke issues
          </p>
        </div>
        <Button variant="outline" onClick={fetchAlerts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Vernieuwen
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-surface-500" />
          <span className="text-sm text-surface-600">Filters:</span>
        </div>

        {/* Client filter */}
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="px-3 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="selected">
            {selectedClient ? selectedClient.name : 'Selecteer klant'}
          </option>
          <option value="all">Alle klanten</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>

        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as AlertChannel | '')}
          className="px-3 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="">Alle kanalen</option>
          {Object.entries(CHANNEL_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AlertStatus | '')}
          className="px-3 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="">Alle statussen</option>
          <option value="open">Open</option>
          <option value="acknowledged">Bevestigd</option>
          <option value="resolved">Opgelost</option>
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-surface-400" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* No alerts */}
      {!loading && !error && alerts.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="font-medium text-surface-900 mb-2">
            Geen alerts gevonden
          </h3>
          <p className="text-surface-600">
            {statusFilter === 'open'
              ? 'Alles ziet er goed uit!'
              : 'Geen alerts met deze filters'}
          </p>
        </div>
      )}

      {/* Alerts list */}
      {!loading && !error && alerts.length > 0 && (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const StatusIcon = STATUS_ICONS[alert.status]
            const isExpanded = expandedAlert === alert.id

            return (
              <div
                key={alert.id}
                className="bg-white border border-surface-200 rounded-xl overflow-hidden"
              >
                {/* Alert header */}
                <button
                  onClick={() =>
                    setExpandedAlert(isExpanded ? null : alert.id)
                  }
                  className="w-full px-6 py-4 flex items-center gap-4 text-left hover:bg-surface-50 transition-colors"
                >
                  <StatusIcon
                    className={`h-5 w-5 flex-shrink-0 ${
                      alert.status === 'resolved'
                        ? 'text-green-500'
                        : alert.status === 'acknowledged'
                        ? 'text-yellow-500'
                        : 'text-red-500'
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded border ${
                          SEVERITY_COLORS[alert.severity]
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-xs text-surface-500 px-2 py-0.5 bg-surface-100 rounded">
                        {CHANNEL_LABELS[alert.channel]}
                      </span>
                      {alert.client_name && (
                        <span className="text-xs text-surface-500">
                          {alert.client_name}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-surface-900 mt-1 truncate">
                      {alert.title}
                    </p>
                    {alert.short_description && (
                      <p className="text-sm text-surface-600 truncate">
                        {alert.short_description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-xs text-surface-500">
                      {new Date(alert.detected_at).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 text-surface-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-6 pb-6 border-t border-surface-100">
                    <div className="pt-4 space-y-4">
                      {/* Impact */}
                      {alert.impact && (
                        <div>
                          <h4 className="text-sm font-medium text-surface-700 mb-1">
                            Impact
                          </h4>
                          <p className="text-surface-600">{alert.impact}</p>
                        </div>
                      )}

                      {/* Suggested actions */}
                      {alert.suggested_actions &&
                        alert.suggested_actions.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-surface-700 mb-2">
                              Aanbevolen acties
                            </h4>
                            <ul className="space-y-1">
                              {alert.suggested_actions.map((action, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2 text-surface-600"
                                >
                                  <span className="text-primary">•</span>
                                  {action}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                      {/* Details */}
                      {alert.details && Object.keys(alert.details).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-surface-700 mb-2">
                            Details
                          </h4>
                          <pre className="text-xs bg-surface-50 p-3 rounded-lg overflow-auto max-h-40">
                            {JSON.stringify(alert.details, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3 pt-4 border-t border-surface-100">
                        {alert.status === 'open' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleUpdateStatus(alert.id, 'acknowledged')
                              }
                              disabled={updating === alert.id}
                            >
                              {updating === alert.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Clock className="h-4 w-4 mr-1" />
                              )}
                              Bevestigen
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                handleUpdateStatus(alert.id, 'resolved')
                              }
                              disabled={updating === alert.id}
                            >
                              {updating === alert.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4 mr-1" />
                              )}
                              Markeer als opgelost
                            </Button>
                          </>
                        )}

                        {alert.status === 'acknowledged' && (
                          <Button
                            size="sm"
                            onClick={() =>
                              handleUpdateStatus(alert.id, 'resolved')
                            }
                            disabled={updating === alert.id}
                          >
                            {updating === alert.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-1" />
                            )}
                            Markeer als opgelost
                          </Button>
                        )}

                        {alert.status === 'resolved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleUpdateStatus(alert.id, 'open')
                            }
                            disabled={updating === alert.id}
                          >
                            Heropenen
                          </Button>
                        )}

                        {alert.channel === 'google_ads' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              window.open('https://ads.google.com', '_blank')
                            }
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Open Google Ads
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
