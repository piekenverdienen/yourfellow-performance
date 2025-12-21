'use client'

import { useState, useEffect } from 'react'
import type { Node } from '@xyflow/react'
import { Button } from '@/components/ui/button'
import { X, Trash2, Plus, AlertCircle } from 'lucide-react'
import type {
  BaseNodeData,
  AIAgentConfig,
  EmailConfig,
  WebhookConfig,
  DelayConfig,
  ConditionConfig,
} from '@/types/workflow'

interface NodeConfigPanelProps {
  node: Node
  onUpdate: (data: Partial<BaseNodeData>) => void
  onDelete: () => void
  onClose: () => void
}

// Validation helpers
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function NodeConfigPanel({ node, onUpdate, onDelete, onClose }: NodeConfigPanelProps) {
  const [label, setLabel] = useState(node.data.label as string)
  const [config, setConfig] = useState(node.data.config as Record<string, unknown>)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setLabel(node.data.label as string)
    setConfig(node.data.config as Record<string, unknown>)
    setErrors({})
  }, [node])

  const handleSave = () => {
    // Validate before saving
    const newErrors: Record<string, string> = {}

    if (node.type === 'webhookNode') {
      const webhookConfig = config as unknown as WebhookConfig
      if (!webhookConfig.url) {
        newErrors.url = 'URL is verplicht'
      } else if (!isValidUrl(webhookConfig.url)) {
        newErrors.url = 'Voer een geldige URL in (bijv. https://...)'
      }
    }

    if (node.type === 'conditionNode') {
      const conditionConfig = config as unknown as ConditionConfig
      if (!conditionConfig.condition) {
        newErrors.condition = 'Vul een conditie in'
      }
    }

    if (node.type === 'aiAgentNode') {
      const aiConfig = config as unknown as AIAgentConfig
      if (!aiConfig.prompt) {
        newErrors.prompt = 'Prompt is verplicht'
      }
    }

    if (node.type === 'emailNode') {
      const emailConfig = config as unknown as EmailConfig
      if (!emailConfig.to) {
        newErrors.to = 'Ontvanger is verplicht'
      }
      if (!emailConfig.subject) {
        newErrors.subject = 'Onderwerp is verplicht'
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onUpdate({ label, config })
  }

  const updateConfig = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
    // Clear error when field is edited
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[key]
        return newErrors
      })
    }
  }

  const renderError = (field: string) => {
    if (!errors[field]) return null
    return (
      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {errors[field]}
      </p>
    )
  }

  const renderConfigFields = () => {
    switch (node.type) {
      case 'aiAgentNode':
        return (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Model</label>
              <select
                value={(config as unknown as AIAgentConfig).model || 'claude-sonnet'}
                onChange={(e) => updateConfig('model', e.target.value)}
                className="w-full p-2 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <optgroup label="Anthropic (Claude)">
                  <option value="claude-sonnet">Claude Sonnet (aanbevolen)</option>
                  <option value="claude-haiku">Claude Haiku (snel & goedkoop)</option>
                  <option value="claude-opus">Claude Opus (beste kwaliteit)</option>
                </optgroup>
                <optgroup label="Google (Gemini)">
                  <option value="gemini-flash">Gemini Flash (snel & goedkoop)</option>
                  <option value="gemini-pro">Gemini Pro (hoge kwaliteit)</option>
                </optgroup>
                <optgroup label="OpenAI (GPT)">
                  <option value="gpt-4o">GPT-4o (snel)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini (goedkoop)</option>
                </optgroup>
              </select>
              <p className="text-xs text-surface-400">
                Kies een model op basis van snelheid, kwaliteit en kosten
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">
                Prompt <span className="text-red-500">*</span>
              </label>
              <textarea
                value={(config as unknown as AIAgentConfig).prompt || ''}
                onChange={(e) => updateConfig('prompt', e.target.value)}
                placeholder="Gebruik {{input}} of {{previous_output}} voor dynamische waarden"
                className={`w-full h-40 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm ${
                  errors.prompt ? 'border-red-300 bg-red-50' : 'border-surface-200'
                }`}
              />
              {renderError('prompt')}
              <p className="text-xs text-surface-400">
                Variabelen: {"{{input}}"}, {"{{previous_output}}"}, {"{{node_X_output}}"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Temperatuur</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={(config as unknown as AIAgentConfig).temperature || 0.7}
                  onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                  className="w-full p-2 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700">Max Tokens</label>
                <input
                  type="number"
                  min="100"
                  max="4096"
                  step="100"
                  value={(config as unknown as AIAgentConfig).maxTokens || 2048}
                  onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value))}
                  className="w-full p-2 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </>
        )

      case 'emailNode':
        return (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">
                Naar (email) <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={(config as unknown as EmailConfig).to || ''}
                onChange={(e) => updateConfig('to', e.target.value)}
                placeholder="email@voorbeeld.nl"
                className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.to ? 'border-red-300 bg-red-50' : 'border-surface-200'
                }`}
              />
              {renderError('to')}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">
                Onderwerp <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(config as unknown as EmailConfig).subject || ''}
                onChange={(e) => updateConfig('subject', e.target.value)}
                placeholder="Email onderwerp"
                className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.subject ? 'border-red-300 bg-red-50' : 'border-surface-200'
                }`}
              />
              {renderError('subject')}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Template</label>
              <textarea
                value={(config as unknown as EmailConfig).template || ''}
                onChange={(e) => updateConfig('template', e.target.value)}
                placeholder="Email body - gebruik {{previous_output}} voor de workflow output"
                className="w-full h-32 p-3 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
              />
            </div>
          </>
        )

      case 'webhookNode':
        return (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">
                URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={(config as unknown as WebhookConfig).url || ''}
                onChange={(e) => updateConfig('url', e.target.value)}
                placeholder="https://api.voorbeeld.nl/webhook"
                className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.url ? 'border-red-300 bg-red-50' : 'border-surface-200'
                }`}
              />
              {renderError('url')}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Methode</label>
              <select
                value={(config as unknown as WebhookConfig).method || 'POST'}
                onChange={(e) => updateConfig('method', e.target.value)}
                className="w-full p-2 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Headers</label>
              <HeadersEditor
                headers={(config as unknown as WebhookConfig).headers || {}}
                onChange={(headers) => updateConfig('headers', headers)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Body Template</label>
              <textarea
                value={(config as unknown as WebhookConfig).bodyTemplate || '{{previous_output}}'}
                onChange={(e) => updateConfig('bodyTemplate', e.target.value)}
                placeholder="JSON body - gebruik {{previous_output}} voor dynamische data"
                className="w-full h-24 p-3 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm font-mono"
              />
              <p className="text-xs text-surface-400">
                Tip: {"{{previous_output}}"} bevat de output van de vorige node
              </p>
            </div>
          </>
        )

      case 'delayNode':
        return (
          <>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <p className="text-xs text-amber-700">
                <strong>Let op:</strong> Voor nu worden alleen seconden ondersteund (max 60s).
                Langere delays komen in een toekomstige update.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Wachttijd (seconden)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={(config as unknown as DelayConfig).duration || 5}
                onChange={(e) => {
                  const value = Math.min(60, Math.max(1, parseInt(e.target.value) || 1))
                  updateConfig('duration', value)
                  updateConfig('unit', 'seconds')
                }}
                className="w-full p-2 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-surface-400">
                Minimaal 1, maximaal 60 seconden
              </p>
            </div>
          </>
        )

      case 'conditionNode':
        return (
          <>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
              <p className="text-xs text-yellow-700">
                De conditie wordt geëvalueerd op de output van de vorige node.
                Bij &quot;waar&quot; gaat de flow naar <strong className="text-green-600">Ja</strong>,
                anders naar <strong className="text-red-600">Nee</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Type conditie</label>
              <select
                value={(config as unknown as ConditionConfig).mode || 'contains'}
                onChange={(e) => updateConfig('mode', e.target.value)}
                className="w-full p-2 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="contains">Bevat tekst</option>
                <option value="equals">Is gelijk aan</option>
                <option value="not_equals">Is niet gelijk aan</option>
                <option value="regex">Regex match</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">
                Waarde <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(config as unknown as ConditionConfig).condition || ''}
                onChange={(e) => updateConfig('condition', e.target.value)}
                placeholder={
                  (config as unknown as ConditionConfig).mode === 'regex'
                    ? 'bijv. \\d{4}-\\d{2}-\\d{2}'
                    : 'bijv. succes, ja, goedgekeurd'
                }
                className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.condition ? 'border-red-300 bg-red-50' : 'border-surface-200'
                }`}
              />
              {renderError('condition')}
              {(config as unknown as ConditionConfig).mode === 'regex' && (
                <p className="text-xs text-surface-400">
                  Gebruik een JavaScript-compatibele regex
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="caseSensitive"
                checked={(config as unknown as ConditionConfig).caseSensitive || false}
                onChange={(e) => updateConfig('caseSensitive', e.target.checked)}
                className="rounded border-surface-300"
              />
              <label htmlFor="caseSensitive" className="text-sm text-surface-600">
                Hoofdlettergevoelig
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-green-600">Ja-label</label>
                <input
                  type="text"
                  value={(config as unknown as ConditionConfig).trueLabel || 'Ja'}
                  onChange={(e) => updateConfig('trueLabel', e.target.value)}
                  className="w-full p-2 border border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-red-600">Nee-label</label>
                <input
                  type="text"
                  value={(config as unknown as ConditionConfig).falseLabel || 'Nee'}
                  onChange={(e) => updateConfig('falseLabel', e.target.value)}
                  className="w-full p-2 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-50"
                />
              </div>
            </div>
          </>
        )

      case 'triggerNode':
        return (
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-700">
              Dit is het startpunt van je workflow. De gebruiker voert hier de input in wanneer de workflow wordt uitgevoerd.
            </p>
          </div>
        )

      case 'outputNode':
        return (
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700">
              Dit is het eindpunt van je workflow. Alle resultaten van de vorige nodes worden hier verzameld.
            </p>
          </div>
        )

      default:
        return (
          <p className="text-sm text-surface-500">
            Geen configuratie beschikbaar voor dit type node.
          </p>
        )
    }
  }

  return (
    <div className="w-80 bg-white border-l border-surface-200 flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-surface-200 px-4 flex items-center justify-between">
        <h3 className="font-semibold text-surface-900">Node configuratie</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-surface-700">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full p-2 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Type-specific config */}
        {renderConfigFields()}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-surface-200 space-y-2">
        <Button onClick={handleSave} className="w-full">
          Opslaan
        </Button>
        <Button variant="outline" onClick={onDelete} className="w-full text-red-600 hover:bg-red-50">
          <Trash2 className="h-4 w-4 mr-2" />
          Verwijderen
        </Button>
      </div>
    </div>
  )
}

