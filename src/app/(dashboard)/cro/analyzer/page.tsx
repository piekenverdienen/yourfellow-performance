'use client'

import { useState, useCallback } from 'react'
import { useSelectedClientId } from '@/stores/client-store'
import { usePersistedState, useClientPersistedState, useOnClientChange } from '@/hooks/use-persisted-form'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  Globe,
  MessageSquare,
  CheckCircle,
  TrendingUp,
  Download,
  Loader2,
  AlertTriangle,
  ShoppingCart,
  Users,
  Star,
  Clock,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CialdiniPrinciple {
  name: string
  score: number
  found_elements: string[]
  suggestions: string[]
}

interface AnalysisResult {
  overall_score: number
  principles: CialdiniPrinciple[]
  top_improvements: string[]
}

interface ExtractedElements {
  headings: { level: number; text: string }[]
  ctas: string[]
  testimonials: string[]
  trustSignals: string[]
  forms: { fields: number; hasEmail: boolean; hasPhone: boolean }[]
  prices: string[]
  urgencyElements: string[]
}

interface FetchedPageData {
  url: string
  title: string
  description: string
  markdown: string
  metadata: {
    ogTitle?: string
    ogDescription?: string
    ogImage?: string
    language?: string
  }
  extractedElements: ExtractedElements
}

const principleColors: Record<string, string> = {
  'Wederkerigheid': 'bg-blue-500',
  'Schaarste': 'bg-orange-500',
  'Autoriteit': 'bg-purple-500',
  'Consistentie': 'bg-green-500',
  'Sympathie': 'bg-pink-500',
  'Sociale bewijskracht': 'bg-yellow-500',
}

const initialFormData = {
  url: '',
  pageContent: '',
  pageType: '',
}

