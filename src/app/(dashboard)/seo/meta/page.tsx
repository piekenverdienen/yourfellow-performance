'use client'

import { useState } from 'react'
import { useSelectedClientId } from '@/stores/client-store'
import { usePersistedState } from '@/hooks/use-persisted-form'
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
  Tags,
  Globe,
  MessageSquare,
} from 'lucide-react'
import { copyToClipboard } from '@/lib/utils'

const pageTypeOptions = [
  { value: 'homepage', label: 'Homepage' },
  { value: 'product', label: 'Productpagina' },
  { value: 'category', label: 'Categoriepagina' },
  { value: 'blog', label: 'Blogpost' },
  { value: 'service', label: 'Dienstenpagina' },
  { value: 'about', label: 'Over ons' },
  { value: 'contact', label: 'Contactpagina' },
]

interface GeneratedMeta {
  title: string
  description: string
  og_title: string
  og_description: string
}

const initialFormData = {
  pageUrl: '',
  pageContent: '',
  primaryKeyword: '',
  brandName: '',
  pageType: 'homepage',
}

export default function SEOMetaPage() {
  const clientId = useSelectedClientId()
  const [isGenerating, setIsGenerating] = useState(false)
  const [formData, setFormData] = usePersistedState('seo-meta-form', initialFormData)
  const [generatedMeta, setGeneratedMeta] = usePersistedState<GeneratedMeta | null>('seo-meta-result', null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const prompt = `Genereer geoptimaliseerde meta tags voor de volgende pagina:

URL: ${formData.pageUrl || 'Niet opgegeven'}
Type pagina: ${formData.pageType}
Primair keyword: ${formData.primaryKeyword}
Merknaam: ${formData.brandName || 'Niet opgegeven'}
Pagina inhoud/context: ${formData.pageContent}

Genereer een title tag (50-60 karakters) en meta description (150-160 karakters) in het Nederlands.`

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'seo-meta',
          prompt,
          clientId: clientId || undefined,
          options: {
            pageType: formData.pageType,
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

      // Strip markdown code blocks if present
      let resultText = data.result
      if (resultText.startsWith('```')) {
        resultText = resultText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      const parsedResult = JSON.parse(resultText)

      setGeneratedMeta({
        title: parsedResult.title || '',
        description: parsedResult.description || '',
        og_title: parsedResult.og_title || parsedResult.title || '',
        og_description: parsedResult.og_description || parsedResult.description || '',
      })
    } catch (err) {
      console.error('Generation error:', err)
      setError(err instanceof Error ? err.message : 'Er ging iets mis. Probeer het opnieuw.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const handleCopyAll = async () => {
    if (!generatedMeta) return

    const allText = `<title>${generatedMeta.title}</title>
<meta name="description" content="${generatedMeta.description}">
<meta property="og:title" content="${generatedMeta.og_title}">
<meta property="og:description" content="${generatedMeta.og_description}">`

    await copyToClipboard(allText)
    setCopiedField('all')
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-brand">
            <Tags className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">Meta Tags Generator</h1>
        </div>
        <p className="text-surface-600">
          Genereer geoptimaliseerde title tags en meta descriptions voor betere CTR.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Invoer</CardTitle>
            <CardDescription>
              Vul de details in over je pagina
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="label">Pagina URL (optioneel)</label>
              <Input
                placeholder="bijv. https://example.com/diensten"
                value={formData.pageUrl}
                onChange={(e) => setFormData({ ...formData, pageUrl: e.target.value })}
                leftIcon={<Globe className="h-4 w-4" />}
              />
            </div>

            <div>
              <label className="label">Pagina inhoud / context</label>
              <Textarea
                placeholder="Beschrijf waar de pagina over gaat..."
                value={formData.pageContent}
                onChange={(e) => setFormData({ ...formData, pageContent: e.target.value })}
                className="min-h-[120px]"
              />
            </div>

            <div>
              <label className="label">Primair keyword</label>
              <Input
                placeholder="bijv. online marketing bureau amsterdam"
                value={formData.primaryKeyword}
                onChange={(e) => setFormData({ ...formData, primaryKeyword: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Merknaam</label>
                <Input
                  placeholder="bijv. YourFellow"
                  value={formData.brandName}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Type pagina</label>
                <Select
                  options={pageTypeOptions}
                  value={formData.pageType}
                  onChange={(e) => setFormData({ ...formData, pageType: e.target.value })}
                />
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              isLoading={isGenerating}
              className="w-full"
              size="lg"
              leftIcon={<Sparkles className="h-4 w-4" />}
              disabled={!formData.pageContent || !formData.primaryKeyword}
            >
              {isGenerating ? 'Genereren...' : 'Genereer meta tags'}
            </Button>
          </CardContent>
        </Card>

        {/* Output */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Resultaat</CardTitle>
              <CardDescription>
                Je gegenereerde meta tags
              </CardDescription>
            </div>
            {generatedMeta && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAll}
                  leftIcon={copiedField === 'all' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                >
                  {copiedField === 'all' ? 'Gekopieerd!' : 'Kopieer HTML'}
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
            ) : generatedMeta ? (
              <div className="space-y-6">
                {/* Title Tag */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-surface-900">Title Tag</h4>
                      <span className="text-xs text-surface-500">{generatedMeta.title.length}/60 karakters</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(generatedMeta.title, 'title')}
                    >
                      {copiedField === 'title' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="p-4 bg-surface-50 rounded-lg">
                    <p className="text-blue-600 font-medium">{generatedMeta.title}</p>
                  </div>
                </div>

                {/* Meta Description */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-surface-900">Meta Description</h4>
                      <span className="text-xs text-surface-500">{generatedMeta.description.length}/160 karakters</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(generatedMeta.description, 'description')}
                    >
                      {copiedField === 'description' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="p-4 bg-surface-50 rounded-lg">
                    <p className="text-surface-600">{generatedMeta.description}</p>
                  </div>
                </div>

                {/* SERP Preview */}
                <div>
                  <h4 className="font-medium text-surface-900 mb-3">Google Preview</h4>
                  <div className="p-4 bg-white border border-surface-200 rounded-lg">
                    <p className="text-blue-600 text-lg hover:underline cursor-pointer">{generatedMeta.title}</p>
                    <p className="text-green-700 text-sm">{formData.pageUrl || 'https://example.com/page'}</p>
                    <p className="text-surface-600 text-sm mt-1">{generatedMeta.description}</p>
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
