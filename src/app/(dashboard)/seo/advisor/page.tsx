'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp,
  Search,
  Sparkles,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Target,
  Zap,
  HelpCircle,
  ExternalLink,
  Settings,
  Building2,
  RefreshCw,
  Clock,
} from 'lucide-react'
import { copyToClipboard, cn } from '@/lib/utils'
import { useSelectedClient } from '@/stores/client-store'
import { useClientPersistedState, useOnClientChange } from '@/hooks/use-persisted-form'
import type { ContentAdvisoryReport, RewriteSuggestion, FAQSuggestion } from '@/seo/types'

// Extended query type from API
interface QueryWithMentions {
  query: string
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  mentions: number
  inTitle: boolean
  inH1: boolean
  inH2: boolean
  isQuestion: boolean
}

type AnalysisStep = 'idle' | 'fetching-page' | 'fetching-sc' | 'analyzing' | 'generating' | 'done' | 'error'

// Types for persisted data
interface PersistedAnalysis {
  report: ContentAdvisoryReport | null
  rawData: {
    queries: QueryWithMentions[]
    pageContent: { title: string; metaDescription: string; h1: string[]; h2: string[]; wordCount: number }
    totals: { impressions: number; clicks: number; averagePosition: number }
  } | null
  pageUrl: string
  siteUrl: string
  analyzedAt: string | null
}

const initialAnalysis: PersistedAnalysis = {
  report: null,
  rawData: null,
  pageUrl: '',
  siteUrl: '',
  analyzedAt: null,
}