export default function CROAnalyzerPage() {
  const clientId = useSelectedClientId()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [formData, setFormData] = usePersistedState('cro-analyzer-form', initialFormData)
  const [analysisResult, setAnalysisResult] = useClientPersistedState<AnalysisResult | null>('cro-analyzer-result', null)
  const [fetchedData, setFetchedData] = useClientPersistedState<FetchedPageData | null>('cro-analyzer-fetched', null)
  const [error, setError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Reset state when client changes
  useOnClientChange(useCallback(() => {
    setAnalysisResult(null)
    setFetchedData(null)
    setError(null)
    setFetchError(null)
  }, [setAnalysisResult, setFetchedData]))

  const handleFetchPage = async () => {
    if (!formData.url) {
      setFetchError('Voer eerst een URL in')
      return
    }

    setIsFetching(true)
    setFetchError(null)
    setFetchedData(null)

    try {
      const response = await fetch('/api/fetch-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: formData.url }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Kon pagina niet ophalen')
      }

      const pageData = data.data as FetchedPageData
      setFetchedData(pageData)

      // Auto-fill the page content
      setFormData({
        ...formData,
        pageContent: pageData.markdown,
        pageType: detectPageType(pageData),
      })

    } catch (err) {
      console.error('Fetch error:', err)
      setFetchError(err instanceof Error ? err.message : 'Er ging iets mis bij het ophalen')
    } finally {
      setIsFetching(false)
    }
  }

  const detectPageType = (data: FetchedPageData): string => {
    const content = data.markdown.toLowerCase()
    const url = data.url.toLowerCase()

    if (url.includes('/product') || data.extractedElements.prices.length > 0) {
      return 'Product pagina'
    }
    if (url.includes('/checkout') || url.includes('/cart') || url.includes('/winkelwagen')) {
      return 'Checkout pagina'
    }
    if (url.includes('/contact') || content.includes('neem contact')) {
      return 'Contact pagina'
    }
    if (url.includes('/pricing') || url.includes('/prijzen')) {
      return 'Pricing pagina'
    }
    if (url.includes('/about') || url.includes('/over-ons')) {
      return 'Over ons pagina'
    }
    if (data.extractedElements.forms.length > 0 && data.extractedElements.forms.some(f => f.hasEmail)) {
      return 'Lead generation pagina'
    }
    if (url === new URL(data.url).origin + '/' || url.endsWith('.com') || url.endsWith('.nl')) {
      return 'Homepage'
    }
    return 'Landingspagina'
  }

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setError(null)

    try {
      // Build enriched prompt with extracted elements if available
      let enrichedContent = formData.pageContent

      if (fetchedData?.extractedElements) {
        const elements = fetchedData.extractedElements
        const enrichments = []

        if (elements.ctas.length > 0) {
          enrichments.push(`\n\n[GEDETECTEERDE CTA'S]: ${elements.ctas.join(', ')}`)
        }
        if (elements.testimonials.length > 0) {
          enrichments.push(`\n\n[GEDETECTEERDE TESTIMONIALS]: ${elements.testimonials.join(' | ')}`)
        }
        if (elements.trustSignals.length > 0) {
          enrichments.push(`\n\n[GEDETECTEERDE TRUST SIGNALS]: ${elements.trustSignals.join(', ')}`)
        }
        if (elements.prices.length > 0) {
          enrichments.push(`\n\n[GEDETECTEERDE PRIJZEN]: ${elements.prices.join(', ')}`)
        }
        if (elements.urgencyElements.length > 0) {
          enrichments.push(`\n\n[GEDETECTEERDE URGENCY ELEMENTEN]: ${elements.urgencyElements.join(', ')}`)
        }
        if (elements.forms.length > 0) {
          enrichments.push(`\n\n[GEDETECTEERDE FORMULIEREN]: ${elements.forms.map(f => `${f.fields} velden${f.hasEmail ? ', email' : ''}${f.hasPhone ? ', telefoon' : ''}`).join(' | ')}`)
        }

        enrichedContent += enrichments.join('')
      }

      const prompt = `Analyseer de volgende landingspagina op basis van Cialdini's 6 overtuigingsprincipes:

URL: ${formData.url || 'Niet opgegeven'}
Type pagina: ${formData.pageType || 'Landingspagina'}

Pagina inhoud:
${enrichedContent}

Geef een score van 0-10 voor elk principe en concrete verbeterpunten.`

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'cro-analyzer',
          prompt,
          clientId: clientId || undefined,
          options: {},
        }),
      })

      if (!response.ok) {
        throw new Error('Er ging iets mis bij het analyseren')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Analyse mislukt')
      }

      // Strip markdown code blocks if present
      let resultText = data.result
      if (resultText.startsWith('```')) {
        resultText = resultText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      const parsedResult = JSON.parse(resultText)
      setAnalysisResult(parsedResult)
    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Er ging iets mis. Probeer het opnieuw.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    if (score >= 4) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 8) return 'bg-green-100'
    if (score >= 6) return 'bg-yellow-100'
    if (score >= 4) return 'bg-orange-100'
    return 'bg-red-100'
  }

  const hasExtractedElements = fetchedData?.extractedElements && (
    fetchedData.extractedElements.ctas.length > 0 ||
    fetchedData.extractedElements.testimonials.length > 0 ||
    fetchedData.extractedElements.trustSignals.length > 0 ||
    fetchedData.extractedElements.prices.length > 0 ||
    fetchedData.extractedElements.urgencyElements.length > 0 ||
    fetchedData.extractedElements.forms.length > 0
  )

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-brand">
            <BarChart3 className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">CRO Analyzer</h1>
        </div>
        <p className="text-surface-600">
          Analyseer je landingspaginas op basis van Cialdinis 6 overtuigingsprincipes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pagina Analyse</CardTitle>
              <CardDescription>
                Voer een URL in om de pagina automatisch op te halen en te analyseren
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="label">Pagina URL</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/landing"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    leftIcon={<Globe className="h-4 w-4" />}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleFetchPage}
                    variant="outline"
                    disabled={isFetching || !formData.url}
                    className="shrink-0"
                  >
                    {isFetching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span className="ml-2">{isFetching ? 'Ophalen...' : 'Fetch'}</span>
                  </Button>
                </div>
                {fetchError && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {fetchError}
                  </p>
                )}
                {fetchedData && (
                  <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    Pagina opgehaald: {fetchedData.title || 'Geen titel'}
                  </p>
                )}
              </div>

              <div>
                <label className="label">Type pagina</label>
                <Input
                  placeholder="bijv. Product landingspagina, Diensten pagina"
                  value={formData.pageType}
                  onChange={(e) => setFormData({ ...formData, pageType: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Pagina inhoud</label>
                <Textarea
                  placeholder="Kopieer en plak hier de tekst van je landingspagina, of gebruik de Fetch knop om automatisch op te halen..."
                  value={formData.pageContent}
                  onChange={(e) => setFormData({ ...formData, pageContent: e.target.value })}
                  className="min-h-[200px]"
                />
                {formData.pageContent && (
                  <p className="mt-1 text-xs text-surface-500">
                    {formData.pageContent.length.toLocaleString()} karakters
                  </p>
                )}
              </div>

              <Button
                onClick={handleAnalyze}
                isLoading={isAnalyzing}
                className="w-full"
                size="lg"
                leftIcon={<Sparkles className="h-4 w-4" />}
                disabled={!formData.pageContent}
              >
                {isAnalyzing ? 'Analyseren...' : 'Analyseer pagina'}
              </Button>
            </CardContent>
          </Card>

          {/* Extracted Elements Preview */}
          {hasExtractedElements && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gedetecteerde Elementen</CardTitle>
                <CardDescription>
                  Automatisch herkend op de pagina
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fetchedData.extractedElements.ctas.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-surface-700 mb-2">
                      <ShoppingCart className="h-4 w-4" />
                      CTAs ({fetchedData.extractedElements.ctas.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {fetchedData.extractedElements.ctas.slice(0, 5).map((cta, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{cta}</Badge>
                      ))}
                      {fetchedData.extractedElements.ctas.length > 5 && (
                        <Badge variant="outline" className="text-xs">+{fetchedData.extractedElements.ctas.length - 5}</Badge>
                      )}
                    </div>
                  </div>
                )}

                {fetchedData.extractedElements.trustSignals.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-surface-700 mb-2">
                      <Star className="h-4 w-4" />
                      Trust Signals ({fetchedData.extractedElements.trustSignals.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {fetchedData.extractedElements.trustSignals.slice(0, 5).map((signal, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{signal}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {fetchedData.extractedElements.urgencyElements.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-surface-700 mb-2">
                      <Clock className="h-4 w-4" />
                      Urgency ({fetchedData.extractedElements.urgencyElements.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {fetchedData.extractedElements.urgencyElements.map((el, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{el}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {fetchedData.extractedElements.testimonials.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-surface-700 mb-2">
                      <Users className="h-4 w-4" />
                      Testimonials ({fetchedData.extractedElements.testimonials.length})
                    </div>
                    <p className="text-xs text-surface-600 italic">
                      {fetchedData.extractedElements.testimonials[0].slice(0, 100)}...
                    </p>
                  </div>
                )}

                {fetchedData.extractedElements.forms.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-surface-700 mb-2">
                      <FileText className="h-4 w-4" />
                      Formulieren ({fetchedData.extractedElements.forms.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {fetchedData.extractedElements.forms.map((form, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {form.fields} velden
                          {form.hasEmail && ' + email'}
                          {form.hasPhone && ' + telefoon'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {fetchedData.extractedElements.prices.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-surface-700 mb-2">
                      Prijzen ({fetchedData.extractedElements.prices.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {fetchedData.extractedElements.prices.map((price, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{price}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Output */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Analyse Resultaat</CardTitle>
              <CardDescription>
                Score per overtuigingsprincipe
              </CardDescription>
            </div>
            {analysisResult && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAnalyze}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Opnieuw
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <p className="font-medium">Fout bij analyseren</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4 animate-pulse">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <p className="text-surface-600">AI is aan het analyseren...</p>
                <p className="text-sm text-surface-400 mt-1">Dit kan even duren</p>
              </div>
            ) : analysisResult ? (
              <div className="space-y-6">
                {/* Overall Score */}
                <div className={cn(
                  'p-6 rounded-xl text-center',
                  getScoreBgColor(analysisResult.overall_score)
                )}>
                  <p className="text-sm text-surface-600 mb-1">Overall Score</p>
                  <p className={cn('text-5xl font-bold', getScoreColor(analysisResult.overall_score))}>
                    {analysisResult.overall_score}/10
                  </p>
                </div>

                {/* Principles */}
                <div className="space-y-4">
                  <h4 className="font-medium text-surface-900">Score per principe</h4>
                  {analysisResult.principles.map((principle, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'w-3 h-3 rounded-full',
                            principleColors[principle.name] || 'bg-gray-500'
                          )} />
                          <span className="font-medium text-surface-900">{principle.name}</span>
                        </div>
                        <span className={cn('font-bold', getScoreColor(principle.score))}>
                          {principle.score}/10
                        </span>
                      </div>
                      <Progress value={principle.score * 10} className="h-2" />

                      {/* Found elements */}
                      {principle.found_elements.length > 0 && (
                        <div className="pl-5 space-y-1">
                          {principle.found_elements.map((element, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                              <span className="text-surface-600">{element}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Suggestions */}
                      {principle.suggestions.length > 0 && (
                        <div className="pl-5 space-y-1">
                          {principle.suggestions.map((suggestion, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <TrendingUp className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                              <span className="text-surface-600">{suggestion}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Top Improvements */}
                {analysisResult.top_improvements.length > 0 && (
                  <div>
                    <h4 className="font-medium text-surface-900 mb-3">Top 3 verbeterpunten</h4>
                    <div className="space-y-2">
                      {analysisResult.top_improvements.map((improvement, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
                          <Badge variant="primary" className="flex-shrink-0">{index + 1}</Badge>
                          <span className="text-surface-700">{improvement}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback */}
                <div className="pt-4 border-t border-surface-200">
                  <p className="text-sm text-surface-500 mb-3">Was deze analyse nuttig?</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" leftIcon={<ThumbsUp className="h-4 w-4" />}>
                      Ja, goed!
                    </Button>
                    <Button variant="outline" size="sm" leftIcon={<ThumbsDown className="h-4 w-4" />}>
                      Kan beter
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
                  <MessageSquare className="h-8 w-8 text-surface-400" />
                </div>
                <p className="text-surface-600">Voer een URL in en klik op Fetch</p>
                <p className="text-sm text-surface-400 mt-1">
                  Of plak handmatig je pagina-inhoud
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
