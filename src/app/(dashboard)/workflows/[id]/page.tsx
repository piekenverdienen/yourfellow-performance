'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { WorkflowEditor } from '@/components/workflow/WorkflowEditor'
import { Loader2 } from 'lucide-react'
import type { Workflow, WorkflowNode, WorkflowEdge } from '@/types/workflow'

interface WorkflowEditorPageProps {
  params: Promise<{ id: string }>
}

export default function WorkflowEditorPage({ params }: WorkflowEditorPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [executeResult, setExecuteResult] = useState<string | null>(null)

  useEffect(() => {
    fetchWorkflow()
  }, [id])

  const fetchWorkflow = async () => {
    try {
      const res = await fetch(`/api/workflows/${id}`)
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setWorkflow(data.workflow)
      }
    } catch (err) {
      setError('Failed to load workflow')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (name: string, nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, nodes, edges }),
      })

      const data = await res.json()

      if (data.error) {
        alert(`Fout bij opslaan: ${data.error}`)
      } else {
        setWorkflow(data.workflow)
      }
    } catch (err) {
      alert('Fout bij opslaan van workflow')
    }
  }

  const handleExecute = async (input: string) => {
    try {
      setExecuteResult(null)

      const res = await fetch(`/api/workflows/${id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })

      const data = await res.json()

      if (data.success) {
        // Show the output in a modal or side panel
        const output = typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2)
        setExecuteResult(output)
      } else {
        alert(`Fout: ${data.error}`)
      }
    } catch (err) {
      alert('Fout bij uitvoeren van workflow')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !workflow) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-red-500 mb-4">{error || 'Workflow niet gevonden'}</p>
        <button
          onClick={() => router.push('/workflows')}
          className="text-primary hover:underline"
        >
          Terug naar overzicht
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <WorkflowEditor
        workflowId={id}
        initialName={workflow.name}
        initialNodes={workflow.nodes as WorkflowNode[]}
        initialEdges={workflow.edges as WorkflowEdge[]}
        onSave={handleSave}
        onExecute={handleExecute}
      />

      {/* Results panel */}
      {executeResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-surface-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Workflow Resultaat</h3>
              <button
                onClick={() => setExecuteResult(null)}
                className="text-surface-500 hover:text-surface-700"
              >
                Sluiten
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="whitespace-pre-wrap text-sm bg-surface-50 p-4 rounded-lg">
                {executeResult}
              </pre>
            </div>
            <div className="p-4 border-t border-surface-200">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(executeResult)
                  alert('Gekopieerd naar klembord!')
                }}
                className="px-4 py-2 bg-primary text-black rounded-lg hover:bg-primary/90"
              >
                Kopiëren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
