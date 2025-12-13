'use client'

import { useState, useEffect } from 'react'
import type { Node } from '@xyflow/react'
import { Button } from '@/components/ui/button'
import { X, Trash2 } from 'lucide-react'
import type { BaseNodeData, AIAgentConfig, EmailConfig } from '@/types/workflow'

interface NodeConfigPanelProps {
  node: Node
  onUpdate: (data: Partial<BaseNodeData>) => void
  onDelete: () => void
  onClose: () => void
}

export function NodeConfigPanel({ node, onUpdate, onDelete, onClose }: NodeConfigPanelProps) {
  const [label, setLabel] = useState(node.data.label as string)
  const [config, setConfig] = useState(node.data.config as Record<string, unknown>)

  useEffect(() => {
    setLabel(node.data.label as string)
    setConfig(node.data.config as Record<string, unknown>)
  }, [node])

  const handleSave = () => {
    onUpdate({ label, config })
  }

  const updateConfig = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
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
                <option value="claude-sonnet">Claude Sonnet</option>
                <option value="claude-haiku">Claude Haiku (snel)</option>
                <option value="gpt-4">GPT-4</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Prompt</label>
              <textarea
                value={(config as unknown as AIAgentConfig).prompt || ''}
                onChange={(e) => updateConfig('prompt', e.target.value)}
                placeholder="Gebruik {{input}} of {{previous_output}} voor dynamische waarden"
                className="w-full h-40 p-3 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
              />
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
              <label className="text-sm font-medium text-surface-700">Naar (email)</label>
              <input
                type="email"
                value={(config as unknown as EmailConfig).to || ''}
                onChange={(e) => updateConfig('to', e.target.value)}
                placeholder="email@voorbeeld.nl"
                className="w-full p-2 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700">Onderwerp</label>
              <input
                type="text"
                value={(config as unknown as EmailConfig).subject || ''}
                onChange={(e) => updateConfig('subject', e.target.value)}
                placeholder="Email onderwerp"
                className="w-full p-2 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
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
