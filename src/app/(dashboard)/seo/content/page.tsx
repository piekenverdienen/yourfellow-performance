'use client'

import { useState, useMemo, useCallback } from 'react'
import DOMPurify from 'dompurify'
import { useSelectedClientId } from '@/stores/client-store'
import { usePersistedState, useClientPersistedState, useOnClientChange } from '@/hooks/use-persisted-form'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import {
  Sparkles,
  Copy,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  FileText,
  Target,
  MessageSquare,
} from 'lucide-react'
import { copyToClipboard } from '@/lib/utils'

const contentTypeOptions = [
  { value: 'blog', label: 'Blogpost' },
  { value: 'landing', label: 'Landingspagina' },
  { value: 'product', label: 'Productpagina' },
  { value: 'category', label: 'Categoriepagina' },
  { value: 'guide', label: 'Uitgebreide gids' },
]

const lengthOptions = [
  { value: 'short', label: 'Kort (300-500 woorden)' },
  { value: 'medium', label: 'Medium (500-800 woorden)' },
  { value: 'long', label: 'Lang (800-1200 woorden)' },
  { value: 'comprehensive', label: 'Uitgebreid (1200+ woorden)' },
]

const toneOptions = [
  { value: 'professional', label: 'Professioneel' },
  { value: 'casual', label: 'Casual' },
  { value: 'authoritative', label: 'Autoritair' },
  { value: 'friendly', label: 'Vriendelijk' },
]

const initialFormData = {
  topic: '',
  primaryKeyword: '',
  secondaryKeywords: '',
  targetAudience: '',
  contentType: 'blog',
  length: 'medium',
  tone: 'professional',
}

export default function SEOContentPage() {
  const clientId = useSelectedClientId()
  const [isGenerating, setIsGenerating] = useState(false)
  const [formData, setFormData] = usePersistedState('seo-content-form', initialFormData)
  const [generatedContent, setGeneratedContent] = useClientPersistedState<string | null>('seo-content-result', null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when client changes
  useOnClientChange(useCallback(() => {
    setGeneratedContent(null)
    setError(null)
  }, [setGeneratedContent]))

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const prompt = `Schrijf SEO-geoptimaliseerde content voor het volgende:

Onderwerp: ${formData.topic}
Primair keyword: ${formData.primaryKeyword}
Secundaire keywords: ${formData.secondaryKeywords || 'Geen opgegeven'}
Doelgroep: ${formData.targetAudience || 'Algemeen publiek'}
Type content: ${formData.contentType}
Gewenste lengte: ${formData.length}
Tone of voice: ${formData.tone}

Schrijf informatieve, goed leesbare content in het Nederlands die rankt in Google.
Gebruik duidelijke headers (H2, H3), korte alineas en verwerk keywords natuurlijk.`

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'seo-content',
          prompt,
          clientId: clientId || undefined,
          options: {
            contentType: formData.contentType,
            length: formData.length,
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

      setGeneratedContent(data.result)
    } catch (err) {
      console.error('Generation error:', err)
      setError(err instanceof Error ? err.message : 'Er ging iets mis. Probeer het opnieuw.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!generatedContent) return
    const success = await copyToClipboard(generatedContent)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-brand">
            <FileText className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">SEO Content Schrijven</h1>
        </div>
        <p className="text-surface-600">
          Genereer SEO-geoptimaliseerde content die rankt in Google.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Invoer</CardTitle>
            <CardDescription>
              Vul de details in voor je SEO content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="label">Onderwerp</label>
              <Input
                placeholder="bijv. De beste tips voor email marketing"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                leftIcon={<Target className="h-4 w-4" />}
              />
            </div>

            <div>
              <label className="label">Primair keyword</label>
              <Input
                placeholder="bijv. email marketing tips"
                value={formData.primaryKeyword}
                onChange={(e) => setFormData({ ...formData, primaryKeyword: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Secundaire keywords (komma gescheiden)</label>
              <Input
                placeholder="bijv. nieuwsbrief, open rate, conversie"
                value={formData.secondaryKeywords}
                onChange={(e) => setFormData({ ...formData, secondaryKeywords: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Doelgroep</label>
              <Input
                placeholder="bijv. Marketing managers in MKB"
                value={formData.targetAudience}
                onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Type content</label>
                <Select
                  options={contentTypeOptions}
                  value={formData.contentType}
                  onChange={(e) => setFormData({ ...formData, contentType: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Lengte</label>
                <Select
                  options={lengthOptions}
                  value={formData.length}
                  onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Tone of voice</label>
              <Select
                options={toneOptions}
                value={formData.tone}
                onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
              />
            </div>

            <Button
              onClick={handleGenerate}
              isLoading={isGenerating}
              className="w-full"
              size="lg"
              leftIcon={<Sparkles className="h-4 w-4" />}
              disabled={!formData.topic || !formData.primaryKeyword}
            >
              {isGenerating ? 'Genereren...' : 'Genereer content'}
            </Button>
          </CardContent>
        </Card>

        {/* Output */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Resultaat</CardTitle>
              <CardDescription>
                Je gegenereerde SEO content
              </CardDescription>
            </div>
            {generatedContent && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  leftIcon={copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                >
                  {copied ? 'Gekopieerd!' : 'Kopieer'}
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
                <p className="text-sm text-surface-400 mt-1">Dit kan even duren voor langere content</p>
              </div>
            ) : generatedContent ? (
              <div className="space-y-6">
                {/* Content */}
                <div className="prose prose-surface max-w-none">
                  <div
                    className="p-4 bg-surface-50 rounded-lg max-h-[600px] overflow-y-auto"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        generatedContent
                          .replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mt-6 mb-3">$1</h2>')
                          .replace(/^### (.*$)/gim, '<h3 class="text-base font-medium mt-4 mb-2">$1</h3>')
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n\n/g, '</p><p class="mb-3">')
                          .replace(/^(.*)$/gim, '<p class="mb-3">$1</p>'),
                        { ALLOWED_TAGS: ['h2', 'h3', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'br'] }
                      )
                    }}
                  />
                </div>

                {/* Word count */}
                <div className="flex items-center justify-between text-sm text-surface-500">
                  <span>Aantal woorden: ~{generatedContent.split(/\s+/).length}</span>
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
