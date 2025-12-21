'use client'

import { useState, useRef, useEffect } from 'react'
import { useSelectedClientId } from '@/stores/client-store'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import {
  Sparkles,
  Download,
  RefreshCw,
  Image as ImageIcon,
  Wand2,
  Copy,
  CheckCircle,
  Maximize,
  Upload,
  X,
  Cpu,
} from 'lucide-react'
import { copyToClipboard } from '@/lib/utils'

const modelOptions = [
  { value: 'gpt-image', label: 'GPT Image (OpenAI)' },
  { value: 'gemini-flash', label: 'Gemini 2.0 Flash (Google)' },
]

const sizeOptions = [
  { value: '1024x1024', label: 'Vierkant (1024x1024)' },
  { value: '1536x1024', label: 'Landschap (1536x1024)' },
  { value: '1024x1536', label: 'Portret (1024x1536)' },
]

const qualityOptions = [
  { value: 'low', label: 'Low - Snelste, goedkoopste' },
  { value: 'medium', label: 'Medium - Balans kwaliteit/snelheid' },
  { value: 'high', label: 'High - Beste kwaliteit' },
]

const templatePrompts = [
  { label: 'Social Media Banner', prompt: 'Professionele social media banner voor een marketing agency, minimalistisch design met gradienten in turquoise en donkerblauw, moderne typografie ruimte, clean en zakelijk' },
  { label: 'Product Shot', prompt: 'Strakke product fotografie met zachte studio belichting, witte achtergrond met subtiele schaduwen, premium uitstraling' },
  { label: 'Team Foto Achtergrond', prompt: 'Moderne kantoor achtergrond voor team fotos, lichte ruimte met planten en natuurlijk licht, professioneel maar warm' },
  { label: 'Abstract Patroon', prompt: 'Abstract geometrisch patroon in turquoise en donkerblauw tinten, vloeiende vormen, geschikt als achtergrond' },
  { label: 'Infographic Elementen', prompt: 'Set van moderne infographic iconen en elementen, flat design stijl, zakelijke kleuren, witte achtergrond' },
]

