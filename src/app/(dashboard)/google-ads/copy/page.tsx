'use client'

import { useState } from 'react'
import { useSelectedClientId } from '@/stores/client-store'
import { usePersistedState } from '@/hooks/use-persisted-form'
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
} from 'lucide-react'
import { cn, copyToClipboard } from '@/lib/utils'
import type { LandingPageContent } from '@/types'

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
}

export default function GoogleAdsCopyPage() {
  const clientId = useSelectedClientId()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [formData, setFormData] = usePersistedState('google-ads-form', initialFormData)
  const [generatedAd, setGeneratedAd] = usePersistedState<GeneratedAd | null>('google-ads-result', null)
  const [landingPageContent, setLandingPageContent] = usePersistedState<LandingPageContent | null>('google-ads-lp-content', null)
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [showLandingPagePreview, setShowLandingPagePreview] = useState(true)

  const handleAnalyzeUrl = async () => {
    if (!formData.landingPageUrl) return

    setIsAnalyzing(true)
    setAnalyzeError(null)

    try {
      const response = await fetch('/api/fetch-url', {
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

      const content: LandingPageContent = data.content
      setLandingPageContent(content)

      // Auto-fill empty fields
      const updates: Partial<typeof formData> = {}

      if (!formData.productName && content.title) {
        // Use title, but clean it up (remove site name if present)
        const cleanTitle = content.title.split(/[|\-–—]/)[0].trim()
        updates.productName = cleanTitle.slice(0, 100)
      }

      if (!formData.productDescription && content.metaDescription) {
        updates.productDescription = content.metaDescription
      }

      if (!formData.keywords && content.extractedKeywords.length > 0) {
        updates.keywords = content.extractedKeywords.slice(0, 8).join(', ')
      }

      if (Object.keys(updates).length > 0) {
        setFormData({ ...formData, ...updates })
      }

    } catch (err) {
      console.error('URL analysis error:', err)
      setAnalyzeError(err instanceof Error ? err.message : 'Er ging iets mis. Probeer het opnieuw.')
      setLandingPageContent(null)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      // Build the prompt for the AI
      let prompt = `Genereer Google Ads teksten voor het volgende:

Product/Dienst: ${formData.productName}
Beschrijving: ${formData.productDescription || 'Geen beschrijving opgegeven'}
Doelgroep: ${formData.targetAudience || 'Algemeen publiek'}
Keywords: ${formData.keywords || 'Geen specifieke keywords'}
Tone of voice: ${formData.tone}
Advertentietype: ${formData.adType}
`

      // Add landing page context if available
      if (landingPageContent) {
        prompt += `

LANDINGSPAGINA ANALYSE (gebruik deze informatie voor betere Quality Score):
- Pagina titel: ${landingPageContent.title}
- Meta description: ${landingPageContent.metaDescription}
- Belangrijkste koppen: ${landingPageContent.headers.slice(0, 5).join(' | ')}
- Gevonden keywords: ${landingPageContent.extractedKeywords.join(', ')}

BELANGRIJK: Gebruik woorden en thema's die op de landingspagina staan om de relevantie en Quality Score te verbeteren. Zorg dat de messaging consistent is met de landingspagina.`
      }

      prompt += `

Genereer overtuigende headlines (max 30 karakters) en descriptions (max 90 karakters) in het Nederlands.`

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
            hasLandingPageContent: !!landingPageContent,
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
    setLandingPageContent(null)
    setFormData({ ...formData, landingPageUrl: '' })
    setAnalyzeError(null)
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
              {landingPageContent && (
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
                        <p className="text-surface-900 font-medium">{landingPageContent.title || '-'}</p>
                      </div>
                      {landingPageContent.metaDescription && (
                        <div>
                          <span className="text-surface-500">Meta description:</span>
                          <p className="text-surface-700">{landingPageContent.metaDescription}</p>
                        </div>
                      )}
                      {landingPageContent.headers.length > 0 && (
                        <div>
                          <span className="text-surface-500">Koppen:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {landingPageContent.headers.slice(0, 5).map((header, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {header.length > 40 ? header.slice(0, 40) + '...' : header}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {landingPageContent.extractedKeywords.length > 0 && (
                        <div>
                          <span className="text-surface-500">Gevonden keywords:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {landingPageContent.extractedKeywords.slice(0, 10).map((keyword, i) => (
                              <Badge key={i} variant="primary" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
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

            <div className="grid grid-cols-2 gap-4">
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

            <Button
              onClick={handleGenerate}
              isLoading={isGenerating}
              className="w-full"
              size="lg"
              leftIcon={<Sparkles className="h-4 w-4" />}
              disabled={!formData.productName}
            >
              {isGenerating ? 'Genereren...' : 'Genereer advertentieteksten'}
            </Button>

            {landingPageContent && (
              <p className="text-xs text-center text-surface-500">
                ✨ Landingspagina content wordt meegenomen voor betere Quality Score
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAll}
                  leftIcon={copiedIndex === 'all' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                >
                  {copiedIndex === 'all' ? 'Gekopieerd!' : 'Kopieer alles'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                >
                  Opnieuw
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