// Sub-component for headers editor
function HeadersEditor({
  headers,
  onChange,
}: {
  headers: Record<string, string>
  onChange: (headers: Record<string, string>) => void
}) {
  const entries = Object.entries(headers)

  const addHeader = () => {
    onChange({ ...headers, '': '' })
  }

  const updateHeader = (oldKey: string, newKey: string, value: string) => {
    const newHeaders = { ...headers }
    if (oldKey !== newKey) {
      delete newHeaders[oldKey]
    }
    newHeaders[newKey] = value
    onChange(newHeaders)
  }

  const removeHeader = (key: string) => {
    const newHeaders = { ...headers }
    delete newHeaders[key]
    onChange(newHeaders)
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value], index) => (
        <div key={index} className="flex gap-2">
          <input
            type="text"
            value={key}
            onChange={(e) => updateHeader(key, e.target.value, value)}
            placeholder="Header naam"
            className="flex-1 p-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => updateHeader(key, key, e.target.value)}
            placeholder="Waarde"
            className="flex-1 p-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeHeader(key)}
            className="text-red-500 hover:bg-red-50 px-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={addHeader}
        className="w-full text-surface-600"
      >
        <Plus className="h-4 w-4 mr-1" />
        Header toevoegen
      </Button>
    </div>
  )
}
