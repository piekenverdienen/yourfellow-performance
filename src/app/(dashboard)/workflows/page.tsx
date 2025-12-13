'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Play,
  GitBranch,
  Clock,
  Trash2,
  Copy,
  Loader2,
  LayoutTemplate,
} from 'lucide-react'
import type { Workflow } from '@/types/workflow'

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [templates, setTemplates] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchWorkflows()
  }, [])

  const fetchWorkflows = async () => {
    try {
      const res = await fetch('/api/workflows?templates=true')
      const data = await res.json()

      const userWorkflows = data.workflows?.filter((w: Workflow) => !w.is_template) || []
      const templateWorkflows = data.workflows?.filter((w: Workflow) => w.is_template) || []

      setWorkflows(userWorkflows)
      setTemplates(templateWorkflows)
    } catch (error) {
      console.error('Error fetching workflows:', error)
    } finally {
      setLoading(false)
    }
  }

  const createWorkflow = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Nieuwe Workflow',
          nodes: [],
          edges: [],
        }),
      })
      const data = await res.json()

      if (data.workflow) {
        window.location.href = `/workflows/${data.workflow.id}`
      }
    } catch (error) {
      console.error('Error creating workflow:', error)
    } finally {
      setCreating(false)
    }
  }

  const duplicateWorkflow = async (workflow: Workflow) => {
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${workflow.name} (kopie)`,
          description: workflow.description,
          nodes: workflow.nodes,
          edges: workflow.edges,
        }),
      })
      const data = await res.json()

      if (data.workflow) {
        window.location.href = `/workflows/${data.workflow.id}`
      }
    } catch (error) {
      console.error('Error duplicating workflow:', error)
    }
  }

  const deleteWorkflow = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze workflow wilt verwijderen?')) return

    try {
      await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
      setWorkflows((prev) => prev.filter((w) => w.id !== id))
    } catch (error) {
      console.error('Error deleting workflow:', error)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Workflows</h1>
          <p className="text-surface-600 mt-1">
            Automatiseer je marketing taken met AI-powered workflows
          </p>
        </div>
        <Button onClick={createWorkflow} disabled={creating}>
          {creating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Nieuwe Workflow
        </Button>
      </div>

      {/* User Workflows */}
      <div>
        <h2 className="text-lg font-semibold text-surface-900 mb-4">Mijn Workflows</h2>

        {workflows.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <GitBranch className="h-12 w-12 text-surface-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-surface-900 mb-2">
                Nog geen workflows
              </h3>
              <p className="text-surface-600 mb-4">
                Maak je eerste workflow of begin met een template
              </p>
              <Button onClick={createWorkflow}>
                <Plus className="h-4 w-4 mr-2" />
                Maak workflow
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((workflow) => (
              <Card key={workflow.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{workflow.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => duplicateWorkflow(workflow)}
                        title="Dupliceren"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteWorkflow(workflow.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        title="Verwijderen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-surface-600 line-clamp-2">
                    {workflow.description || 'Geen beschrijving'}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-surface-500">
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {(workflow.nodes as unknown[])?.length || 0} nodes
                    </span>
                    <span className="flex items-center gap-1">
                      <Play className="h-3 w-3" />
                      {workflow.total_runs} runs
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(workflow.updated_at)}
                    </span>
                  </div>

                  <Link href={`/workflows/${workflow.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      Openen
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Templates */}
      {templates.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <LayoutTemplate className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-surface-900">Templates</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="hover:shadow-lg transition-shadow border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-surface-600 line-clamp-2">
                    {template.description || 'Geen beschrijving'}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-surface-500">
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {(template.nodes as unknown[])?.length || 0} nodes
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => duplicateWorkflow(template)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Gebruik template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
