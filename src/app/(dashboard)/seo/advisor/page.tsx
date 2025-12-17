'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { copyToClipboard, cn } from '@/lib/utils'
import type { ContentAdvisoryReport, RewriteSuggestion, FAQSuggestion } from '@/seo/types'

type AnalysisStep = 'idle' | 'fetching-page' | 'fetching-sc' | 'analyzing' | 'generating' | 'done' | 'error'

export default function SEOAdvisorPage() {
  const [pageUrl, setPageUrl] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [step, setStep] = useState<AnalysisStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ContentAdvisoryReport | null>(null)
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleAnalyze = async () => {
    if (!pageUrl || !siteUrl) return

    setStep('fetching-page')
    setError(null)
    setReport(null)

    try {
      const response = await fetch('/api/seo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageUrl, siteUrl }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Analyse mislukt')
      }

      setReport(data.data)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
      setStep('error')
    }
  }

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
              />
              <p className="text-xs text-surface-500 mt-1">
                Je Search Console property (met trailing slash)
              </p>
            </div>

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
            </>
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
