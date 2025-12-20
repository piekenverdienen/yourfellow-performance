'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSelectedClient } from '@/stores/client-store'
import { usePersistedState } from '@/hooks/use-persisted-form'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import {
  Sparkles,
  Copy,
  TrendingUp,
  Download,
  Star,
  CheckCircle,
  Loader2,
  ExternalLink,
  Youtube,
  Instagram,
  FileText,
  RefreshCw,
  ArrowUp,
  MessageSquare,
  Clock,
  Archive,
  Zap,
  ChevronRight,
  AlertCircle,
  FileCheck,
  X,
  RotateCcw,
  Lightbulb,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn, copyToClipboard, formatRelativeTime } from '@/lib/utils'

// ============================================
// Types
// ============================================

interface Opportunity {
  id: string
  clientId?: string
  industry: string
  channel: 'youtube' | 'instagram' | 'blog'
  topic: string
  angle: string
  hook: string
  reasoning: string
  score: number
  scoreBreakdown: {
    engagement: number
    freshness: number
    relevance: number
    novelty: number
    seasonality: number
  }
  sourceSignalIds: string[]
  status: 'new' | 'shortlisted' | 'generated' | 'archived'
  createdAt: string
}

interface Signal {
  sourceType: string
  externalId: string
  url: string
  title: string
  author?: string
  community?: string
  metrics: {
    upvotes?: number
    comments?: number
    upvoteRatio?: number
  }
  rawExcerpt?: string
}

interface Generation {
  id: string
  opportunityId: string
  channel: 'youtube' | 'instagram' | 'blog'
  task: string
  output: Record<string, unknown>
  createdAt: string
}

// ============================================
// Brief Types (NEW)
// ============================================

interface Brief {
  id: string
  clientId?: string
  ideaId?: string
  brief: {
    core_tension: string
    our_angle: string
    key_claim: string
    proof_points: string[]
    why_now: string
    no_go_claims?: string[]
  }
  evidence: {
    signal_id: string
    url: string
    title: string
    excerpt?: string
    subreddit?: string
    upvotes?: number
    comments?: number
  }[]
  sourceDateRange?: {
    from: string
    to: string
  }
  status: 'draft' | 'approved' | 'rejected' | 'superseded'
  approvedBy?: string
  approvedAt?: string
  rejectionReason?: string
  createdAt: string
  ideaTopic?: string
  ideaAngle?: string
  ideaScore?: number
  generations?: BriefGeneration[]
}

interface BriefGeneration {
  id: string
  channel: 'youtube' | 'instagram' | 'blog'
  output: Record<string, unknown>
  version: number
  createdAt: string
}

interface IngestConfig {
  industry: string
  subreddits: string
  query: string
}

const defaultConfig: IngestConfig = {
  industry: 'marketing',
  subreddits: 'marketing, entrepreneur, smallbusiness, socialmedia',
  query: '',
}

// ============================================
// Types for AI Suggestions
// ============================================

interface AISuggestion {
  subreddits: string[]
  industry: string
  searchTerms: string[]
  reasoning: string
}

const CHANNEL_ICONS = {
  youtube: Youtube,
  instagram: Instagram,
  blog: FileText,
}

const CHANNEL_LABELS = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  blog: 'Blog',
}

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-800',
  shortlisted: 'bg-yellow-100 text-yellow-800',
  generated: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-600',
}

const STATUS_LABELS = {
  new: 'Nieuw',
  shortlisted: 'Favoriet',
  generated: 'Gegenereerd',
  archived: 'Gearchiveerd',
}

const SCORE_LABELS: Record<string, string> = {
  engagement: 'Betrokkenheid',
  freshness: 'Actualiteit',
  relevance: 'Relevantie',
  novelty: 'Nieuwheid',
  seasonality: 'Seizoen',
}

const BRIEF_STATUS_COLORS = {
  draft: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  superseded: 'bg-gray-100 text-gray-600',
}

const BRIEF_STATUS_LABELS = {
  draft: 'Concept',
  approved: 'Goedgekeurd',
  rejected: 'Afgekeurd',
  superseded: 'Vervangen',
}

// ============================================
// Main Component
// ============================================

