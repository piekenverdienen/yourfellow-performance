'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Trophy,
  TrendingUp,
  Image as ImageIcon,
  Video,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TopAdItem, TopAdsResponse } from '@/types/meta-ads'

interface TopAdsProps {
  clientId: string
  rangeDays?: number
  defaultMetric?: 'roas' | 'cpa' | 'spend' | 'conversions'
  limit?: number
}

type SortMetric = 'roas' | 'cpa' | 'spend' | 'conversions'

const metricLabels: Record<SortMetric, string> = {
  roas: 'Hoogste ROAS',
  cpa: 'Laagste CPA',
  spend: 'Hoogste Spend',
  conversions: 'Meeste Conversies',
}

export function TopAdsSection({
  clientId,
  rangeDays = 14,
  defaultMetric = 'roas',
  limit = 5,
}: TopAdsProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TopAdsResponse | null>(null)
  const [metric, setMetric] = useState<SortMetric>(defaultMetric)
  const [expanded, setExpanded] = useState(false)

  const fetchTopAds = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        clientId,
        rangeDays: rangeDays.toString(),
        metric,
        limit: expanded ? '10' : limit.toString(),
      })

      const response = await fetch(`/api/meta-ads/top-ads?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch top ads')
      }

      const result = await response.json() as TopAdsResponse
      setData(result)
    } catch (err) {
      console.error('Failed to fetch top ads:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (clientId) {
      fetchTopAds()
    }
  }, [clientId, rangeDays, metric, expanded])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('nl-NL').format(value)
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-surface-200 p-6">
        <div className="text-center text-red-600">
          <p className="font-medium">Fout bij laden top ads</p>
          <p className="text-sm text-surface-500 mt-1">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTopAds}
            className="mt-3"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Opnieuw proberen
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-surface-900">Top Performing Ads</h3>
            <p className="text-sm text-surface-500">
              Laatste {rangeDays} dagen
            </p>
          </div>
        </div>

        {/* Metric Selector */}
        <div className="flex items-center gap-2">
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as SortMetric)}
            className="text-sm border border-surface-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(metricLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="divide-y divide-surface-100">
        {loading ? (
          // Loading state
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-surface-400 mx-auto" />
            <p className="text-sm text-surface-500 mt-2">Top ads laden...</p>
          </div>
        ) : !data || data.items.length === 0 ? (
          // Empty state
          <div className="p-8 text-center">
            <Trophy className="h-12 w-12 text-surface-300 mx-auto mb-3" />
            <p className="text-surface-600 font-medium">Geen ads gevonden</p>
            <p className="text-sm text-surface-500 mt-1">
              Er zijn geen ads met data in de geselecteerde periode.
            </p>
          </div>
        ) : (
          // Ad list
          data.items.map((ad, index) => (
            <TopAdRow key={ad.ad_id} ad={ad} rank={index + 1} metric={metric} />
          ))
        )}
      </div>

      {/* Expand/Collapse */}
      {data && data.items.length >= limit && (
        <div className="px-6 py-3 border-t border-surface-100 bg-surface-50">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-center w-full text-sm text-surface-600 hover:text-surface-900 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Minder tonen
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Meer tonen
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// Individual ad row component
function TopAdRow({
  ad,
  rank,
  metric,
}: {
  ad: TopAdItem
  rank: number
  metric: SortMetric
}) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-amber-100 text-amber-700'
      case 2:
        return 'bg-slate-100 text-slate-600'
      case 3:
        return 'bg-orange-100 text-orange-700'
      default:
        return 'bg-surface-100 text-surface-600'
    }
  }

  const getPrimaryMetric = () => {
    switch (metric) {
      case 'roas':
        return { label: 'ROAS', value: `${ad.roas.toFixed(2)}x` }
      case 'cpa':
        return { label: 'CPA', value: formatCurrency(ad.cpa) }
      case 'spend':
        return { label: 'Spend', value: formatCurrency(ad.spend) }
      case 'conversions':
        return { label: 'Conv.', value: ad.conversions.toString() }
    }
  }

  const primaryMetric = getPrimaryMetric()
  const hasImage = ad.creative?.image_url || ad.creative?.thumbnail_url
  const hasVideo = ad.creative?.video_id
  const imageUrl = ad.creative?.thumbnail_url || ad.creative?.image_url

  return (
    <div className="px-6 py-4 hover:bg-surface-50 transition-colors">
      <div className="flex items-start gap-4">
        {/* Rank */}
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0',
            getRankColor(rank)
          )}
        >
          {rank}
        </div>

        {/* Creative Preview */}
        <div className="w-16 h-16 rounded-lg bg-surface-100 overflow-hidden shrink-0 relative">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={ad.ad_name}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide broken images
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {hasVideo ? (
                <Video className="h-6 w-6 text-surface-400" />
              ) : (
                <ImageIcon className="h-6 w-6 text-surface-400" />
              )}
            </div>
          )}
          {hasVideo && imageUrl && (
            <div className="absolute bottom-1 right-1 bg-black/60 rounded p-0.5">
              <Video className="h-3 w-3 text-white" />
            </div>
          )}
        </div>

        {/* Ad Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-surface-900 truncate">
            {ad.ad_name}
          </h4>

          {/* Creative text preview */}
          {(ad.creative?.title || ad.creative?.body) && (
            <p className="text-sm text-surface-500 mt-0.5 line-clamp-1">
              {ad.creative.title || ad.creative.body}
            </p>
          )}

          {/* CTA Badge */}
          {ad.creative?.cta_type && (
            <span className="inline-block mt-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
              {ad.creative.cta_type.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-6 shrink-0">
          {/* Primary metric (highlighted) */}
          <div className="text-right">
            <p className="text-xs text-surface-500">{primaryMetric.label}</p>
            <p className="text-lg font-bold text-surface-900">
              {primaryMetric.value}
            </p>
          </div>

          {/* Secondary metrics */}
          <div className="hidden md:flex items-center gap-4 text-right">
            {metric !== 'spend' && (
              <div>
                <p className="text-xs text-surface-500">Spend</p>
                <p className="text-sm font-medium text-surface-700">
                  {formatCurrency(ad.spend)}
                </p>
              </div>
            )}
            {metric !== 'conversions' && (
              <div>
                <p className="text-xs text-surface-500">Conv.</p>
                <p className="text-sm font-medium text-surface-700">
                  {ad.conversions}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-surface-500">CTR</p>
              <p className="text-sm font-medium text-surface-700">
                {ad.ctr.toFixed(2)}%
              </p>
            </div>
          </div>

          {/* Link to ad */}
          {ad.creative?.link_url && (
            <a
              href={ad.creative.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-surface-100 rounded-lg transition-colors"
              title="Open landing page"
            >
              <ExternalLink className="h-4 w-4 text-surface-400" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
