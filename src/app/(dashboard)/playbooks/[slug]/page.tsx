'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Play,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  History,
  FileText,
  Megaphone,
  Share2,
  Mail,
  Search,
  BarChart3,
  Folder,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Playbook, PlaybookCategory, PlaybookInputProperty, PlaybookRun } from '@/types'
import { useSelectedClientId } from '@/stores/client-store'

const CATEGORY_ICONS: Record<PlaybookCategory, React.ElementType> = {
  content: FileText,
  seo: Search,
  ads: Megaphone,
  social: Share2,
  email: Mail,
  analysis: BarChart3,
  other: Folder,
}

export default function PlaybookRunPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const selectedClientId = useSelectedClientId()

  const [playbook, setPlaybook] = useState<Playbook | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [inputs, setInputs] = useState<Record<string, unknown>>({})
  const [output, setOutput] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [runs, setRuns] = useState<PlaybookRun[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    fetchPlaybook()
  }, [slug])

  useEffect(() => {
    if (showHistory && selectedClientId) {
      fetchRunHistory()
    }
  }, [showHistory, selectedClientId])

  const fetchPlaybook = async () => {
    try {
      const res = await fetch(`/api/playbooks/${slug}`)
      const data = await res.json()

      if (data.playbook) {
        setPlaybook(data.playbook)
        // Initialize inputs with defaults
        const defaultInputs: Record<string, unknown> = {}
        const schema = data.playbook.input_schema
        if (schema?.properties) {
          Object.entries(schema.properties).forEach(([key, prop]) => {
            const property = prop as PlaybookInputProperty
            if (property.default !== undefined) {
              defaultInputs[key] = property.default
            } else if (property.type === 'array') {
              defaultInputs[key] = []
            } else if (property.type === 'boolean') {
              defaultInputs[key] = false
            } else if (property.type === 'number') {
              defaultInputs[key] = property.minimum || 0
            } else {
              defaultInputs[key] = ''
            }
          })
        }
        setInputs(defaultInputs)
      } else {
        setError('Playbook niet gevonden')
      }
    } catch (error) {
      console.error('Error fetching playbook:', error)
      setError('Fout bij ophalen playbook')
    } finally {
      setLoading(false)
    }
  }

  const fetchRunHistory = async () => {
    if (!selectedClientId || !playbook) return

    setLoadingHistory(true)
    try {
      const res = await fetch(
        `/api/playbooks/runs?clientId=${selectedClientId}&playbookId=${playbook.id}&limit=10`
      )
      const data = await res.json()
      setRuns(data.runs || [])
    } catch (error) {
      console.error('Error fetching run history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const runPlaybook = async () => {
    if (!playbook) return

    // Validate required fields
    const schema = playbook.input_schema
    const required = schema?.required || []
    for (const key of required) {
      const value = inputs[key]
      if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
        setError(`Veld "${schema?.properties?.[key]?.title || key}" is verplicht`)
        return
      }
    }

    setRunning(true)
    setError(null)
    setOutput(null)

    try {
      const res = await fetch('/api/playbooks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playbookSlug: playbook.slug,
          inputs,
          clientId: selectedClientId,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setOutput(data.output)
        // Refresh history
        if (selectedClientId) {
          fetchRunHistory()
        }
      } else {
        setError(data.error || 'Er ging iets mis')
      }
    } catch (error) {
      console.error('Error running playbook:', error)
      setError('Er ging iets mis bij het uitvoeren van de playbook')
    } finally {
      setRunning(false)
    }
  }

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const updateInput = (key: string, value: unknown) => {
    setInputs((prev) => ({ ...prev, [key]: value }))
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!playbook) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">
              Playbook niet gevonden
            </h3>
            <p className="text-surface-600 mb-4">{error}</p>
            <Link href="/playbooks">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Terug naar playbooks
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const Icon = CATEGORY_ICONS[playbook.category]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/playbooks">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-900">{playbook.title}</h1>
            <p className="text-sm text-surface-600">{playbook.description}</p>
          </div>
        </div>
        {selectedClientId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="h-4 w-4 mr-2" />
            Geschiedenis
          </Button>
        )}
      </div>

      {/* No client warning */}
      {!selectedClientId && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800">
          <p className="text-sm">
            <strong>Let op:</strong> Selecteer een client in de header om deze playbook uit te voeren met de juiste context.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(playbook.input_schema?.properties || {}).map(([key, prop]) => {
              const property = prop as PlaybookInputProperty
              return (
                <DynamicField
                  key={key}
                  name={key}
                  property={property}
                  value={inputs[key]}
                  onChange={(value) => updateInput(key, value)}
                  required={(playbook.input_schema?.required || []).includes(key)}
                />
              )
            })}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={runPlaybook}
              disabled={running || !selectedClientId}
              className="w-full"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Bezig met genereren...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Uitvoeren
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Output */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Output</CardTitle>
          </CardHeader>
          <CardContent>
            {output ? (
              <div className="space-y-4">
                {renderOutput(output, copyToClipboard, copied)}
              </div>
            ) : (
              <div className="text-center py-12 text-surface-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Voer de playbook uit om resultaten te zien</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Run History */}
      {showHistory && selectedClientId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recente runs</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : runs.length === 0 ? (
              <p className="text-center py-8 text-surface-500">
                Nog geen runs voor deze client
              </p>
            ) : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <RunHistoryItem
                    key={run.id}
                    run={run}
                    onSelect={() => {
                      if (run.output) {
                        setOutput(run.output)
                        setInputs(run.inputs)
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Dynamic form field component
function DynamicField({
  name,
  property,
  value,
  onChange,
  required,
}: {
  name: string
  property: PlaybookInputProperty
  value: unknown
  onChange: (value: unknown) => void
  required: boolean
}) {
  const label = property.title || name
  const description = property.description

  // String with enum = select
  if (property.type === 'string' && property.enum) {
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium text-surface-900">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {description && <p className="text-xs text-surface-500">{description}</p>}
        <select
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="">Selecteer...</option>
          {property.enum.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // String = text input or textarea
  if (property.type === 'string') {
    const isLong = description?.toLowerCase().includes('beschrijving') || name.includes('description')
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium text-surface-900">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {description && <p className="text-xs text-surface-500">{description}</p>}
        {isLong ? (
          <textarea
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-white border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            placeholder={`Voer ${label.toLowerCase()} in...`}
          />
        ) : (
          <Input
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Voer ${label.toLowerCase()} in...`}
          />
        )}
      </div>
    )
  }

  // Number
  if (property.type === 'number') {
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium text-surface-900">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {description && <p className="text-xs text-surface-500">{description}</p>}
        <Input
          type="number"
          value={String(value || '')}
          onChange={(e) => onChange(Number(e.target.value))}
          min={property.minimum}
          max={property.maximum}
        />
      </div>
    )
  }

  // Boolean
  if (property.type === 'boolean') {
    return (
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-surface-300 text-primary focus:ring-primary"
        />
        <label className="text-sm font-medium text-surface-900">
          {label}
          {description && <span className="text-surface-500 font-normal ml-2">({description})</span>}
        </label>
      </div>
    )
  }

  // Array with enum = multi-select checkboxes
  if (property.type === 'array' && property.items?.enum) {
    const selected = (value as string[]) || []
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium text-surface-900">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {description && <p className="text-xs text-surface-500">{description}</p>}
        <div className="flex flex-wrap gap-2 mt-2">
          {property.items.enum.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                if (selected.includes(opt)) {
                  onChange(selected.filter((s) => s !== opt))
                } else {
                  onChange([...selected, opt])
                }
              }}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                selected.includes(opt)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-surface-700 border-surface-200 hover:border-primary'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Default: text input
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-surface-900">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {description && <p className="text-xs text-surface-500">{description}</p>}
      <Input
        value={String(value || '')}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Voer ${label.toLowerCase()} in...`}
      />
    </div>
  )
}

// Render output recursively
function renderOutput(
  output: Record<string, unknown>,
  copyFn: (text: string, key: string) => void,
  copied: string | null
): React.ReactNode {
  return Object.entries(output).map(([key, value]) => {
    const displayKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
    const titleKey = displayKey.charAt(0).toUpperCase() + displayKey.slice(1)

    if (value === null || value === undefined) return null

    // Array of strings
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      return (
        <div key={key} className="space-y-2">
          <h4 className="text-sm font-medium text-surface-900">{titleKey}</h4>
          <div className="space-y-2">
            {value.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-2 bg-surface-50 rounded-lg"
              >
                <span className="flex-1 text-sm">{item}</span>
                <button
                  onClick={() => copyFn(item, `${key}-${i}`)}
                  className="text-surface-400 hover:text-primary"
                >
                  {copied === `${key}-${i}` ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Array of objects
    if (Array.isArray(value) && value.every((v) => typeof v === 'object')) {
      return (
        <div key={key} className="space-y-2">
          <h4 className="text-sm font-medium text-surface-900">{titleKey}</h4>
          <div className="space-y-3">
            {value.map((item, i) => (
              <div key={i} className="p-3 bg-surface-50 rounded-lg">
                {renderOutput(item as Record<string, unknown>, copyFn, copied)}
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Object
    if (typeof value === 'object') {
      return (
        <div key={key} className="space-y-2">
          <h4 className="text-sm font-medium text-surface-900">{titleKey}</h4>
          <div className="pl-3 border-l-2 border-surface-200">
            {renderOutput(value as Record<string, unknown>, copyFn, copied)}
          </div>
        </div>
      )
    }

    // String (possibly long/HTML)
    if (typeof value === 'string') {
      const isLong = value.length > 200
      const isHtml = value.includes('<') && value.includes('>')
      return (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-surface-900">{titleKey}</h4>
            <button
              onClick={() => copyFn(value, key)}
              className="text-surface-400 hover:text-primary"
            >
              {copied === key ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          {isHtml ? (
            <div
              className="p-3 bg-surface-50 rounded-lg prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: value }}
            />
          ) : isLong ? (
            <div className="p-3 bg-surface-50 rounded-lg text-sm whitespace-pre-wrap">
              {value}
            </div>
          ) : (
            <p className="text-sm text-surface-700">{value}</p>
          )}
        </div>
      )
    }

    // Other primitives
    return (
      <div key={key} className="flex items-center justify-between">
        <span className="text-sm font-medium text-surface-900">{titleKey}</span>
        <span className="text-sm text-surface-700">{String(value)}</span>
      </div>
    )
  })
}

// Run history item
function RunHistoryItem({
  run,
  onSelect,
}: {
  run: PlaybookRun
  onSelect: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-surface-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-surface-50"
      >
        <div className="flex items-center gap-3">
          <span
            className={`w-2 h-2 rounded-full ${
              run.status === 'completed'
                ? 'bg-green-500'
                : run.status === 'failed'
                ? 'bg-red-500'
                : 'bg-amber-500'
            }`}
          />
          <span className="text-sm text-surface-700">
            {new Date(run.created_at).toLocaleDateString('nl-NL', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span className="text-xs text-surface-500">
            {run.total_tokens} tokens
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-surface-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-400" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-surface-200 p-3 bg-surface-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-surface-500 uppercase">Inputs</span>
            <Button variant="ghost" size="sm" onClick={onSelect}>
              Laad resultaat
            </Button>
          </div>
          <pre className="text-xs text-surface-600 bg-white p-2 rounded border overflow-auto max-h-32">
            {JSON.stringify(run.inputs, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