export default function ViralHubPage() {
  const selectedClient = useSelectedClient()
  const clientId = selectedClient?.id || null
  const clientSettings = selectedClient?.settings as { context?: { proposition?: string; targetAudience?: string } } | undefined
  const hasContext = !!(clientSettings?.context?.proposition || clientSettings?.context?.targetAudience)

  const [config, setConfig] = usePersistedState('viral-hub-config', defaultConfig)

  // AI Suggestion state
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null)
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false)
  const [suggestionError, setSuggestionError] = useState<string | null>(null)

  // Fetch AI suggestions when client changes
  const fetchAISuggestion = useCallback(async (forClientId: string) => {
    setIsLoadingSuggestion(true)
    setSuggestionError(null)

    try {
      const response = await fetch('/api/viral/suggest-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: forClientId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get suggestions')
      }

      const suggestion = data.data as AISuggestion
      setAiSuggestion(suggestion)

      // Auto-apply the suggestion
      setConfig({
        industry: suggestion.industry,
        subreddits: suggestion.subreddits.join(', '),
        query: suggestion.searchTerms[0] || '',
      })
    } catch (err) {
      setSuggestionError(err instanceof Error ? err.message : 'Failed to get AI suggestions')
    } finally {
      setIsLoadingSuggestion(false)
    }
  }, [setConfig])

  // AI suggestions are only fetched when user clicks the refresh button
  // (removed auto-fetch on client change)

  // Main navigation tab
  const [mainTab, setMainTab] = useState<'ideas' | 'briefs'>('ideas')

  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null)
  const [opportunitySignals, setOpportunitySignals] = useState<Signal[]>([])
  const [opportunityGenerations, setOpportunityGenerations] = useState<Generation[]>([])

  // Brief state (NEW)
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null)
  const [isLoadingBriefs, setIsLoadingBriefs] = useState(false)
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false)
  const [isApprovingBrief, setIsApprovingBrief] = useState(false)
  const [isGeneratingContent, setIsGeneratingContent] = useState(false)
  const [briefStatusFilter, setBriefStatusFilter] = useState<'all' | 'draft' | 'approved' | 'rejected'>('all')

  const [isIngesting, setIsIngesting] = useState(false)
  const [isBuilding, setIsBuilding] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  const [ingestResult, setIngestResult] = useState<{ inserted: number; updated: number; errors?: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'youtube' | 'instagram' | 'blog'>('youtube')
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'shortlisted' | 'generated'>('all')

  // ============================================
  // Data Fetching
  // ============================================

  const loadOpportunities = useCallback(async () => {
    setIsLoadingOpportunities(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (config.industry) params.set('industry', config.industry)
      if (clientId) params.set('clientId', clientId)
      params.set('limit', '50')

      const response = await fetch(`/api/viral/opportunities?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load opportunities')
      }

      setOpportunities(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load opportunities')
    } finally {
      setIsLoadingOpportunities(false)
    }
  }, [config.industry, clientId])

  useEffect(() => {
    loadOpportunities()
  }, [loadOpportunities])

  // Load briefs
  const loadBriefs = useCallback(async () => {
    setIsLoadingBriefs(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (clientId) params.set('clientId', clientId)
      params.set('limit', '50')

      const response = await fetch(`/api/viral/briefs?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load briefs')
      }

      setBriefs(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load briefs')
    } finally {
      setIsLoadingBriefs(false)
    }
  }, [clientId])

  useEffect(() => {
    if (mainTab === 'briefs') {
      loadBriefs()
    }
  }, [mainTab, loadBriefs])

  // ============================================
  // Actions
  // ============================================

  const handleIngest = async () => {
    setIsIngesting(true)
    setError(null)
    setIngestResult(null)

    try {
      const subreddits = config.subreddits
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      console.log('[Viral Hub] Starting ingest with:', { subreddits, query: config.query })

      const response = await fetch('/api/viral/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: config.industry,
          reddit: {
            subreddits: subreddits.length > 0 ? subreddits : undefined,
            query: config.query || undefined,
            sort: 'hot',
            timeFilter: 'week',  // Changed to week for more results
            limit: 50,  // Increased limit
          },
        }),
      })

      const data = await response.json()
      console.log('[Viral Hub] Ingest response:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Ingest failed')
      }

      // Show errors from the ingest process
      if (data.errors && data.errors.length > 0) {
        console.warn('[Viral Hub] Ingest errors:', data.errors)
        setError(`Ingest waarschuwingen: ${data.errors.join(', ')}`)
      }

      setIngestResult({
        inserted: data.data.inserted,
        updated: data.data.updated,
        errors: data.errors,
      })
    } catch (err) {
      console.error('[Viral Hub] Ingest failed:', err)
      setError(err instanceof Error ? err.message : 'Ingest failed')
    } finally {
      setIsIngesting(false)
    }
  }

  const handleBuildOpportunities = async () => {
    setIsBuilding(true)
    setError(null)

    try {
      const response = await fetch('/api/viral/opportunities/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: config.industry,
          clientId: clientId || undefined,
          channels: ['youtube', 'instagram', 'blog'],
          limit: 15,
          days: 7,
          useAI: false,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Build failed')
      }

      // Reload opportunities
      await loadOpportunities()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Build failed')
    } finally {
      setIsBuilding(false)
    }
  }

  const handleSelectOpportunity = async (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity)
    setIsLoadingDetails(true)
    setActiveTab(opportunity.channel)

    try {
      const response = await fetch(`/api/viral/opportunities/${opportunity.id}`)
      const data = await response.json()

      if (response.ok && data.success) {
        setOpportunitySignals(data.data.signals || [])
        setOpportunityGenerations(data.data.generations || [])
      }
    } catch (err) {
      console.error('Failed to load details:', err)
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const handleGenerate = async (channels: string[]) => {
    if (!selectedOpportunity) return

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch(`/api/viral/opportunities/${selectedOpportunity.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channels,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed')
      }

      // Reload opportunity details
      await handleSelectOpportunity(selectedOpportunity)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUpdateStatus = async (opportunityId: string, status: Opportunity['status']) => {
    try {
      await fetch(`/api/viral/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      // Update local state
      setOpportunities(prev =>
        prev.map(opp => opp.id === opportunityId ? { ...opp, status } : opp)
      )

      if (selectedOpportunity?.id === opportunityId) {
        setSelectedOpportunity(prev => prev ? { ...prev, status } : null)
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const handleCopy = async (text: string, label: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedText(label)
      setTimeout(() => setCopiedText(null), 2000)
    }
  }

  // ============================================
  // Brief Actions (NEW)
  // ============================================

  const handleGenerateBrief = async (opportunity: Opportunity) => {
    setIsGeneratingBrief(true)
    setError(null)

    try {
      const response = await fetch('/api/viral/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideaId: opportunity.id,
          clientId: clientId || undefined,
          industry: config.industry,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate brief')
      }

      // Switch to briefs tab and reload
      setMainTab('briefs')
      await loadBriefs()

      // Select the new brief
      if (data.data) {
        setSelectedBrief(data.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate brief')
    } finally {
      setIsGeneratingBrief(false)
    }
  }

  const handleSelectBrief = async (brief: Brief) => {
    setSelectedBrief(brief)

    // Load full brief details with generations
    try {
      const response = await fetch(`/api/viral/briefs/${brief.id}`)
      const data = await response.json()

      if (response.ok && data.success) {
        setSelectedBrief(data.data)
      }
    } catch (err) {
      console.error('Failed to load brief details:', err)
    }
  }

  const handleApproveBrief = async () => {
    if (!selectedBrief) return

    setIsApprovingBrief(true)
    setError(null)

    try {
      const response = await fetch(`/api/viral/briefs/${selectedBrief.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve brief')
      }

      // Update selected brief
      setSelectedBrief(data.data)
      // Reload briefs list
      await loadBriefs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve brief')
    } finally {
      setIsApprovingBrief(false)
    }
  }

  const handleRejectBrief = async (reason?: string) => {
    if (!selectedBrief) return

    setIsApprovingBrief(true)
    setError(null)

    try {
      const response = await fetch(`/api/viral/briefs/${selectedBrief.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject brief')
      }

      setSelectedBrief(data.data)
      await loadBriefs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject brief')
    } finally {
      setIsApprovingBrief(false)
    }
  }

  const handleRegenerateAngle = async (instruction?: string) => {
    if (!selectedBrief) return

    setIsGeneratingBrief(true)
    setError(null)

    try {
      const response = await fetch(`/api/viral/briefs/${selectedBrief.id}/regenerate-angle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate brief')
      }

      // Select the new brief
      setSelectedBrief(data.data)
      await loadBriefs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate brief')
    } finally {
      setIsGeneratingBrief(false)
    }
  }

  const handleGenerateContentFromBrief = async (channel: 'youtube' | 'instagram' | 'blog') => {
    if (!selectedBrief || selectedBrief.status !== 'approved') return

    setIsGeneratingContent(true)
    setError(null)

    try {
      const response = await fetch(`/api/viral/briefs/${selectedBrief.id}/generate-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate content')
      }

      // Reload brief with new generation
      await handleSelectBrief(selectedBrief)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content')
    } finally {
      setIsGeneratingContent(false)
    }
  }

  // ============================================
  // Render
  // ============================================

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Viral Hub
          </h1>
          <p className="text-surface-600 mt-1">
            Ontdek trending topics en genereer content die scoort
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLoadingSuggestion && (
            <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              AI analyseert klant...
            </Badge>
          )}
          {!isLoadingSuggestion && aiSuggestion && (
            <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Config geladen
            </Badge>
          )}
          {clientId && !hasContext && (
            <Badge variant="secondary">
              Geen AI Context
            </Badge>
          )}
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setMainTab('ideas')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2',
            mainTab === 'ideas'
              ? 'border-primary text-primary'
              : 'border-transparent text-surface-600 hover:text-surface-900'
          )}
        >
          <Lightbulb className="h-4 w-4" />
          Ideas ({opportunities.length})
        </button>
        <button
          onClick={() => setMainTab('briefs')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2',
            mainTab === 'briefs'
              ? 'border-primary text-primary'
              : 'border-transparent text-surface-600 hover:text-surface-900'
          )}
        >
          <FileCheck className="h-4 w-4" />
          Briefs ({briefs.length})
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-800 font-medium">Er ging iets mis</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* Ideas Tab Content */}
      {mainTab === 'ideas' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Signalen Ophalen
                  </CardTitle>
                  <CardDescription>
                    {isLoadingSuggestion
                      ? 'AI analyseert de klant context...'
                      : aiSuggestion
                        ? 'Instellingen gegenereerd door AI'
                        : 'Configureer welke trends je wilt ontdekken'}
                  </CardDescription>
                </div>
                {hasContext && clientId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchAISuggestion(clientId)}
                    disabled={isLoadingSuggestion}
                    title="Herlaad AI suggesties"
                  >
                    <RefreshCw className={cn('h-4 w-4', isLoadingSuggestion && 'animate-spin')} />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* AI Reasoning */}
              {aiSuggestion?.reasoning && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <p className="text-xs font-medium text-primary mb-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI Analyse
                  </p>
                  <p className="text-xs text-surface-600">{aiSuggestion.reasoning}</p>
                </div>
              )}

              {/* Suggestion Error */}
              {suggestionError && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-700">{suggestionError}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-surface-700 mb-1.5 block">
                  Industrie
                </label>
                <Input
                  value={config.industry}
                  onChange={(e) => setConfig({ ...config, industry: e.target.value })}
                  placeholder="marketing, ecommerce, etc."
                  disabled={isLoadingSuggestion}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-surface-700 mb-1.5 block">
                  Subreddits
                </label>
                <Input
                  value={config.subreddits}
                  onChange={(e) => setConfig({ ...config, subreddits: e.target.value })}
                  placeholder="marketing, entrepreneur, smallbusiness"
                  disabled={isLoadingSuggestion}
                />
                <p className="text-xs text-surface-500 mt-1">
                  Komma-gescheiden lijst van communities waar je doelgroep actief is
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-surface-700 mb-1.5 block">
                  Zoekterm (optioneel)
                </label>
                <Input
                  value={config.query}
                  onChange={(e) => setConfig({ ...config, query: e.target.value })}
                  placeholder="viral marketing tips"
                  disabled={isLoadingSuggestion}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleIngest}
                  disabled={isIngesting || !config.industry}
                  className="flex-1"
                  variant="outline"
                >
                  {isIngesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Ophalen
                </Button>
                <Button
                  onClick={handleBuildOpportunities}
                  disabled={isBuilding || !config.industry}
                  className="flex-1"
                >
                  {isBuilding ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Ideeën Genereren
                </Button>
              </div>

              {ingestResult && (
                <div className={cn(
                  'rounded-lg p-3 text-sm',
                  ingestResult.inserted > 0 || ingestResult.updated > 0
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-amber-50 border border-amber-200'
                )}>
                  <p className={cn(
                    'font-medium',
                    ingestResult.inserted > 0 || ingestResult.updated > 0
                      ? 'text-green-800'
                      : 'text-amber-800'
                  )}>
                    {ingestResult.inserted > 0 || ingestResult.updated > 0
                      ? 'Signalen opgehaald!'
                      : 'Geen nieuwe content gevonden'}
                  </p>
                  <p className={ingestResult.inserted > 0 || ingestResult.updated > 0 ? 'text-green-600' : 'text-amber-600'}>
                    {ingestResult.inserted} nieuwe, {ingestResult.updated} bijgewerkt
                  </p>
                  {ingestResult.errors && ingestResult.errors.length > 0 && (
                    <p className="text-amber-700 text-xs mt-1">
                      ⚠️ {ingestResult.errors.join(', ')}
                    </p>
                  )}
                  {ingestResult.inserted === 0 && ingestResult.updated === 0 && !ingestResult.errors?.length && (
                    <p className="text-amber-600 text-xs mt-1">
                      Controleer de server logs voor meer details. Mogelijk blokkeert Reddit de server.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{opportunities.length}</p>
                  <p className="text-xs text-surface-600">Opportunities</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">
                    {opportunities.filter(o => o.status === 'generated').length}
                  </p>
                  <p className="text-xs text-surface-600">Gegenereerd</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Opportunities List */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Content Ideeën</CardTitle>
                  <CardDescription>
                    Gesorteerd op score (hoogste eerst)
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadOpportunities}
                  disabled={isLoadingOpportunities}
                >
                  <RefreshCw className={cn('h-4 w-4', isLoadingOpportunities && 'animate-spin')} />
                </Button>
              </div>
              {/* Status Filter Tabs */}
              <div className="flex gap-1 mt-3 border-b">
                {[
                  { value: 'all', label: 'Alle', count: opportunities.length },
                  { value: 'shortlisted', label: '⭐ Favorieten', count: opportunities.filter(o => o.status === 'shortlisted').length },
                  { value: 'generated', label: '✓ Gegenereerd', count: opportunities.filter(o => o.status === 'generated').length },
                  { value: 'new', label: 'Nieuw', count: opportunities.filter(o => o.status === 'new').length },
                ] .map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setStatusFilter(tab.value as typeof statusFilter)}
                    className={cn(
                      'px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                      statusFilter === tab.value
                        ? 'border-primary text-primary'
                        : 'border-transparent text-surface-600 hover:text-surface-900'
                    )}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingOpportunities ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : opportunities.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 mx-auto text-surface-300 mb-4" />
                  <p className="text-surface-600 font-medium">Geen ideeën gevonden</p>
                  <p className="text-surface-500 text-sm mt-1">
                    Klik op &quot;Ophalen&quot; en daarna &quot;Ideeën Genereren&quot; om te starten
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {opportunities
                    .filter(o => statusFilter === 'all' || o.status === statusFilter)
                    .map((opportunity) => (
                      <OpportunityCard
                        key={opportunity.id}
                        opportunity={opportunity}
                        onClick={() => handleSelectOpportunity(opportunity)}
                        onStatusChange={(status) => handleUpdateStatus(opportunity.id, status)}
                        onGenerateBrief={() => handleGenerateBrief(opportunity)}
                        isGeneratingBrief={isGeneratingBrief}
                      />
                    ))}
                  {opportunities.filter(o => statusFilter === 'all' || o.status === statusFilter).length === 0 && (
                    <div className="text-center py-8 text-surface-500">
                      Geen items met status &quot;{statusFilter}&quot;
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {/* Briefs Tab Content */}
      {mainTab === 'briefs' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Brief Stats */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-primary" />
                  Content Briefs
                </CardTitle>
                <CardDescription>
                  Goedgekeurde briefs vormen de basis voor content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-amber-50 rounded-lg">
                    <p className="text-2xl font-bold text-amber-700">
                      {briefs.filter(b => b.status === 'draft').length}
                    </p>
                    <p className="text-xs text-amber-600">Concept</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-700">
                      {briefs.filter(b => b.status === 'approved').length}
                    </p>
                    <p className="text-xs text-green-600">Goedgekeurd</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-surface-50 rounded-lg">
                  <p className="text-xs text-surface-600 mb-2">Workflow:</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">Idea</span>
                    <ChevronRight className="h-3 w-3 text-surface-400" />
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded">Brief</span>
                    <ChevronRight className="h-3 w-3 text-surface-400" />
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded">Approved</span>
                    <ChevronRight className="h-3 w-3 text-surface-400" />
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded">Content</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Briefs List */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Canonical Briefs</CardTitle>
                    <CardDescription>
                      Klik op een brief om te reviewen en goed te keuren
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadBriefs}
                    disabled={isLoadingBriefs}
                  >
                    <RefreshCw className={cn('h-4 w-4', isLoadingBriefs && 'animate-spin')} />
                  </Button>
                </div>
                {/* Status Filter Tabs */}
                <div className="flex gap-1 mt-3 border-b">
                  {[
                    { value: 'all', label: 'Alle', count: briefs.length },
                    { value: 'draft', label: 'Concept', count: briefs.filter(b => b.status === 'draft').length },
                    { value: 'approved', label: 'Goedgekeurd', count: briefs.filter(b => b.status === 'approved').length },
                    { value: 'rejected', label: 'Afgekeurd', count: briefs.filter(b => b.status === 'rejected').length },
                  ].map(tab => (
                    <button
                      key={tab.value}
                      onClick={() => setBriefStatusFilter(tab.value as typeof briefStatusFilter)}
                      className={cn(
                        'px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                        briefStatusFilter === tab.value
                          ? 'border-primary text-primary'
                          : 'border-transparent text-surface-600 hover:text-surface-900'
                      )}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingBriefs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : briefs.length === 0 ? (
                  <div className="text-center py-12">
                    <FileCheck className="h-12 w-12 mx-auto text-surface-300 mb-4" />
                    <p className="text-surface-600 font-medium">Nog geen briefs</p>
                    <p className="text-surface-500 text-sm mt-1">
                      Ga naar Ideas en klik op &quot;Genereer Brief&quot; bij een opportunity
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setMainTab('ideas')}
                    >
                      <Lightbulb className="h-4 w-4 mr-2" />
                      Bekijk Ideas
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {briefs
                      .filter(b => briefStatusFilter === 'all' || b.status === briefStatusFilter)
                      .map((brief) => (
                        <BriefCard
                          key={brief.id}
                          brief={brief}
                          onClick={() => handleSelectBrief(brief)}
                        />
                      ))}
                    {briefs.filter(b => briefStatusFilter === 'all' || b.status === briefStatusFilter).length === 0 && (
                      <div className="text-center py-8 text-surface-500">
                        Geen briefs met status &quot;{briefStatusFilter}&quot;
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Brief Detail Dialog */}
      <Dialog open={!!selectedBrief} onOpenChange={() => setSelectedBrief(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogClose onClose={() => setSelectedBrief(null)} />
          {selectedBrief && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between pr-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={BRIEF_STATUS_COLORS[selectedBrief.status]}>
                        {BRIEF_STATUS_LABELS[selectedBrief.status]}
                      </Badge>
                      {selectedBrief.ideaTopic && (
                        <Badge variant="outline" className="text-xs">
                          Idea: {selectedBrief.ideaTopic}
                        </Badge>
                      )}
                    </div>
                    <DialogTitle className="text-xl">{selectedBrief.brief.key_claim}</DialogTitle>
                    <DialogDescription className="mt-2">
                      {selectedBrief.brief.core_tension}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Brief Content */}
                <div className="space-y-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <h4 className="font-medium text-primary mb-3 flex items-center gap-2">
                      <FileCheck className="h-4 w-4" />
                      Canonical Brief
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-surface-500 uppercase mb-1">Core Tension</p>
                        <p className="text-sm text-surface-900">{selectedBrief.brief.core_tension}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-surface-500 uppercase mb-1">Our Angle</p>
                        <p className="text-sm text-surface-900">{selectedBrief.brief.our_angle}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-surface-500 uppercase mb-1">Key Claim</p>
                        <p className="text-sm text-surface-900 font-medium">{selectedBrief.brief.key_claim}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-surface-500 uppercase mb-1">Proof Points</p>
                        <ul className="text-sm text-surface-900 list-disc list-inside">
                          {selectedBrief.brief.proof_points.map((point, idx) => (
                            <li key={idx}>{point}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-surface-500 uppercase mb-1">Why Now</p>
                        <p className="text-sm text-surface-900">{selectedBrief.brief.why_now}</p>
                      </div>
                      {selectedBrief.brief.no_go_claims && selectedBrief.brief.no_go_claims.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-red-500 uppercase mb-1">No-Go Claims</p>
                          <ul className="text-sm text-red-700 list-disc list-inside">
                            {selectedBrief.brief.no_go_claims.map((claim, idx) => (
                              <li key={idx}>{claim}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Evidence/Sources */}
                  {selectedBrief.evidence.length > 0 && (
                    <div>
                      <h4 className="font-medium text-surface-900 mb-3">
                        Bronnen ({selectedBrief.evidence.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedBrief.evidence.map((source, idx) => (
                          <div
                            key={idx}
                            className="bg-surface-50 rounded-lg p-3 flex items-start gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-surface-900 truncate">
                                {source.title}
                              </p>
                              {source.excerpt && (
                                <p className="text-xs text-surface-600 mt-1 line-clamp-2">
                                  {source.excerpt}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                                {source.upvotes && (
                                  <span className="flex items-center gap-1">
                                    <ArrowUp className="h-3 w-3" />
                                    {source.upvotes.toLocaleString()}
                                  </span>
                                )}
                                {source.comments && (
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    {source.comments.toLocaleString()}
                                  </span>
                                )}
                                {source.subreddit && (
                                  <span>r/{source.subreddit}</span>
                                )}
                              </div>
                            </div>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary-600"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generated Content from Brief */}
                  {selectedBrief.generations && selectedBrief.generations.length > 0 && (
                    <div>
                      <h4 className="font-medium text-surface-900 mb-3">
                        Gegenereerde Content ({selectedBrief.generations.length})
                      </h4>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="flex border-b bg-surface-50">
                          {(['youtube', 'instagram', 'blog'] as const).map((tab) => {
                            const hasContent = selectedBrief.generations?.some(g => g.channel === tab)
                            const Icon = CHANNEL_ICONS[tab]
                            return (
                              <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                  'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
                                  activeTab === tab
                                    ? 'bg-white border-b-2 border-primary text-primary'
                                    : 'text-surface-600 hover:text-surface-900',
                                  !hasContent && 'opacity-50'
                                )}
                              >
                                <Icon className="h-4 w-4" />
                                {CHANNEL_LABELS[tab]}
                                {hasContent && (
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                        <div className="p-4">
                          <BriefGeneratedContentView
                            generations={selectedBrief.generations?.filter(g => g.channel === activeTab) || []}
                            channel={activeTab}
                            onCopy={handleCopy}
                            copiedText={copiedText}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Generate Content Buttons (only for approved briefs) */}
                  {selectedBrief.status === 'approved' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-800 mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Content Genereren
                      </h4>
                      <p className="text-sm text-green-700 mb-3">
                        Deze brief is goedgekeurd. Genereer content voor een kanaal:
                      </p>
                      <div className="flex gap-2">
                        {(['youtube', 'instagram', 'blog'] as const).map((channel) => {
                          const Icon = CHANNEL_ICONS[channel]
                          const hasContent = selectedBrief.generations?.some(g => g.channel === channel)
                          return (
                            <Button
                              key={channel}
                              variant={hasContent ? 'outline' : 'default'}
                              size="sm"
                              onClick={() => handleGenerateContentFromBrief(channel)}
                              disabled={isGeneratingContent}
                            >
                              {isGeneratingContent ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Icon className="h-4 w-4 mr-1" />
                              )}
                              {CHANNEL_LABELS[channel]}
                              {hasContent && ' (opnieuw)'}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Actions Footer */}
              {selectedBrief.status === 'draft' && (
                <DialogFooter className="flex-row justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRegenerateAngle()}
                      disabled={isGeneratingBrief}
                      leftIcon={isGeneratingBrief ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    >
                      Andere invalshoek
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRejectBrief('Niet geschikt')}
                      disabled={isApprovingBrief}
                      leftIcon={<XCircle className="h-4 w-4" />}
                    >
                      Afkeuren
                    </Button>
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleApproveBrief}
                    disabled={isApprovingBrief}
                    isLoading={isApprovingBrief}
                    leftIcon={!isApprovingBrief ? <CheckCircle2 className="h-4 w-4" /> : undefined}
                  >
                    Goedkeuren
                  </Button>
                </DialogFooter>
              )}
              {selectedBrief.status === 'approved' && (
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedBrief(null)}
                  >
                    Sluiten
                  </Button>
                </DialogFooter>
              )}
              {selectedBrief.status === 'rejected' && (
                <DialogFooter className="flex-row justify-between">
                  <div className="text-sm text-red-600 flex items-center">
                    <XCircle className="h-4 w-4 mr-1" />
                    Afgekeurd{selectedBrief.rejectionReason && `: ${selectedBrief.rejectionReason}`}
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedBrief(null)}
                  >
                    Sluiten
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Opportunity Detail Dialog */}
      <Dialog open={!!selectedOpportunity} onOpenChange={() => setSelectedOpportunity(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogClose onClose={() => setSelectedOpportunity(null)} />
          {selectedOpportunity && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between pr-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={STATUS_COLORS[selectedOpportunity.status]}>
                        {STATUS_LABELS[selectedOpportunity.status]}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        {(() => {
                          const Icon = CHANNEL_ICONS[selectedOpportunity.channel]
                          return <Icon className="h-3 w-3" />
                        })()}
                        {CHANNEL_LABELS[selectedOpportunity.channel]}
                      </Badge>
                    </div>
                    <DialogTitle className="text-xl">{selectedOpportunity.topic}</DialogTitle>
                    <DialogDescription className="mt-2">
                      {selectedOpportunity.angle}
                    </DialogDescription>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-3xl font-bold text-primary">{selectedOpportunity.score}</div>
                    <div className="text-xs text-surface-500">Score</div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Hook & Reasoning */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-surface-50 rounded-lg p-4">
                    <h4 className="font-medium text-surface-900 mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Hook
                    </h4>
                    <p className="text-surface-700 text-sm">{selectedOpportunity.hook}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => handleCopy(selectedOpportunity.hook, 'hook')}
                    >
                      {copiedText === 'hook' ? (
                        <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-1" />
                      )}
                      Kopieer
                    </Button>
                  </div>
                  <div className="bg-surface-50 rounded-lg p-4">
                    <h4 className="font-medium text-surface-900 mb-2">Waarom dit werkt</h4>
                    <p className="text-surface-700 text-sm">{selectedOpportunity.reasoning}</p>
                  </div>
                </div>

                {/* Score Analyse */}
                <div>
                  <h4 className="font-medium text-surface-900 mb-3">Score Analyse</h4>
                  <div className="grid grid-cols-5 gap-3">
                    {Object.entries(selectedOpportunity.scoreBreakdown).map(([key, value]) => (
                      <div key={key} className="text-center">
                        <div className="relative h-2 bg-surface-200 rounded-full overflow-hidden mb-1">
                          <div
                            className="absolute left-0 top-0 h-full bg-primary rounded-full"
                            style={{ width: `${(value / 30) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-surface-600">{SCORE_LABELS[key] || key}</p>
                        <p className="text-sm font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Source Signals */}
                {isLoadingDetails ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {opportunitySignals.length > 0 && (
                      <div>
                        <h4 className="font-medium text-surface-900 mb-3">
                          Bronnen ({opportunitySignals.length})
                        </h4>
                        <div className="space-y-2">
                          {opportunitySignals.map((signal, idx) => (
                            <div
                              key={idx}
                              className="bg-surface-50 rounded-lg p-3 flex items-start gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-surface-900 truncate">
                                  {signal.title}
                                </p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                                  <span className="flex items-center gap-1">
                                    <ArrowUp className="h-3 w-3" />
                                    {signal.metrics.upvotes?.toLocaleString() || 0}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    {signal.metrics.comments?.toLocaleString() || 0}
                                  </span>
                                  {signal.community && (
                                    <span>r/{signal.community}</span>
                                  )}
                                </div>
                              </div>
                              <a
                                href={signal.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary-600"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Generated Content */}
                    {opportunityGenerations.length > 0 ? (
                      <div>
                        <h4 className="font-medium text-surface-900 mb-3">
                          Gegenereerde Content
                        </h4>
                        <div className="border rounded-lg overflow-hidden">
                          {/* Tabs */}
                          <div className="flex border-b bg-surface-50">
                            {(['youtube', 'instagram', 'blog'] as const).map((tab) => {
                              const hasContent = opportunityGenerations.some(g => g.channel === tab)
                              const Icon = CHANNEL_ICONS[tab]
                              return (
                                <button
                                  key={tab}
                                  onClick={() => setActiveTab(tab)}
                                  className={cn(
                                    'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
                                    activeTab === tab
                                      ? 'bg-white border-b-2 border-primary text-primary'
                                      : 'text-surface-600 hover:text-surface-900',
                                    !hasContent && 'opacity-50'
                                  )}
                                >
                                  <Icon className="h-4 w-4" />
                                  {CHANNEL_LABELS[tab]}
                                  {hasContent && (
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                  )}
                                </button>
                              )
                            })}
                          </div>
                          {/* Content */}
                          <div className="p-4">
                            <GeneratedContentView
                              generations={opportunityGenerations.filter(g => g.channel === activeTab)}
                              channel={activeTab}
                              onCopy={handleCopy}
                              copiedText={copiedText}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-surface-50 rounded-lg">
                        <Sparkles className="h-8 w-8 mx-auto text-surface-300 mb-2" />
                        <p className="text-surface-600 font-medium">Nog geen content gegenereerd</p>
                        <p className="text-surface-500 text-sm mb-4">
                          Genereer content voor deze opportunity
                        </p>
                        <Button
                          onClick={() => handleGenerate([selectedOpportunity.channel])}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                          )}
                          Genereer {CHANNEL_LABELS[selectedOpportunity.channel]} Content
                        </Button>
                      </div>
                    )}
                  </>
                )}

              </div>

              {/* Actions Footer */}
              <DialogFooter className="flex-row justify-between">
                <div className="flex gap-2">
                  {selectedOpportunity.status !== 'shortlisted' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateStatus(selectedOpportunity.id, 'shortlisted')}
                      leftIcon={<Star className="h-4 w-4" />}
                    >
                      Favoriet
                    </Button>
                  )}
                  {selectedOpportunity.status !== 'archived' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUpdateStatus(selectedOpportunity.id, 'archived')}
                      leftIcon={<Archive className="h-4 w-4" />}
                    >
                      Archiveer
                    </Button>
                  )}
                </div>
                {opportunityGenerations.length === 0 ? (
                  <Button
                    variant="primary"
                    onClick={() => handleGenerate(['youtube', 'instagram', 'blog'])}
                    disabled={isGenerating}
                    isLoading={isGenerating}
                    leftIcon={!isGenerating ? <Sparkles className="h-4 w-4" /> : undefined}
                  >
                    Genereer Alle Kanalen
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedOpportunity(null)}
                  >
                    Sluiten
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// Sub-Components
// ============================================

function OpportunityCard({
  opportunity,
  onClick,
  onStatusChange,
  onGenerateBrief,
  isGeneratingBrief,
}: {
  opportunity: Opportunity
  onClick: () => void
  onStatusChange: (status: Opportunity['status']) => void
  onGenerateBrief?: () => void
  isGeneratingBrief?: boolean
}) {
  const Icon = CHANNEL_ICONS[opportunity.channel]

  return (
    <div
      className="bg-white border rounded-lg p-4 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge className={cn('text-xs', STATUS_COLORS[opportunity.status])}>
              {STATUS_LABELS[opportunity.status]}
            </Badge>
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <Icon className="h-3 w-3" />
              {CHANNEL_LABELS[opportunity.channel]}
            </Badge>
          </div>
          <h3 className="font-medium text-surface-900 line-clamp-1">
            {opportunity.topic}
          </h3>
          <p className="text-sm text-surface-600 line-clamp-2 mt-1">
            {opportunity.angle}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-surface-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(opportunity.createdAt)}
            </span>
            <span>{opportunity.sourceSignalIds.length} bronnen</span>
          </div>
          {/* Generate Brief Button */}
          {onGenerateBrief && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={(e) => {
                e.stopPropagation()
                onGenerateBrief()
              }}
              disabled={isGeneratingBrief}
            >
              {isGeneratingBrief ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <FileCheck className="h-3 w-3 mr-1" />
              )}
              Genereer Brief
            </Button>
          )}
        </div>
        <div className="flex flex-col items-center">
          <div className="relative">
            <Progress
              value={opportunity.score}
              className="h-12 w-12 rounded-full"
            />
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
              {opportunity.score}
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-surface-400 mt-2" />
        </div>
      </div>
    </div>
  )
}

function BriefCard({
  brief,
  onClick,
}: {
  brief: Brief
  onClick: () => void
}) {
  return (
    <div
      className="bg-white border rounded-lg p-4 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge className={cn('text-xs', BRIEF_STATUS_COLORS[brief.status])}>
              {BRIEF_STATUS_LABELS[brief.status]}
            </Badge>
            {brief.generations && brief.generations.length > 0 && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {brief.generations.length} content
              </Badge>
            )}
          </div>
          <h3 className="font-medium text-surface-900 line-clamp-1">
            {brief.brief.key_claim}
          </h3>
          <p className="text-sm text-surface-600 line-clamp-2 mt-1">
            {brief.brief.core_tension}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-surface-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(brief.createdAt)}
            </span>
            <span>{brief.evidence.length} bronnen</span>
            {brief.ideaTopic && (
              <span className="truncate max-w-[150px]" title={brief.ideaTopic}>
                Idea: {brief.ideaTopic}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center">
          {brief.status === 'draft' && (
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
          )}
          {brief.status === 'approved' && (
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
          )}
          {brief.status === 'rejected' && (
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
          )}
          <ChevronRight className="h-4 w-4 text-surface-400 mt-2" />
        </div>
      </div>
    </div>
  )
}

function GeneratedContentView({
  generations,
  channel,
  onCopy,
  copiedText,
}: {
  generations: Generation[]
  channel: 'youtube' | 'instagram' | 'blog'
  onCopy: (text: string, label: string) => void
  copiedText: string | null
}) {
  if (generations.length === 0) {
    return (
      <div className="text-center py-6 text-surface-500">
        Geen content beschikbaar voor dit kanaal
      </div>
    )
  }

  const generation = generations[0]
  const output = generation.output as Record<string, unknown>

  if (channel === 'instagram') {
    return (
      <div className="space-y-4">
        {typeof output.caption === 'string' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium">Caption</h5>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(output.caption as string, 'caption')}
              >
                {copiedText === 'caption' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="bg-surface-50 rounded p-3 text-sm whitespace-pre-wrap">
              {String(output.caption)}
            </div>
          </div>
        )}
        {Array.isArray(output.hooks) && (
          <div>
            <h5 className="text-sm font-medium mb-2">Hook Opties</h5>
            <div className="space-y-2">
              {(output.hooks as string[]).map((hook, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-surface-50 rounded p-3">
                  <span className="text-xs font-bold text-primary">{idx + 1}</span>
                  <p className="text-sm flex-1">{hook}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCopy(hook, `hook-${idx}`)}
                  >
                    {copiedText === `hook-${idx}` ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        {Array.isArray(output.hashtags) && (
          <div>
            <h5 className="text-sm font-medium mb-2">Hashtags</h5>
            <div className="flex flex-wrap gap-1">
              {(output.hashtags as string[]).map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (channel === 'youtube') {
    return (
      <div className="space-y-4">
        {Array.isArray(output.titles) && (
          <div>
            <h5 className="text-sm font-medium mb-2">Title Opties</h5>
            {(output.titles as string[]).map((title, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-surface-50 rounded p-2 mb-1">
                <span className="text-xs font-bold text-primary">{idx + 1}</span>
                <p className="text-sm flex-1">{title}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopy(title, `title-${idx}`)}
                >
                  {copiedText === `title-${idx}` ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
        {typeof output.hook_script === 'string' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium">Hook Script (eerste 30 sec)</h5>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(output.hook_script as string, 'hook_script')}
              >
                {copiedText === 'hook_script' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="bg-surface-50 rounded p-3 text-sm whitespace-pre-wrap">
              {String(output.hook_script)}
            </div>
          </div>
        )}
        {typeof output.full_script === 'string' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium">Volledig Script</h5>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(output.full_script as string, 'full_script')}
              >
                {copiedText === 'full_script' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="bg-surface-50 rounded p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
              {String(output.full_script)}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (channel === 'blog') {
    return (
      <div className="space-y-4">
        {Array.isArray(output.titles) && (
          <div>
            <h5 className="text-sm font-medium mb-2">Title Opties</h5>
            {(output.titles as string[]).map((title, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-surface-50 rounded p-2 mb-1">
                <span className="text-xs font-bold text-primary">{idx + 1}</span>
                <p className="text-sm flex-1">{title}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopy(title, `blog-title-${idx}`)}
                >
                  {copiedText === `blog-title-${idx}` ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
        {typeof output.meta_description === 'string' && (
          <div>
            <h5 className="text-sm font-medium mb-2">Meta Description</h5>
            <div className="bg-surface-50 rounded p-3 text-sm">
              {String(output.meta_description)}
            </div>
          </div>
        )}
        {Array.isArray(output.outline) && (
          <div>
            <h5 className="text-sm font-medium mb-2">Outline</h5>
            <div className="space-y-2">
              {(output.outline as Array<{ type: string; text: string; key_points?: string[] }>).map((section, idx) => (
                <div key={idx} className="bg-surface-50 rounded p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{section.type}</Badge>
                    <span className="font-medium text-sm">{section.text}</span>
                  </div>
                  {section.key_points && (
                    <ul className="mt-2 text-xs text-surface-600 space-y-1">
                      {section.key_points.map((point, pidx) => (
                        <li key={pidx}>• {point}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-surface-50 rounded p-4">
      <pre className="text-xs overflow-auto max-h-64">
        {JSON.stringify(output, null, 2)}
      </pre>
    </div>
  )
}

function BriefGeneratedContentView({
  generations,
  channel,
  onCopy,
  copiedText,
}: {
  generations: BriefGeneration[]
  channel: 'youtube' | 'instagram' | 'blog'
  onCopy: (text: string, label: string) => void
  copiedText: string | null
}) {
  if (generations.length === 0) {
    return (
      <div className="text-center py-6 text-surface-500">
        Geen content beschikbaar voor dit kanaal
      </div>
    )
  }

  const generation = generations[0]
  const output = generation.output as Record<string, unknown>

  if (channel === 'instagram') {
    return (
      <div className="space-y-4">
        {typeof output.caption === 'string' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium">Caption</h5>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(output.caption as string, 'brief-caption')}
              >
                {copiedText === 'brief-caption' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="bg-surface-50 rounded p-3 text-sm whitespace-pre-wrap">
              {String(output.caption)}
            </div>
          </div>
        )}
        {Array.isArray(output.hooks) && (
          <div>
            <h5 className="text-sm font-medium mb-2">Hook Opties</h5>
            <div className="space-y-2">
              {(output.hooks as string[]).map((hook, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-surface-50 rounded p-3">
                  <span className="text-xs font-bold text-primary">{idx + 1}</span>
                  <p className="text-sm flex-1">{hook}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCopy(hook, `brief-hook-${idx}`)}
                  >
                    {copiedText === `brief-hook-${idx}` ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        {Array.isArray(output.hashtags) && (
          <div>
            <h5 className="text-sm font-medium mb-2">Hashtags</h5>
            <div className="flex flex-wrap gap-1">
              {(output.hashtags as string[]).map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (channel === 'youtube') {
    return (
      <div className="space-y-4">
        {Array.isArray(output.titles) && (
          <div>
            <h5 className="text-sm font-medium mb-2">Title Opties</h5>
            {(output.titles as string[]).map((title, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-surface-50 rounded p-2 mb-1">
                <span className="text-xs font-bold text-primary">{idx + 1}</span>
                <p className="text-sm flex-1">{title}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopy(title, `brief-title-${idx}`)}
                >
                  {copiedText === `brief-title-${idx}` ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
        {typeof output.hook_script === 'string' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium">Hook Script (eerste 30 sec)</h5>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(output.hook_script as string, 'brief-hook_script')}
              >
                {copiedText === 'brief-hook_script' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="bg-surface-50 rounded p-3 text-sm whitespace-pre-wrap">
              {String(output.hook_script)}
            </div>
          </div>
        )}
        {typeof output.full_script === 'string' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium">Volledig Script</h5>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(output.full_script as string, 'brief-full_script')}
              >
                {copiedText === 'brief-full_script' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="bg-surface-50 rounded p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
              {String(output.full_script)}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (channel === 'blog') {
    return (
      <div className="space-y-4">
        {/* SEO Title */}
        {typeof output.seo_title === 'string' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium">SEO Title</h5>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(output.seo_title as string, 'brief-seo-title')}
              >
                {copiedText === 'brief-seo-title' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="bg-surface-50 rounded p-3 text-sm font-medium">
              {String(output.seo_title)}
            </div>
          </div>
        )}
        {/* Fallback for titles array */}
        {!output.seo_title && Array.isArray(output.titles) && (
          <div>
            <h5 className="text-sm font-medium mb-2">Title Opties</h5>
            {(output.titles as string[]).map((title, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-surface-50 rounded p-2 mb-1">
                <span className="text-xs font-bold text-primary">{idx + 1}</span>
                <p className="text-sm flex-1">{title}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopy(title, `brief-blog-title-${idx}`)}
                >
                  {copiedText === `brief-blog-title-${idx}` ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
        {/* Meta Description */}
        {typeof output.meta_description === 'string' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium">Meta Description</h5>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(output.meta_description as string, 'brief-meta-desc')}
              >
                {copiedText === 'brief-meta-desc' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="bg-surface-50 rounded p-3 text-sm">
              {String(output.meta_description)}
            </div>
          </div>
        )}
        {/* Keywords */}
        {(output.primary_keyword || output.secondary_keywords) && (
          <div>
            <h5 className="text-sm font-medium mb-2">Keywords</h5>
            <div className="flex flex-wrap gap-1">
              {typeof output.primary_keyword === 'string' && (
                <Badge className="bg-primary text-white">{output.primary_keyword}</Badge>
              )}
              {Array.isArray(output.secondary_keywords) && (output.secondary_keywords as string[]).map((kw, idx) => (
                <Badge key={idx} variant="secondary">{kw}</Badge>
              ))}
            </div>
          </div>
        )}
        {/* Outline */}
        {Array.isArray(output.outline) && (
          <div>
            <h5 className="text-sm font-medium mb-2">Outline</h5>
            <div className="space-y-2">
              {(output.outline as Array<{ type: string; text: string; key_points?: string[] }>).map((section, idx) => (
                <div key={idx} className="bg-surface-50 rounded p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{section.type}</Badge>
                    <span className="font-medium text-sm">{section.text}</span>
                  </div>
                  {section.key_points && (
                    <ul className="mt-2 text-xs text-surface-600 space-y-1">
                      {section.key_points.map((point, pidx) => (
                        <li key={pidx}>• {point}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Full Draft - THE ACTUAL BLOG CONTENT */}
        {typeof output.full_draft === 'string' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium">Volledige Blog Post</h5>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(output.full_draft as string, 'brief-full-draft')}
              >
                {copiedText === 'brief-full-draft' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="bg-surface-50 rounded p-4 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto prose prose-sm max-w-none">
              {String(output.full_draft)}
            </div>
          </div>
        )}
        {/* FAQ Section */}
        {Array.isArray(output.faq) && (
          <div>
            <h5 className="text-sm font-medium mb-2">FAQ Sectie</h5>
            <div className="space-y-2">
              {(output.faq as Array<{ question: string; answer: string }>).map((item, idx) => (
                <div key={idx} className="bg-surface-50 rounded p-3">
                  <p className="font-medium text-sm">{item.question}</p>
                  <p className="text-sm text-surface-600 mt-1">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* CTA */}
        {output.cta && typeof output.cta === 'object' && (
          <div>
            <h5 className="text-sm font-medium mb-2">Call-to-Action</h5>
            <div className="bg-primary/10 border border-primary/20 rounded p-3">
              <p className="text-sm font-medium text-primary">
                {(output.cta as { type?: string; copy?: string }).type}
              </p>
              <p className="text-sm mt-1">
                {(output.cta as { type?: string; copy?: string }).copy}
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-surface-50 rounded p-4">
      <pre className="text-xs overflow-auto max-h-64">
        {JSON.stringify(output, null, 2)}
      </pre>
    </div>
  )
}
