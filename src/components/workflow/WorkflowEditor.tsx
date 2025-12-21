'use client'

import { useCallback, useState, useRef } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  Panel,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeTypes } from './nodes'
import { NodeSidebar } from './NodeSidebar'
import { NodeConfigPanel } from './NodeConfigPanel'
import { AIFlowBuilder, TodoChecklist } from './AIFlowBuilder'
import { Button } from '@/components/ui/button'
import { Save, Play, ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import type { WorkflowNode, WorkflowEdge, BaseNodeData, TriggerConfig } from '@/types/workflow'
import Link from 'next/link'

interface Todo {
  nodeId: string
  field: string
  reason: string
  nodeLabel: string
}

interface WorkflowEditorProps {
  workflowId?: string
  initialName?: string
  initialNodes?: WorkflowNode[]
  initialEdges?: WorkflowEdge[]
  onSave?: (name: string, nodes: WorkflowNode[], edges: WorkflowEdge[]) => Promise<void>
  onExecute?: (input: string) => Promise<void>
}

export function WorkflowEditor({
  workflowId,
  initialName = 'Nieuwe Workflow',
  initialNodes = [],
  initialEdges = [],
  onSave,
  onExecute,
}: WorkflowEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges as Edge[])
  const [workflowName, setWorkflowName] = useState(initialName)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executeInput, setExecuteInput] = useState('')
  const [showExecuteModal, setShowExecuteModal] = useState(false)
  const [showAIBuilder, setShowAIBuilder] = useState(false)
  const [todos, setTodos] = useState<Todo[]>([])
  const [showTodos, setShowTodos] = useState(false)

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow')
      const nodeData = event.dataTransfer.getData('nodeData')

      if (!type || !reactFlowWrapper.current) return

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = {
        x: event.clientX - reactFlowBounds.left - 100,
        y: event.clientY - reactFlowBounds.top - 25,
      }

      const parsedData = JSON.parse(nodeData) as BaseNodeData

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: parsedData,
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [setNodes]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const updateNodeData = useCallback(
    (nodeId: string, newData: Partial<BaseNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, ...newData },
            }
          }
          return node
        })
      )
    },
    [setNodes]
  )

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId))
      setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
      setSelectedNode(null)
    },
    [setNodes, setEdges]
  )

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      await onSave(workflowName, nodes as WorkflowNode[], edges as WorkflowEdge[])
    } finally {
      setIsSaving(false)
    }
  }

  const handleExecute = async () => {
    if (!onExecute) return
    setIsExecuting(true)
    try {
      await onExecute(executeInput)
      setShowExecuteModal(false)
      setExecuteInput('')
    } finally {
      setIsExecuting(false)
    }
  }

  const handleAIGenerate = useCallback(
    (generatedNodes: WorkflowNode[], generatedEdges: WorkflowEdge[], generatedTodos: Todo[]) => {
      // Replace current nodes and edges with generated ones
      setNodes(generatedNodes as Node[])
      setEdges(generatedEdges as Edge[])
      setTodos(generatedTodos)
      setShowAIBuilder(false)

      // Show todos panel if there are any
      if (generatedTodos.length > 0) {
        setShowTodos(true)
      }
    },
    [setNodes, setEdges]
  )

  const handleTodoClick = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (node) {
        setSelectedNode(node)
      }
    },
    [nodes]
  )

  return (
    <div className="flex h-[calc(100vh-120px)] bg-surface-50 rounded-xl overflow-hidden border border-surface-200">
      {/* Sidebar with node types */}
      <NodeSidebar />

      {/* Main editor area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-14 border-b border-surface-200 bg-white px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/workflows">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Terug
              </Button>
            </Link>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAIBuilder(true)}
              className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 hover:border-purple-300 text-purple-700"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Bouw met AI
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Opslaan
            </Button>
            <Button onClick={() => setShowExecuteModal(true)} disabled={nodes.length === 0}>
              <Play className="h-4 w-4 mr-2" />
              Uitvoeren
            </Button>
          </div>
        </div>

        {/* React Flow canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            defaultEdgeOptions={{
              style: { strokeWidth: 2, stroke: '#94A3B8' },
              type: 'smoothstep',
            }}
          >
            <Controls className="bg-white rounded-lg shadow-lg border border-surface-200" />
            <MiniMap
              className="bg-white rounded-lg shadow-lg border border-surface-200"
              nodeColor={(node) => {
                switch (node.type) {
                  case 'triggerNode':
                    return '#22C55E'
                  case 'aiAgentNode':
                    return '#8B5CF6'
                  case 'emailNode':
                    return '#3B82F6'
                  case 'outputNode':
                    return '#EF4444'
                  default:
                    return '#94A3B8'
                }
              }}
            />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E2E8F0" />

            {nodes.length === 0 && (
              <Panel position="top-center" className="mt-20">
                <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
                  <p className="text-surface-600 mb-2">
                    Sleep nodes vanuit de zijbalk naar het canvas om je workflow te bouwen.
                  </p>
                  <p className="text-sm text-surface-400">
                    Begin met een <span className="text-green-600 font-medium">Start Trigger</span> en
                    eindig met een <span className="text-red-600 font-medium">Output</span>
                  </p>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* Node config panel */}
      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onUpdate={(data) => updateNodeData(selectedNode.id, data)}
          onDelete={() => deleteNode(selectedNode.id)}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* Execute modal */}
      {showExecuteModal && (() => {
        // Find trigger node to check configuration
        const triggerNode = nodes.find((n) => n.type === 'triggerNode')
        const triggerConfig = triggerNode?.data?.config as TriggerConfig | undefined
        const triggerType = triggerConfig?.triggerType || 'manual'

        // Only require input for manual triggers with inputRequired=true
        const needsInput = triggerType === 'manual' && triggerConfig?.inputRequired !== false

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
              <h3 className="text-lg font-semibold mb-4">
                {needsInput ? 'Workflow uitvoeren' : 'Workflow starten'}
              </h3>

              {triggerType === 'schedule' && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Gepland:</strong> {triggerConfig?.scheduleDescription || triggerConfig?.scheduleCron || 'Schema geconfigureerd'}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    In productie wordt deze automatisch uitgevoerd volgens schema.
                  </p>
                </div>
              )}

              {triggerType === 'webhook' && (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-700">
                    <strong>Webhook:</strong> /api/webhooks/{triggerConfig?.webhookPath || 'workflow'}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    In productie wordt deze getriggerd via de webhook URL.
                  </p>
                </div>
              )}

              {needsInput ? (
                <>
                  <p className="text-sm text-surface-600 mb-4">
                    {triggerConfig?.inputPlaceholder || 'Voer een input in om de workflow te starten:'}
                  </p>
                  <textarea
                    value={executeInput}
                    onChange={(e) => setExecuteInput(e.target.value)}
                    placeholder="Bijv. 'Schrijf een blog over AI marketing'"
                    className="w-full h-32 p-3 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
                  <p className="text-sm text-green-700">
                    {triggerType === 'schedule'
                      ? 'Klik op Start om de workflow nu uit te voeren (test run).'
                      : triggerType === 'webhook'
                      ? 'Klik op Start om de workflow handmatig te testen.'
                      : 'Deze workflow start direct zonder input.'}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowExecuteModal(false)}>
                  Annuleren
                </Button>
                <Button
                  onClick={handleExecute}
                  disabled={isExecuting || (needsInput && !executeInput.trim())}
                >
                  {isExecuting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Start
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* AI Flow Builder modal */}
      {showAIBuilder && (
        <AIFlowBuilder
          onGenerate={handleAIGenerate}
          onClose={() => setShowAIBuilder(false)}
        />
      )}

      {/* Todo checklist */}
      {showTodos && todos.length > 0 && (
        <TodoChecklist
          todos={todos}
          onTodoClick={handleTodoClick}
          onClose={() => setShowTodos(false)}
        />
      )}
    </div>
  )
}
