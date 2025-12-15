'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { copyToClipboard } from '@/lib/utils'
import { Copy, Check, Download, ExternalLink, Code2, FileCode } from 'lucide-react'
import { cn } from '@/lib/utils'

interface JsonLdPreviewProps {
  jsonLdString: string
  htmlSnippet: string
  isEmpty?: boolean
}

export function JsonLdPreview({
  jsonLdString,
  htmlSnippet,
  isEmpty = false,
}: JsonLdPreviewProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'json' | 'html'>('json')

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([jsonLdString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'schema.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleTestInGoogle = async () => {
    // Copy the full HTML snippet with script tags - Google expects this format
    await copyToClipboard(htmlSnippet)
    setCopiedField('google')
    setTimeout(() => setCopiedField(null), 3000)
    // Open Google Rich Results Test (user can paste the code)
    window.open('https://search.google.com/test/rich-results', '_blank')
  }

  if (isEmpty) {
    return (
      <Card className="h-full">
        <CardContent className="h-full flex flex-col items-center justify-center text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
            <Code2 className="w-8 h-8 text-surface-400" />
          </div>
          <h3 className="text-lg font-medium text-surface-900 mb-2">
            JSON-LD Preview
          </h3>
          <p className="text-sm text-surface-500 max-w-xs">
            Vul het formulier in om je structured data te genereren
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Output</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestInGoogle}
            >
              <ExternalLink className="w-4 h-4 mr-1.5" />
              {copiedField === 'google' ? 'Gekopieerd! Plak in Google' : 'Test in Google'}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3 bg-surface-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('json')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              activeTab === 'json'
                ? 'bg-white text-surface-900 shadow-sm'
                : 'text-surface-600 hover:text-surface-900'
            )}
          >
            <Code2 className="w-4 h-4" />
            JSON-LD
          </button>
          <button
            onClick={() => setActiveTab('html')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              activeTab === 'html'
                ? 'bg-white text-surface-900 shadow-sm'
                : 'text-surface-600 hover:text-surface-900'
            )}
          >
            <FileCode className="w-4 h-4" />
            HTML Snippet
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 relative">
          <div className="absolute inset-0 overflow-auto">
            <pre className="text-xs font-mono bg-surface-900 text-surface-100 p-4 rounded-xl h-full overflow-auto">
              <code>
                {activeTab === 'json' ? jsonLdString : htmlSnippet}
              </code>
            </pre>
          </div>
        </div>

        <div className="mt-3">
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={() =>
              handleCopy(
                activeTab === 'json' ? jsonLdString : htmlSnippet,
                activeTab
              )
            }
          >
            {copiedField === activeTab ? (
              <>
                <Check className="w-4 h-4 mr-1.5" />
                Gekopieerd!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1.5" />
                {activeTab === 'json' ? 'Kopieer JSON-LD' : 'Kopieer HTML'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
