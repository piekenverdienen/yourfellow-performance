'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AlertSummary, AlertChannel } from '@/types'

interface CriticalIssuesProps {
  clientId?: string
}

const CHANNEL_LABELS: Record<AlertChannel, string> = {
  google_ads: 'Google Ads',
  meta: 'Meta Ads',
  website: 'Website',
  tracking: 'Tracking',
  seo: 'SEO',
  shopify: 'Shopify',
}

const CHANNEL_COLORS: Record<AlertChannel, string> = {
  google_ads: 'bg-blue-100 text-blue-800 border-blue-200',
  meta: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  website: 'bg-purple-100 text-purple-800 border-purple-200',
  tracking: 'bg-orange-100 text-orange-800 border-orange-200',
  seo: 'bg-green-100 text-green-800 border-green-200',
  shopify: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

export function CriticalIssues({ clientId }: CriticalIssuesProps) {
  const [summary, setSummary] = useState<AlertSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = clientId
        ? `/api/alerts/summary?client_id=${clientId}`
        : '/api/alerts/summary'

      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch alerts')

      const data = await response.json()
      setSummary(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [clientId])

  if (loading) {
    return (
      <div className="bg-white border border-surface-200 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white border border-surface-200 rounded-xl p-6">
        <div className="text-center py-4">
          <p className="text-surface-500 text-sm">Kon alerts niet laden</p>
          <Button variant="ghost" size="sm" onClick={fetchSummary} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-1" />
            Opnieuw proberen
          </Button>
        </div>
      </div>
    )
  }

  // Show positive message when no critical issues
  if (!summary || summary.total_critical === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-emerald-900">Geen kritieke issues</h3>
            <p className="text-sm text-emerald-700">Alles ziet er goed uit! De monitoring draait elke 30 minuten.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-red-100 border-b border-red-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="font-semibold text-red-900">
              Kritieke Issues ({summary.total_critical})
            </h2>
          </div>
          <Link
            href="/alerts"
            className="text-sm text-red-700 hover:text-red-900 flex items-center gap-1"
          >
            Bekijk alle alerts
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Issues by channel */}
      <div className="divide-y divide-red-100">
        {Object.entries(summary.by_channel).map(([channel, data]) => (
          <div key={channel} className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-xs font-medium px-2 py-1 rounded border ${
                  CHANNEL_COLORS[channel as AlertChannel]
                }`}
              >
                {CHANNEL_LABELS[channel as AlertChannel]}
              </span>
              <span className="text-sm text-red-700 font-medium">
                {data.count} issue{data.count > 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-2">
              {data.items.map((item) => (
                <Link
                  key={item.id}
                  href={`/alerts?id=${item.id}`}
                  className="block p-3 bg-white rounded-lg border border-red-100 hover:border-red-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-surface-900 text-sm">
                        {item.title}
                      </p>
                      {item.short_description && (
                        <p className="text-surface-600 text-xs mt-1">
                          {item.short_description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        item.severity === 'critical'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {item.severity === 'critical' ? 'Kritiek' : 'Hoog'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