export default function ImageGeneratorPage() {
  const clientId = useSelectedClientId()
  const [isGenerating, setIsGenerating] = useState(false)
  const [formData, setFormData] = useState({
    prompt: '',
    model: 'gpt-image',
    size: '1024x1024',
    quality: 'medium',
  })
  const [generatedImage, setGeneratedImage] = useState<{
    url: string
    revisedPrompt: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  // Reference image state
  const [referenceImage, setReferenceImage] = useState<File | null>(null)
  const [referencePreview, setReferencePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset generated content when client changes
  const prevClientId = useRef(clientId)
  useEffect(() => {
    if (prevClientId.current !== clientId) {
      setGeneratedImage(null)
      setError(null)
      prevClientId.current = clientId
    }
  }, [clientId])

  const handleFileSelect = (file: File) => {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Alleen PNG, JPEG en WebP bestanden zijn toegestaan.')
      return
    }

    // Validate file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      setError('Bestand is te groot. Maximum is 25MB.')
      return
    }

    setReferenceImage(file)
    setReferencePreview(URL.createObjectURL(file))
    setError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const removeReferenceImage = () => {
    setReferenceImage(null)
    if (referencePreview) {
      URL.revokeObjectURL(referencePreview)
    }
    setReferencePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleGenerate = async () => {
    if (!formData.prompt.trim()) return

    setIsGenerating(true)
    setError(null)

    try {
      let response: Response

      if (referenceImage) {
        // Use FormData when there's a reference image
        const formDataObj = new FormData()
        formDataObj.append('prompt', formData.prompt)
        formDataObj.append('model', formData.model)
        formDataObj.append('size', formData.size)
        formDataObj.append('quality', formData.quality)
        formDataObj.append('referenceImage', referenceImage)
        if (clientId) {
          formDataObj.append('clientId', clientId)
        }

        response = await fetch('/api/generate-image', {
          method: 'POST',
          body: formDataObj,
        })
      } else {
        // Use JSON when there's no reference image
        response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: formData.prompt,
            model: formData.model,
            size: formData.size,
            quality: formData.quality,
            clientId: clientId || undefined,
          }),
        })
      }

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Er ging iets mis bij het genereren')
      }

      setGeneratedImage({
        url: data.imageUrl,
        revisedPrompt: data.revisedPrompt || formData.prompt,
      })
    } catch (err) {
      console.error('Generation error:', err)
      setError(err instanceof Error ? err.message : 'Er ging iets mis. Probeer het opnieuw.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async () => {
    if (!generatedImage?.url) return

    try {
      const response = await fetch(generatedImage.url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `yourfellow-image-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download error:', err)
      // Fallback: open in new tab
      window.open(generatedImage.url, '_blank')
    }
  }

  const handleCopyPrompt = async () => {
    if (!generatedImage?.revisedPrompt) return
    const success = await copyToClipboard(generatedImage.revisedPrompt)
    if (success) {
      setCopiedPrompt(true)
      setTimeout(() => setCopiedPrompt(false), 2000)
    }
  }

  const handleTemplateClick = (prompt: string) => {
    setFormData({ ...formData, prompt })
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-brand">
            <ImageIcon className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl font-bold font-display text-surface-900">AI Afbeelding Generator</h1>
        </div>
        <p className="text-surface-600">
          Genereer unieke afbeeldingen met AI voor je social media en marketing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Beschrijving</CardTitle>
              <CardDescription>
                Beschrijf de afbeelding die je wilt genereren
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Model Selector */}
              <div>
                <label className="label flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  AI Model
                </label>
                <Select
                  options={modelOptions}
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                />
                <p className="text-xs text-surface-500 mt-1">
                  {formData.model === 'gpt-image'
                    ? 'Beste voor complexe instructies en tekst in afbeeldingen'
                    : 'Sneller en goedkoper, goed voor fotorealisme (beperkte regio-beschikbaarheid)'}
                </p>
              </div>

              <div>
                <label className="label">Prompt</label>
                <Textarea
                  placeholder="Beschrijf je gewenste afbeelding zo gedetailleerd mogelijk..."
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  className="min-h-[120px]"
                />
              </div>

              {/* Reference Image Upload */}
              <div>
                <label className="label flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Referentie afbeelding (optioneel)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(file)
                  }}
                />

                {referencePreview ? (
                  <div className="relative rounded-lg overflow-hidden border border-surface-200">
                    <img
                      src={referencePreview}
                      alt="Reference"
                      className="w-full h-32 object-cover"
                    />
                    <button
                      onClick={removeReferenceImage}
                      className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1">
                      {referenceImage?.name}
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`
                      border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                      ${isDragging
                        ? 'border-primary bg-primary/5'
                        : 'border-surface-300 hover:border-surface-400 hover:bg-surface-50'
                      }
                    `}
                  >
                    <Upload className="h-6 w-6 mx-auto mb-2 text-surface-400" />
                    <p className="text-sm text-surface-600">
                      Sleep een afbeelding of <span className="text-primary font-medium">klik om te uploaden</span>
                    </p>
                    <p className="text-xs text-surface-400 mt-1">
                      PNG, JPEG, WebP (max 25MB)
                    </p>
                  </div>
                )}
                <p className="text-xs text-surface-500 mt-1">
                  Upload een afbeelding om te bewerken of als referentie te gebruiken
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label flex items-center gap-2">
                    <Maximize className="h-4 w-4" />
                    Formaat
                  </label>
                  <Select
                    options={sizeOptions}
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Kwaliteit</label>
                  <Select
                    options={qualityOptions}
                    value={formData.quality}
                    onChange={(e) => setFormData({ ...formData, quality: e.target.value })}
                  />
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                isLoading={isGenerating}
                className="w-full"
                size="lg"
                leftIcon={<Sparkles className="h-4 w-4" />}
                disabled={!formData.prompt.trim()}
              >
                {isGenerating ? 'Genereren... (10-20 sec)' : 'Genereer afbeelding'}
              </Button>
            </CardContent>
          </Card>

          {/* Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Snelle Templates
              </CardTitle>
              <CardDescription>
                Klik om een template prompt te gebruiken
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {templatePrompts.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => handleTemplateClick(template.prompt)}
                    className="px-3 py-1.5 text-sm bg-surface-100 hover:bg-surface-200 rounded-lg transition-colors text-surface-700 hover:text-surface-900"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Output */}
        <Card className="h-fit">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Resultaat</CardTitle>
              <CardDescription>
                Je gegenereerde afbeelding
              </CardDescription>
            </div>
            {generatedImage && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  leftIcon={<Download className="h-4 w-4" />}
                >
                  Download
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
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <p className="text-surface-600 font-medium">
                  {formData.model === 'gpt-image' ? 'GPT Image' : 'Gemini Flash'} is aan het creëren...
                </p>
                <p className="text-sm text-surface-400 mt-1">
                  Dit duurt meestal {formData.model === 'gpt-image' ? '10-20' : '5-15'} seconden
                </p>
                <div className="mt-4 w-48 h-1 bg-surface-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            ) : generatedImage ? (
              <div className="space-y-4">
                {/* Generated Image */}
                <div className="relative rounded-xl overflow-hidden bg-surface-100">
                  <img
                    src={generatedImage.url}
                    alt="Generated image"
                    className="w-full h-auto"
                  />
                </div>

                {/* Revised Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-surface-700">Gebruikte prompt</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyPrompt}
                    >
                      {copiedPrompt ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-surface-600 bg-surface-50 p-3 rounded-lg">
                    {generatedImage.revisedPrompt}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
                  <ImageIcon className="h-10 w-10 text-surface-400" />
                </div>
                <p className="text-surface-600">Beschrijf je gewenste afbeelding</p>
                <p className="text-sm text-surface-400 mt-1">
                  Gebruik een template of schrijf je eigen prompt
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
