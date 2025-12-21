'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react'
import type { WorkflowNode, WorkflowEdge } from '@/types/workflow'

interface AIFlowBuilderProps {
  onGenerate: (nodes: WorkflowNode[], edges: WorkflowEdge[], todos: Todo[]) => void
  onClose: () => void
  clientId?: string
}

interface Todo {
  nodeId: string
  field: string
  reason: string
  nodeLabel: string
}

interface GenerateResponse {
  success: boolean
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  todos: Todo[]
  validation: {
    valid: boolean
    errorCount: number
    warningCount: number
  }
  error?: string
}

export function AIFlowBuilder({ onGenerate, onClose, clientId }: AIFlowBuilderProps) {
  const [intent, setIntent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Constraint options
  const [mustUseEmail, setMustUseEmail] = useState(false)
  const [mustUseWebhook, setMustUseWebhook] = useState(false)

  const handleGenerate = async () => {
    if (!intent.trim() || intent.length < 10) {
      setError('Beschrijf je workflow in minimaal 10 karakters')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/workflows/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentText: intent,
          clientId,
          constraints: {
            mustUseEmail,
            mustUseWebhook,
          },
        }),
      })

      const data: GenerateResponse = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Er is een fout opgetreden')
        return
      }

      onGenerate(data.nodes, data.edges, data.todos)
    } catch (err) {
      setError('Kon geen verbinding maken met de server')
    } finally {
      setIsGenerating(false)
    }
  }

  const examples = [
    'Genereer een blog post over een onderwerp en stuur het resultaat naar een webhook',
    'Maak social media posts in verschillende tonen en kies de beste op basis van lengte',
    'Schrijf een gepersonaliseerde email op basis van klantinput',
    'Analyseer tekst en routeer naar verschillende outputs afhankelijk van het sentiment',
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-surface-900">Bouw met AI</h2>
              <p className="text-sm text-surface-500">Beschrijf wat je wilt bouwen</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Intent input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-surface-700">
              Wat wil je bouwen?
            </label>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="Bijv. 'Ik wil een workflow die blog posts genereert over AI marketing en ze per email verstuurt'"
              className="w-full h-32 p-4 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm"
              disabled={isGenerating}
            />
            <p className="text-xs text-surface-400">
              Wees zo specifiek mogelijk voor de beste resultaten
            </p>
          </div>

          {/* Examples */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-surface-500 uppercase tracking-wide">
              Voorbeelden
            </label>
            <div className="grid grid-cols-1 gap-2">
              {examples.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setIntent(example)}
                  disabled={isGenerating}
                  className="text-left text-sm p-3 bg-surface-50 hover:bg-surface-100 rounded-lg border border-surface-200 transition-colors disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Constraints */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-surface-500 uppercase tracking-wide">
              Opties
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={mustUseEmail}
                  onChange={(e) => setMustUseEmail(e.target.checked)}
                  disabled={isGenerating}
                  className="rounded border-surface-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Moet email versturen</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={mustUseWebhook}
                  onChange={(e) => setMustUseWebhook(e.target.checked)}
                  disabled={isGenerating}
                  className="rounded border-surface-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Moet webhook aanroepen</span>
              </label>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">{error}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-200 flex items-center justify-between bg-surface-50">
          <p className="text-xs text-surface-400">
            AI genereert een voorstel dat je kunt aanpassen
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={isGenerating}>
              Annuleren
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !intent.trim()}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Genereren...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Genereer Workflow
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface TodoChecklistProps {
  todos: Todo[]
  onTodoClick: (nodeId: string) => void
  onClose: () => void
}

export function TodoChecklist({ todos, onTodoClick, onClose }: TodoChecklistProps) {
  if (todos.length === 0) return null

  return (
    <div className="absolute top-4 right-4 w-72 bg-white rounded-xl shadow-xl border border-surface-200 overflow-hidden z-10">
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-800">
            Nog in te vullen ({todos.length})
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {todos.map((todo, i) => (
          <button
            key={i}
            onClick={() => onTodoClick(todo.nodeId)}
            className="w-full text-left px-4 py-3 hover:bg-surface-50 border-b border-surface-100 last:border-0 transition-colors"
          >
            <div className="text-sm font-medium text-surface-900">{todo.nodeLabel}</div>
            <div className="text-xs text-surface-500 mt-0.5">
              Veld &apos;{todo.field}&apos; ontbreekt
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
