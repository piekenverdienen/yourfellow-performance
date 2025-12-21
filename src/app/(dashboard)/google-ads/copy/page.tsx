'use client'

import { useState, useCallback } from 'react'
import { useSelectedClientId } from '@/stores/client-store'
import { usePersistedState, useClientPersistedState, useOnClientChange } from '@/hooks/use-persisted-form'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  Copy,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  Wand2,
  Target,
  Users,
  MessageSquare,
  Link,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import { cn, copyToClipboard } from '@/lib/utils'

// Type for Firecrawl response
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
  extractedElements: {
    headings: { level: number; text: string }[]
    ctas: string[]
    testimonials: string[]
    trustSignals: string[]
    forms: { fields: number; hasEmail: boolean; hasPhone: boolean }[]
    prices: string[]
    urgencyElements: string[]
  }
}

const toneOptions = [
  { value: 'professional', label: 'Professioneel' },
  { value: 'casual', label: 'Casual' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'friendly', label: 'Vriendelijk' },
]

const adTypeOptions = [
  { value: 'responsive_search', label: 'Responsive Search Ads' },
  { value: 'responsive_display', label: 'Responsive Display Ads' },
  { value: 'performance_max', label: 'Performance Max' },
]

const languageOptions = [
  { value: 'nl', label: 'Nederlands' },
  { value: 'en', label: 'Engels' },
  { value: 'de', label: 'Duits' },
]

interface GeneratedAd {
  headlines: string[]
  descriptions: string[]
}

const initialFormData = {
  landingPageUrl: '',
  productName: '',
  productDescription: '',
  targetAudience: '',
  keywords: '',
  tone: 'professional',
  adType: 'responsive_search',
  language: 'nl',
}

