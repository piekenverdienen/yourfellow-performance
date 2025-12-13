'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { cn, copyToClipboard } from '@/lib/utils'

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

export default function GoogleAdsCopyPage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [formData, setFormData] = useState({
    productName: '',
    productDescription: '',
    targetAudience: '',
    keywords: '',
    tone: 'professional',
    adType: 'responsive_search',
  })
  const [generatedAd, setGeneratedAd] = useState<GeneratedAd | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    
    // TODO: Call API endpoint that uses Claude
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Mock generated content
    setGeneratedAd({
      headlines: [
        `${formData.productName} - Beste Keuze`,
        `Ontdek ${formData.productName} Nu`,
        'Gratis Verzending Vandaag',
        'Bespaar Tot 30% Korting',
        `${formData.productName} | Officiële Shop`,
        'Bestel Snel & Veilig Online',
        'Top Kwaliteit Gegarandeerd',
        'Direct Uit Voorraad Leverbaar',
      ],
      descriptions: [
        `Ontdek de beste ${formData.productName} voor ${formData.targetAudience}. Hoogwaardige kwaliteit, scherpe prijzen en snelle levering.`,
        `Op zoek naar ${formData.productName}? Bestel vandaag nog en profiteer van gratis verzending en 30 dagen retour.`,
        `${formData.productName} specialist sinds 2010. Meer dan 10.000 tevreden klanten gingen je voor. Bekijk ons assortiment!`,
        `De beste ${formData.productName} vind je hier. Uitgebreid assortiment, deskundig advies en razendsnelle levering.`,
      ],
    })
    
    setIsGenerating(false)
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
            <div>
              <label className="label">Product/Dienst naam</label>
              <Input
                placeholder="bijv. Nike Air Max 90"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                leftIcon={<Target className="h-4 w-4" />}
              />
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
                          <span className="text-xs text-surface-400">
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
                              <span className="text-xs text-surface-400 mt-1 inline-block">
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