export default function SEOAdvisorPage() {
  const selectedClient = useSelectedClient()
  const clientScSettings = selectedClient?.settings?.searchConsole

  // Persisted analysis results (client-scoped)
  const [analysis, setAnalysis] = useClientPersistedState<PersistedAnalysis>('seo-advisor-analysis', initialAnalysis)

  // Reset state when client changes
  useOnClientChange(useCallback(() => {
    setAnalysis(initialAnalysis)
  }, [setAnalysis]))

  // Local UI state (not persisted)
  const [pageUrl, setPageUrl] = useState(analysis.pageUrl)
  const [siteUrl, setSiteUrl] = useState(analysis.siteUrl)
  const [step, setStep] = useState<AnalysisStep>(analysis.report ? 'done' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [showDataTable, setShowDataTable] = useState(true)

  // Derived state from persisted analysis
  const report = analysis.report
  const rawData = analysis.rawData

  // Debug: log when analysis changes
  useEffect(() => {
    console.log('[SEO Advisor] Analysis state changed:', {
      hasReport: !!report,
      hasRawData: !!rawData,
      step,
      analyzedAt: analysis.analyzedAt
    })
  }, [report, rawData, step, analysis.analyzedAt])

  // Pre-fill site URL from client settings (only if no persisted URL)
  useEffect(() => {
    if (!analysis.siteUrl && clientScSettings?.enabled && clientScSettings?.siteUrl) {
      setSiteUrl(clientScSettings.siteUrl)
    }
  }, [clientScSettings, analysis.siteUrl])

  const handleAnalyze = async () => {
    if (!pageUrl || !siteUrl) return

    setStep('fetching-page')
    setError(null)

    try {
      const response = await fetch('/api/seo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageUrl, siteUrl }),
      })

      const data = await response.json()
      console.log('[SEO Advisor] API response:', { success: data.success, hasReport: !!data.data, hasRawData: !!data.rawData })

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Analyse mislukt')
      }

      // Persist the analysis results
      const newAnalysis = {
        report: data.data,
        rawData: data.rawData,
        pageUrl,
        siteUrl,
        analyzedAt: new Date().toISOString(),
      }
      console.log('[SEO Advisor] Setting analysis:', { hasReport: !!newAnalysis.report, pageUrl: newAnalysis.pageUrl })
      setAnalysis(newAnalysis)
      setStep('done')
    } catch (err) {
      console.error('[SEO Advisor] Error:', err)
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
      setStep('error')
    }
  }

  const handleClearAnalysis = () => {
    setAnalysis(initialAnalysis)
    setPageUrl('')
    setSiteUrl(clientScSettings?.siteUrl || '')
    setStep('idle')
    setError(null)
    setActiveFilters(new Set())
  }

  // Filter logic
  const toggleFilter = (filter: string) => {
    const newFilters = new Set(activeFilters)
    if (newFilters.has(filter)) {
      newFilters.delete(filter)
    } else {
      newFilters.add(filter)
    }
    setActiveFilters(newFilters)
  }

  const filteredQueries = rawData?.queries.filter((q) => {
    if (activeFilters.size === 0) return true

    // Apply filters (OR logic - show if matches ANY active filter)
    if (activeFilters.has('no-mentions') && q.mentions === 0) return true
    if (activeFilters.has('page-2') && q.position >= 11 && q.position <= 20) return true
    if (activeFilters.has('questions') && q.isQuestion) return true
    if (activeFilters.has('high-impressions') && q.impressions >= 100) return true
    if (activeFilters.has('no-clicks') && q.clicks === 0 && q.impressions >= 50) return true
    if (activeFilters.has('top-10') && q.position <= 10) return true

    return activeFilters.size === 0
  }) || []

  const toggleSuggestion = (id: string) => {
    const newExpanded = new Set(expandedSuggestions)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedSuggestions(newExpanded)
  }

  const handleCopy = async (text: string, id: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const isLoading = ['fetching-page', 'fetching-sc', 'analyzing', 'generating'].includes(step)

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-surface-900">Content Advisory</h1>
              <Badge variant="secondary">Nieuw</Badge>
            </div>
            <p className="text-surface-600">
              Analyseer pagina&apos;s met Search Console data en krijg concrete SEO-optimalisatie adviezen.
            </p>
          </div>
          {analysis.analyzedAt && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-surface-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Laatste analyse
                </p>
                <p className="text-sm text-surface-600">
                  {new Date(analysis.analyzedAt).toLocaleString('nl-NL', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAnalysis}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Nieuwe analyse
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Analyse Starten</CardTitle>
            <CardDescription>
              Voer de URL in die je wilt analyseren
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="label">Pagina URL</label>
              <Input
                placeholder="https://jouwsite.nl/pagina"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                leftIcon={<FileText className="h-4 w-4" />}
              />
              <p className="text-xs text-surface-500 mt-1">
                De specifieke pagina die je wilt optimaliseren
              </p>
            </div>

            <div>
              <label className="label">Search Console Property</label>
              <Input
                placeholder="https://jouwsite.nl/"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
                disabled={clientScSettings?.enabled && !!clientScSettings?.siteUrl}
              />
              {clientScSettings?.enabled && clientScSettings?.siteUrl ? (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Gekoppeld via {selectedClient?.name}
                </p>
              ) : (
                <p className="text-xs text-surface-500 mt-1">
                  Je Search Console property (met trailing slash)
                </p>
              )}
            </div>

            {/* Client SC not configured notice */}
            {selectedClient && !clientScSettings?.enabled && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-amber-700 font-medium">Search Console niet gekoppeld</p>
                    <p className="text-amber-600 mt-0.5">
                      Koppel Search Console in de{' '}
                      <Link
                        href={`/clients/${selectedClient.id}?tab=settings`}
                        className="underline hover:no-underline"
                      >
                        client instellingen
                      </Link>
                      {' '}voor automatische integratie.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleAnalyze}
              isLoading={isLoading}
              className="w-full"
              size="lg"
              leftIcon={<Sparkles className="h-4 w-4" />}
              disabled={!pageUrl || !siteUrl || isLoading}
            >
              {isLoading ? getStepLabel(step) : 'Analyseer pagina'}
            </Button>

            {/* Progress Steps */}
            {isLoading && (
              <div className="space-y-2 pt-4">
                <ProgressStep
                  label="Pagina content ophalen"
                  status={step === 'fetching-page' ? 'active' : step === 'idle' ? 'pending' : 'done'}
                />
                <ProgressStep
                  label="Search Console data ophalen"
                  status={step === 'fetching-sc' ? 'active' : ['idle', 'fetching-page'].includes(step) ? 'pending' : 'done'}
                />
                <ProgressStep
                  label="Keywords analyseren"
                  status={step === 'analyzing' ? 'active' : ['idle', 'fetching-page', 'fetching-sc'].includes(step) ? 'pending' : 'done'}
                />
                <ProgressStep
                  label="AI-adviezen genereren"
                  status={step === 'generating' ? 'active' : step === 'done' ? 'done' : 'pending'}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Analyse mislukt</p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {report && (
            <>
              {/* Score & Summary */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0">
                      <div className={cn(
                        'w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white',
                        report.overallScore >= 70 ? 'bg-green-500' :
                        report.overallScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      )}>
                        {report.overallScore}
                      </div>
                      <p className="text-xs text-center text-surface-500 mt-1">SEO Score</p>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-surface-900 mb-2">Samenvatting</h3>
                      <p className="text-surface-600 text-sm">{report.executiveSummary}</p>

                      {report.topPriorities.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-surface-700 mb-2">Top Prioriteiten:</p>
                          <ul className="space-y-1">
                            {report.topPriorities.map((priority, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-surface-600">
                                <span className="text-primary font-medium">{i + 1}.</span>
                                {priority}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={FileText}
                  label="Woorden"
                  value={report.currentState.wordCount.toLocaleString()}
                />
                <StatCard
                  icon={Search}
                  label="Queries"
                  value={report.keywordAnalysis.totalQueriesAnalyzed}
                />
                <StatCard
                  icon={Target}
                  label="High Priority"
                  value={report.keywordAnalysis.highPriorityOpportunities}
                  highlight
                />
                <StatCard
                  icon={Zap}
                  label="Suggesties"
                  value={report.suggestions.length}
                />
              </div>

              {/* Missing Keywords */}
              {report.keywordAnalysis.topMissingKeywords.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ontbrekende Keywords</CardTitle>
                    <CardDescription>
                      Deze keywords genereren impressies maar staan niet in je content
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {report.keywordAnalysis.topMissingKeywords.map((kw, i) => (
                        <Badge key={i} variant="outline" className="bg-orange-50 border-orange-200 text-orange-700">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Suggestions */}
              {report.suggestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Optimalisatie Suggesties</CardTitle>
                    <CardDescription>
                      Klik op een suggestie voor details en voorbeeldtekst
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {report.suggestions.map((suggestion) => (
                      <SuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        isExpanded={expandedSuggestions.has(suggestion.id)}
                        onToggle={() => toggleSuggestion(suggestion.id)}
                        onCopy={(text) => handleCopy(text, suggestion.id)}
                        isCopied={copiedId === suggestion.id}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* FAQ Suggestions */}
              {report.faqSuggestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <HelpCircle className="h-5 w-5" />
                      Voorgestelde FAQs
                    </CardTitle>
                    <CardDescription>
                      Voeg deze vragen toe voor betere featured snippets
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {report.faqSuggestions.map((faq, i) => (
                      <FAQCard
                        key={i}
                        faq={faq}
                        onCopy={(text) => handleCopy(text, `faq-${i}`)}
                        isCopied={copiedId === `faq-${i}`}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Raw Data Table */}
              {rawData && rawData.queries.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Search className="h-5 w-5" />
                          Search Console Queries ({filteredQueries.length}/{rawData.queries.length})
                        </CardTitle>
                        <CardDescription>
                          Klik op filters om specifieke kansen te vinden
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDataTable(!showDataTable)}
                      >
                        {showDataTable ? 'Verberg' : 'Toon'} tabel
                      </Button>
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      <FilterButton
                        active={activeFilters.has('no-mentions')}
                        onClick={() => toggleFilter('no-mentions')}
                        count={rawData.queries.filter(q => q.mentions === 0).length}
                      >
                        No Mentions
                      </FilterButton>
                      <FilterButton
                        active={activeFilters.has('page-2')}
                        onClick={() => toggleFilter('page-2')}
                        count={rawData.queries.filter(q => q.position >= 11 && q.position <= 20).length}
                      >
                        On Page 2
                      </FilterButton>
                      <FilterButton
                        active={activeFilters.has('questions')}
                        onClick={() => toggleFilter('questions')}
                        count={rawData.queries.filter(q => q.isQuestion).length}
                      >
                        Questions
                      </FilterButton>
                      <FilterButton
                        active={activeFilters.has('high-impressions')}
                        onClick={() => toggleFilter('high-impressions')}
                        count={rawData.queries.filter(q => q.impressions >= 100).length}
                      >
                        Impressions &gt; 100
                      </FilterButton>
                      <FilterButton
                        active={activeFilters.has('no-clicks')}
                        onClick={() => toggleFilter('no-clicks')}
                        count={rawData.queries.filter(q => q.clicks === 0 && q.impressions >= 50).length}
                      >
                        No Clicks
                      </FilterButton>
                      <FilterButton
                        active={activeFilters.has('top-10')}
                        onClick={() => toggleFilter('top-10')}
                        count={rawData.queries.filter(q => q.position <= 10).length}
                      >
                        Top 10
                      </FilterButton>
                      {activeFilters.size > 0 && (
                        <button
                          onClick={() => setActiveFilters(new Set())}
                          className="text-sm text-surface-500 hover:text-surface-700 underline"
                        >
                          Reset filters
                        </button>
                      )}
                    </div>
                  </CardHeader>

                  {showDataTable && (
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-surface-50 border-y border-surface-200">
                            <tr>
                              <th className="text-left py-3 px-4 font-medium text-surface-600">Query</th>
                              <th className="text-center py-3 px-2 font-medium text-surface-600 w-20">Mentions</th>
                              <th className="text-right py-3 px-2 font-medium text-surface-600 w-24">Impressies</th>
                              <th className="text-right py-3 px-2 font-medium text-surface-600 w-20">Clicks</th>
                              <th className="text-right py-3 px-2 font-medium text-surface-600 w-20">Positie</th>
                              <th className="text-right py-3 px-4 font-medium text-surface-600 w-16">CTR</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-100">
                            {filteredQueries.slice(0, 50).map((q, i) => (
                              <tr key={i} className="hover:bg-surface-50">
                                <td className="py-2.5 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "font-medium",
                                      q.mentions === 0 && "text-orange-600"
                                    )}>
                                      {q.query}
                                    </span>
                                    {q.isQuestion && (
                                      <Badge variant="outline" className="text-xs">?</Badge>
                                    )}
                                  </div>
                                  <div className="flex gap-1 mt-0.5">
                                    {q.inTitle && <Badge className="text-[10px] py-0 px-1 bg-green-100 text-green-700">Title</Badge>}
                                    {q.inH1 && <Badge className="text-[10px] py-0 px-1 bg-blue-100 text-blue-700">H1</Badge>}
                                    {q.inH2 && <Badge className="text-[10px] py-0 px-1 bg-purple-100 text-purple-700">H2</Badge>}
                                  </div>
                                </td>
                                <td className="text-center py-2.5 px-2">
                                  <span className={cn(
                                    "inline-flex items-center justify-center w-8 h-6 rounded text-xs font-medium",
                                    q.mentions === 0
                                      ? "bg-orange-100 text-orange-700"
                                      : q.mentions >= 3
                                        ? "bg-green-100 text-green-700"
                                        : "bg-surface-100 text-surface-600"
                                  )}>
                                    {q.mentions}
                                  </span>
                                </td>
                                <td className="text-right py-2.5 px-2 text-surface-600">
                                  {q.impressions.toLocaleString()}
                                </td>
                                <td className="text-right py-2.5 px-2 text-surface-600">
                                  {q.clicks.toLocaleString()}
                                </td>
                                <td className="text-right py-2.5 px-2">
                                  <span className={cn(
                                    "font-medium",
                                    q.position <= 3 ? "text-green-600" :
                                    q.position <= 10 ? "text-blue-600" :
                                    q.position <= 20 ? "text-orange-600" : "text-surface-500"
                                  )}>
                                    {q.position.toFixed(1)}
                                  </span>
                                </td>
                                <td className="text-right py-2.5 px-4 text-surface-500">
                                  {(q.ctr * 100).toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {filteredQueries.length > 50 && (
                          <div className="text-center py-3 text-sm text-surface-500 bg-surface-50 border-t border-surface-200">
                            Toont eerste 50 van {filteredQueries.length} resultaten
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}
            </>
          )}

          {/* Loading complete but no report - debug state */}
          {step === 'done' && !report && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Geen resultaten</p>
                  <p className="text-sm text-yellow-600 mt-1">
                    De analyse is voltooid maar er zijn geen resultaten. Check de browser console voor meer informatie.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleClearAnalysis}
                  >
                    Opnieuw proberen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {step === 'idle' && !report && (
            <Card>
              <CardContent className="py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-surface-400" />
                </div>
                <p className="text-surface-600 font-medium">Voer een URL in om te starten</p>
                <p className="text-sm text-surface-400 mt-1">
                  We analyseren je pagina en Search Console data
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function getStepLabel(step: AnalysisStep): string {
  switch (step) {
    case 'fetching-page': return 'Pagina ophalen...'
    case 'fetching-sc': return 'Search Console laden...'
    case 'analyzing': return 'Analyseren...'
    case 'generating': return 'AI advies genereren...'
    default: return 'Bezig...'
  }
}

function ProgressStep({ label, status }: { label: string; status: 'pending' | 'active' | 'done' }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        'w-5 h-5 rounded-full flex items-center justify-center',
        status === 'done' && 'bg-green-500',
        status === 'active' && 'bg-primary animate-pulse',
        status === 'pending' && 'bg-surface-200'
      )}>
        {status === 'done' && <CheckCircle className="h-3 w-3 text-white" />}
        {status === 'active' && <div className="w-2 h-2 bg-white rounded-full" />}
      </div>
      <span className={cn(
        'text-sm',
        status === 'done' && 'text-green-600',
        status === 'active' && 'text-primary font-medium',
        status === 'pending' && 'text-surface-400'
      )}>
        {label}
      </span>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, highlight }: {
  icon: typeof FileText
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <Card className={highlight ? 'border-primary/30 bg-primary/5' : ''}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center',
          highlight ? 'bg-primary/20' : 'bg-surface-100'
        )}>
          <Icon className={cn('h-5 w-5', highlight ? 'text-primary' : 'text-surface-500')} />
        </div>
        <div>
          <p className={cn('text-xl font-bold', highlight ? 'text-primary' : 'text-surface-900')}>
            {value}
          </p>
          <p className="text-xs text-surface-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function SuggestionCard({
  suggestion,
  isExpanded,
  onToggle,
  onCopy,
  isCopied,
}: {
  suggestion: RewriteSuggestion
  isExpanded: boolean
  onToggle: () => void
  onCopy: (text: string) => void
  isCopied: boolean
}) {
  const priorityColors = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-green-100 text-green-700 border-green-200',
  }

  const typeLabels: Record<string, string> = {
    title: 'Title',
    meta_description: 'Meta Description',
    h1: 'H1',
    h2: 'H2',
    body_section: 'Body',
    faq: 'FAQ',
    new_section: 'Nieuwe Sectie',
  }

  return (
    <div className="border border-surface-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-3 hover:bg-surface-50 transition-colors text-left"
      >
        <Badge className={priorityColors[suggestion.priority]}>
          {suggestion.priority === 'high' ? 'Hoog' : suggestion.priority === 'medium' ? 'Medium' : 'Laag'}
        </Badge>
        <Badge variant="outline">{typeLabels[suggestion.type] || suggestion.type}</Badge>
        <span className="flex-1 font-medium text-surface-900 truncate">
          {suggestion.location}
        </span>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-surface-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-surface-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-surface-100">
          {suggestion.currentContent && (
            <div className="pt-4">
              <p className="text-sm font-medium text-surface-500 mb-1">Huidige tekst:</p>
              <p className="text-sm text-surface-600 bg-surface-50 p-3 rounded">{suggestion.currentContent}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-surface-500">Voorgestelde tekst:</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(suggestion.suggestedContent)}
              >
                {isCopied ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-surface-900 bg-green-50 p-3 rounded border border-green-200">
              {suggestion.suggestedContent}
            </p>
          </div>

          {suggestion.targetKeywords.length > 0 && (
            <div>
              <p className="text-sm font-medium text-surface-500 mb-1">Target keywords:</p>
              <div className="flex flex-wrap gap-1">
                {suggestion.targetKeywords.map((kw, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-sm font-medium text-surface-500 mb-1">Waarom:</p>
              <p className="text-sm text-surface-600">{suggestion.reasoning}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-surface-500 mb-1">Verwachte impact:</p>
              <p className="text-sm text-surface-600">{suggestion.expectedImpact}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean
  onClick: () => void
  count: number
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
        active
          ? 'bg-primary text-white border-primary'
          : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300 hover:bg-surface-50'
      )}
    >
      {children}
      <span className={cn(
        'text-xs px-1.5 py-0.5 rounded-full',
        active ? 'bg-white/20 text-white' : 'bg-surface-100 text-surface-500'
      )}>
        {count}
      </span>
    </button>
  )
}

function FAQCard({
  faq,
  onCopy,
  isCopied,
}: {
  faq: FAQSuggestion
  onCopy: (text: string) => void
  isCopied: boolean
}) {
  const fullText = `Q: ${faq.question}\nA: ${faq.answer}`

  return (
    <div className="p-4 bg-surface-50 rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium text-surface-900">{faq.question}</p>
          <p className="text-sm text-surface-600 mt-1">{faq.answer}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">{faq.targetKeyword}</Badge>
            <Badge variant="outline" className="text-xs capitalize">{faq.searchIntent}</Badge>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onCopy(fullText)}>
          {isCopied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