export default function GoogleAdsCopyPage() {
  const clientId = useSelectedClientId()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [formData, setFormData] = usePersistedState('google-ads-form', initialFormData)
  const [generatedAd, setGeneratedAd] = useClientPersistedState<GeneratedAd | null>('google-ads-result', null)
  const [fetchedPageData, setFetchedPageData] = useClientPersistedState<FetchedPageData | null>('google-ads-fetched-page', null)
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [showLandingPagePreview, setShowLandingPagePreview] = useState(true)
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [campaignName, setCampaignName] = useState('AI Generated Campaign')
  const [adGroupName, setAdGroupName] = useState('General')
  const [path1, setPath1] = useState('')
  const [path2, setPath2] = useState('')

  // Reset state when client changes
  useOnClientChange(useCallback(() => {
    setGeneratedAd(null)
    setFetchedPageData(null)
    setError(null)
    setAnalyzeError(null)
  }, [setGeneratedAd, setFetchedPageData]))

  const handleAnalyzeUrl = async () => {
    if (!formData.landingPageUrl) return

    setIsAnalyzing(true)
    setAnalyzeError(null)

    try {
      // Use Firecrawl API for better content extraction
      const response = await fetch('/api/fetch-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: formData.landingPageUrl,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Kon de pagina niet analyseren')
      }

      const pageData = data.data as FetchedPageData
      setFetchedPageData(pageData)

      // Auto-fill empty fields with rich Firecrawl data
      const updates: Partial<typeof formData> = {}

      if (!formData.productName && pageData.title) {
        // Use title, but clean it up (remove site name if present)
        const cleanTitle = pageData.title.split(/[|\-–—]/)[0].trim()
        updates.productName = cleanTitle.slice(0, 100)
      }

      if (!formData.productDescription) {
        // Use description from metadata, or fallback to markdown content
        if (pageData.description) {
          updates.productDescription = pageData.description
        } else if (pageData.metadata?.ogDescription) {
          updates.productDescription = pageData.metadata.ogDescription
        } else if (pageData.markdown) {
          // Use first ~500 chars of markdown content
          updates.productDescription = pageData.markdown.slice(0, 500).trim() + (pageData.markdown.length > 500 ? '...' : '')
        }
      }

      // Extract keywords from headings, CTAs, and content
      if (!formData.keywords) {
        const keywordSources: string[] = []

        // Add headings as keywords
        if (pageData.extractedElements?.headings) {
          pageData.extractedElements.headings.slice(0, 3).forEach(h => {
            const words = h.text.toLowerCase().split(/\s+/).filter(w => w.length > 3)
            keywordSources.push(...words.slice(0, 2))
          })
        }

        // Add CTAs as inspiration for keywords
        if (pageData.extractedElements?.ctas) {
          pageData.extractedElements.ctas.slice(0, 3).forEach(cta => {
            const words = cta.toLowerCase().split(/\s+/).filter(w => w.length > 3)
            keywordSources.push(...words)
          })
        }

        // Deduplicate and limit
        const uniqueKeywords = Array.from(new Set(keywordSources)).slice(0, 8)
        if (uniqueKeywords.length > 0) {
          updates.keywords = uniqueKeywords.join(', ')
        }
      }

      if (Object.keys(updates).length > 0) {
        setFormData({ ...formData, ...updates })
      }

    } catch (err) {
      console.error('URL analysis error:', err)
      setAnalyzeError(err instanceof Error ? err.message : 'Er ging iets mis. Probeer het opnieuw.')
      setFetchedPageData(null)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      // Language mapping for the prompt
      const languageMap: Record<string, string> = {
        nl: 'Nederlands',
        en: 'Engels (English)',
        de: 'Duits (Deutsch)',
      }
      const targetLanguage = languageMap[formData.language] || 'Nederlands'

      // Build the prompt for the AI
      let prompt = `Genereer Google Ads teksten voor het volgende:

Product/Dienst: ${formData.productName}
Beschrijving: ${formData.productDescription || 'Geen beschrijving opgegeven'}
Doelgroep: ${formData.targetAudience || 'Algemeen publiek'}
Keywords: ${formData.keywords || 'Geen specifieke keywords'}
Tone of voice: ${formData.tone}
Advertentietype: ${formData.adType}
Taal: ${targetLanguage}
`

      // Add rich landing page context if available (from Firecrawl)
      if (fetchedPageData) {
        const elements = fetchedPageData.extractedElements

        prompt += `

LANDINGSPAGINA ANALYSE (gebruik deze informatie voor betere Quality Score):
- Pagina titel: ${fetchedPageData.title}
- Meta description: ${fetchedPageData.description || fetchedPageData.metadata?.ogDescription || 'Niet beschikbaar'}
- Belangrijkste koppen: ${elements?.headings?.slice(0, 5).map(h => h.text).join(' | ') || 'Geen'}
${elements?.ctas?.length ? `- Call-to-actions op pagina: ${elements.ctas.slice(0, 5).join(', ')}` : ''}
${elements?.prices?.length ? `- Prijzen op pagina: ${elements.prices.join(', ')}` : ''}
${elements?.urgencyElements?.length ? `- Urgency elementen: ${elements.urgencyElements.join(', ')}` : ''}
${elements?.trustSignals?.length ? `- Trust signals: ${elements.trustSignals.slice(0, 3).join(', ')}` : ''}

PAGINA CONTENT (eerste 1500 karakters):
${fetchedPageData.markdown?.slice(0, 1500) || 'Niet beschikbaar'}

BELANGRIJK: Gebruik EXACT dezelfde woorden, termen en messaging die op de landingspagina staan. Dit verhoogt de Ad Relevance en Quality Score aanzienlijk.`
      }

      prompt += `

Genereer overtuigende headlines (max 30 karakters) en descriptions (max 90 karakters) in het ${targetLanguage}.`

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'google-ads-copy',
          prompt,
          clientId: clientId || undefined,
          options: {
            tone: formData.tone,
            adType: formData.adType,
            hasLandingPageContent: !!fetchedPageData,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Er ging iets mis bij het genereren')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Generatie mislukt')
      }

      // Parse the JSON result from Claude
      const parsedResult = JSON.parse(data.result)

      setGeneratedAd({
        headlines: parsedResult.headlines || [],
        descriptions: parsedResult.descriptions || [],
      })
    } catch (err) {
      console.error('Generation error:', err)
      setError(err instanceof Error ? err.message : 'Er ging iets mis. Probeer het opnieuw.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async (text: string, index: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    }
  }

  const handleCopyAll = async () => {
    if (!generatedAd) return

    const allText = [
      'HEADLINES:',
      ...generatedAd.headlines.map((h, i) => `${i + 1}. ${h}`),
      '',
      'DESCRIPTIONS:',
      ...generatedAd.descriptions.map((d, i) => `${i + 1}. ${d}`),
    ].join('\n')

    await copyToClipboard(allText)
    setCopiedIndex('all')
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const handleClearLandingPage = () => {
    setFetchedPageData(null)
    setFormData({ ...formData, landingPageUrl: '' })
    setAnalyzeError(null)
  }

  // Get export validation warnings (soft, non-blocking)
  const getExportWarnings = () => {
    if (!generatedAd) return []
    const warnings: string[] = []

    if (!formData.landingPageUrl) {
      warnings.push('Final URL ontbreekt')
    }

    if (path1.length > 15) {
      warnings.push(`Path 1 > 15 tekens (${path1.length}/15)`)
    }

    if (path2.length > 15) {
      warnings.push(`Path 2 > 15 tekens (${path2.length}/15)`)
    }

    const longHeadlines = generatedAd.headlines.filter(h => h.length > 30)
    if (longHeadlines.length > 0) {
      warnings.push(`${longHeadlines.length} headline(s) > 30 tekens`)
    }

    const longDescriptions = generatedAd.descriptions.filter(d => d.length > 90)
    if (longDescriptions.length > 0) {
      warnings.push(`${longDescriptions.length} description(s) > 90 tekens`)
    }

    if (generatedAd.headlines.length > 15) {
      warnings.push(`Meer dan 15 headlines (${generatedAd.headlines.length} totaal)`)
    }

    return warnings
  }

  // Generate TSV for Google Ads Editor
  const generateTSV = () => {
    if (!generatedAd) return ''

    // Headers according to Google Ads Editor format
    const headers = [
      'Campaign',
      'Ad group',
      'Final URL',
      'Path 1',
      'Path 2',
      'Headline 1',
      'Headline 2',
      'Headline 3',
      'Headline 4',
      'Headline 5',
      'Headline 6',
      'Headline 7',
      'Headline 8',
      'Headline 9',
      'Headline 10',
      'Headline 11',
      'Headline 12',
      'Headline 13',
      'Headline 14',
      'Headline 15',
      'Description 1',
      'Description 2',
      'Description 3',
      'Description 4',
    ]

    // Create row with data - limit to max 15 headlines and 4 descriptions
    const headlines = generatedAd.headlines.slice(0, 15)
    const descriptions = generatedAd.descriptions.slice(0, 4)

    // Pad arrays to ensure correct column alignment
    const paddedHeadlines = [...headlines, ...Array(15 - headlines.length).fill('')]
    const paddedDescriptions = [...descriptions, ...Array(4 - descriptions.length).fill('')]

    // Use landing page URL as Final URL
    const finalUrl = formData.landingPageUrl || ''

    const row = [
      campaignName,
      adGroupName,
      finalUrl,
      path1,
      path2,
      ...paddedHeadlines,
      ...paddedDescriptions,
    ]

    // Generate TSV string
    const tsv = headers.join('\t') + '\n' + row.join('\t')
    return tsv
  }

  const handleExportTSV = async () => {
    const tsv = generateTSV()
    const success = await copyToClipboard(tsv)
    if (success) {
      setCopiedIndex('export-tsv')
      setTimeout(() => setCopiedIndex(null), 3000)
    }
    setShowExportDropdown(false)
  }

  const handleReset = () => {
    setFormData(initialFormData)
    setGeneratedAd(null)
    setFetchedPageData(null)
    setError(null)
    setAnalyzeError(null)
    setCampaignName('AI Generated Campaign')
    setAdGroupName('General')
    setPath1('')
    setPath2('')
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-brand">
            <Wand2 className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">Google Ads Teksten</h1>
        </div>
        <p className="text-surface-600">
          Genereer overtuigende advertentieteksten voor je Google Ads campagnes met AI.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Invoer</CardTitle>
            <CardDescription>
              Vul de details in over je product of dienst
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Landing Page URL Section */}
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Link className="h-4 w-4 text-primary" />
                <span className="font-medium text-surface-900">Landingspagina analyseren</span>
                <Badge variant="primary" className="text-xs">Quality Score boost</Badge>
              </div>
              <p className="text-sm text-surface-600 mb-3">
                Voer je landingspagina URL in voor betere advertentieteksten die matchen met je pagina content.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://jouwwebsite.nl/product"
                  value={formData.landingPageUrl}
                  onChange={(e) => setFormData({ ...formData, landingPageUrl: e.target.value })}
                  leftIcon={<Link className="h-4 w-4" />}
                  className="flex-1"
                />
                <Button
                  onClick={handleAnalyzeUrl}
                  isLoading={isAnalyzing}
                  disabled={!formData.landingPageUrl || isAnalyzing}
                  variant="secondary"
                >
                  {isAnalyzing ? 'Analyseren...' : 'Analyseer'}
                </Button>
              </div>

              {/* Analysis Error */}
              {analyzeError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{analyzeError}</p>
                </div>
              )}

              {/* Landing Page Preview */}
              {fetchedPageData && (
                <div className="mt-3 border border-surface-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowLandingPagePreview(!showLandingPagePreview)}
                    className="w-full flex items-center justify-between p-3 bg-surface-50 hover:bg-surface-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-surface-900">Pagina geanalyseerd</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleClearLandingPage()
                        }}
                        className="text-xs text-surface-500 hover:text-surface-700"
                      >
                        Wissen
                      </button>
                      {showLandingPagePreview ? (
                        <ChevronUp className="h-4 w-4 text-surface-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-surface-400" />
                      )}
                    </div>
                  </button>

                  {showLandingPagePreview && (
                    <div className="p-3 space-y-3 text-sm">
                      <div>
                        <span className="text-surface-500">Titel:</span>
                        <p className="text-surface-900 font-medium">{fetchedPageData.title || '-'}</p>
                      </div>
                      {(fetchedPageData.description || fetchedPageData.metadata?.ogDescription) && (
                        <div>
                          <span className="text-surface-500">Beschrijving:</span>
                          <p className="text-surface-700">{fetchedPageData.description || fetchedPageData.metadata?.ogDescription}</p>
                        </div>
                      )}
                      {fetchedPageData.extractedElements?.headings?.length > 0 && (
                        <div>
                          <span className="text-surface-500">Koppen:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {fetchedPageData.extractedElements.headings.slice(0, 5).map((header, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {header.text.length > 40 ? header.text.slice(0, 40) + '...' : header.text}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {fetchedPageData.extractedElements?.ctas?.length > 0 && (
                        <div>
                          <span className="text-surface-500">CTAs gevonden:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {fetchedPageData.extractedElements.ctas.slice(0, 5).map((cta, i) => (
                              <Badge key={i} variant="primary" className="text-xs">
                                {cta}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {fetchedPageData.extractedElements?.prices?.length > 0 && (
                        <div>
                          <span className="text-surface-500">Prijzen:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {fetchedPageData.extractedElements.prices.map((price, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {price}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {fetchedPageData.markdown && (
                        <div>
                          <span className="text-surface-500">Content preview:</span>
                          <p className="text-surface-600 text-xs mt-1 line-clamp-3">
                            {fetchedPageData.markdown.slice(0, 200)}...
                          </p>
                        </div>
                      )}
                      <a
                        href={formData.landingPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                      >
                        Bekijk pagina <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-surface-200 pt-5">
              <div>
                <label className="label">Product/Dienst naam</label>
                <Input
                  placeholder="bijv. Nike Air Max 90"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  leftIcon={<Target className="h-4 w-4" />}
                />
              </div>
            </div>

            <div>
              <label className="label">Beschrijving</label>
              <Textarea
                placeholder="Beschrijf je product of dienst in detail..."
                value={formData.productDescription}
                onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                className="min-h-[100px]"
              />
            </div>

            <div>
              <label className="label">Doelgroep</label>
              <Input
                placeholder="bijv. sportieve mannen 25-45 jaar"
                value={formData.targetAudience}
                onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                leftIcon={<Users className="h-4 w-4" />}
              />
            </div>

            <div>
              <label className="label">Keywords (komma gescheiden)</label>
              <Input
                placeholder="bijv. sneakers, sportschoenen, nike"
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Taal</label>
                <Select
                  options={languageOptions}
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Tone of voice</label>
                <Select
                  options={toneOptions}
                  value={formData.tone}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Advertentietype</label>
                <Select
                  options={adTypeOptions}
                  value={formData.adType}
                  onChange={(e) => setFormData({ ...formData, adType: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                isLoading={isGenerating}
                className="flex-1"
                size="lg"
                leftIcon={<Sparkles className="h-4 w-4" />}
                disabled={!formData.productName}
              >
                {isGenerating ? 'Genereren...' : 'Genereer advertentieteksten'}
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                size="lg"
                title="Alles wissen en opnieuw beginnen"
                className="px-4"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {fetchedPageData && (
              <p className="text-xs text-center text-surface-500">
                ✨ Volledige landingspagina content wordt meegenomen voor betere Quality Score
              </p>
            )}
          </CardContent>
        </Card>

        {/* Output */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Resultaat</CardTitle>
              <CardDescription>
                Je gegenereerde advertentieteksten
              </CardDescription>
            </div>
            {generatedAd && (
              <div className="flex items-center gap-2">
                {/* Export Dropdown */}
                <div className="relative">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowExportDropdown(!showExportDropdown)}
                    leftIcon={copiedIndex === 'export-tsv' || copiedIndex === 'all' ? <CheckCircle className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                    rightIcon={<ChevronDown className="h-3 w-3" />}
                  >
                    {copiedIndex === 'export-tsv' || copiedIndex === 'all' ? 'Gekopieerd!' : 'Exporteren'}
                  </Button>
                  {showExportDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowExportDropdown(false)}
                      />
                      <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-surface-200 z-20">
                        <div className="p-3 border-b border-surface-100">
                          <button
                            onClick={handleExportTSV}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-50 transition-colors text-left"
                          >
                            <FileSpreadsheet className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium text-surface-900">Kopieer als tabel</p>
                              <p className="text-xs text-surface-500">Excel / Google Ads Editor</p>
                            </div>
                          </button>
                          <button
                            onClick={() => {
                              handleCopyAll()
                              setShowExportDropdown(false)
                            }}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-50 transition-colors text-left"
                          >
                            <Copy className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium text-surface-900">Kopieer als tekst</p>
                              <p className="text-xs text-surface-500">Plain text format</p>
                            </div>
                          </button>
                          <button
                            disabled
                            className="w-full flex items-center gap-3 p-2 rounded-lg text-left opacity-50 cursor-not-allowed mt-1"
                          >
                            <FileSpreadsheet className="h-5 w-5 text-surface-400" />
                            <div>
                              <p className="font-medium text-surface-500">Download CSV</p>
                              <p className="text-xs text-surface-400">Coming soon</p>
                            </div>
                          </button>
                        </div>
                        <div className="p-3 space-y-3">
                          <div>
                            <label className="text-xs font-medium text-surface-600">Campaign name</label>
                            <Input
                              value={campaignName}
                              onChange={(e) => setCampaignName(e.target.value)}
                              placeholder="AI Generated Campaign"
                              className="mt-1 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-surface-600">Ad group name</label>
                            <Input
                              value={adGroupName}
                              onChange={(e) => setAdGroupName(e.target.value)}
                              placeholder="General"
                              className="mt-1 text-sm"
                            />
                          </div>
                          <div className="pt-2 border-t border-surface-100">
                            <label className="text-xs font-medium text-surface-600">Final URL</label>
                            <p className={cn(
                              "mt-1 text-sm truncate",
                              formData.landingPageUrl ? "text-surface-900" : "text-surface-400 italic"
                            )}>
                              {formData.landingPageUrl || 'Voer een landingspagina URL in'}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs font-medium text-surface-600">
                                Path 1 <span className={cn("text-xs", path1.length > 15 ? "text-red-500" : "text-surface-400")}>({path1.length}/15)</span>
                              </label>
                              <Input
                                value={path1}
                                onChange={(e) => setPath1(e.target.value)}
                                placeholder="bijv. schoenen"
                                className="mt-1 text-sm"
                                maxLength={15}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-surface-600">
                                Path 2 <span className={cn("text-xs", path2.length > 15 ? "text-red-500" : "text-surface-400")}>({path2.length}/15)</span>
                              </label>
                              <Input
                                value={path2}
                                onChange={(e) => setPath2(e.target.value)}
                                placeholder="bijv. sale"
                                className="mt-1 text-sm"
                                maxLength={15}
                              />
                            </div>
                          </div>
                          {/* Soft validation warnings */}
                          {getExportWarnings().length > 0 && (
                            <div className="pt-2 border-t border-surface-100">
                              <p className="text-xs font-medium text-amber-600 flex items-center gap-1 mb-1">
                                <AlertTriangle className="h-3 w-3" />
                                Waarschuwingen
                              </p>
                              <ul className="text-xs text-surface-500 space-y-0.5">
                                {getExportWarnings().map((warning, i) => (
                                  <li key={i}>• {warning}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerate}
                  className="px-2"
                  title="Opnieuw genereren"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <p className="font-medium">Fout bij genereren</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4 animate-pulse">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <p className="text-surface-600">AI is aan het schrijven...</p>
                <p className="text-sm text-surface-400 mt-1">Dit duurt meestal 5-10 seconden</p>
              </div>
            ) : generatedAd ? (
              <div className="space-y-6">
                {/* Headlines */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-surface-900">Headlines</h4>
                    <Badge variant="primary">{generatedAd.headlines.length} stuks</Badge>
                  </div>
                  <div className="space-y-2">
                    {generatedAd.headlines.map((headline, index) => (
                      <div
                        key={index}
                        className="group flex items-center justify-between p-3 bg-surface-50 rounded-lg hover:bg-surface-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-surface-200 text-xs flex items-center justify-center text-surface-600">
                            {index + 1}
                          </span>
                          <span className="text-surface-900">{headline}</span>
                          <span className={cn(
                            "text-xs",
                            headline.length > 30 ? "text-red-500" : "text-surface-400"
                          )}>
                            ({headline.length}/30)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleCopy(headline, `h-${index}`)}
                        >
                          {copiedIndex === `h-${index}` ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Descriptions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-surface-900">Descriptions</h4>
                    <Badge variant="primary">{generatedAd.descriptions.length} stuks</Badge>
                  </div>
                  <div className="space-y-2">
                    {generatedAd.descriptions.map((description, index) => (
                      <div
                        key={index}
                        className="group p-3 bg-surface-50 rounded-lg hover:bg-surface-100 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-surface-200 text-xs flex items-center justify-center text-surface-600 flex-shrink-0 mt-0.5">
                              {index + 1}
                            </span>
                            <div>
                              <p className="text-surface-900">{description}</p>
                              <span className={cn(
                                "text-xs mt-1 inline-block",
                                description.length > 90 ? "text-red-500" : "text-surface-400"
                              )}>
                                ({description.length}/90)
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            onClick={() => handleCopy(description, `d-${index}`)}
                          >
                            {copiedIndex === `d-${index}` ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feedback */}
                <div className="pt-4 border-t border-surface-200">
                  <p className="text-sm text-surface-500 mb-3">Was dit resultaat nuttig?</p>
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
                <p className="text-surface-600">Vul het formulier in en klik op genereer</p>
                <p className="text-sm text-surface-400 mt-1">
                  Je resultaten verschijnen hier
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
