import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProviderAdapter, isProviderAvailable } from '@/lib/ai/providers'
import { getModel } from '@/lib/ai/models'
import { validateWorkflow, extractTodos } from '@/lib/workflows/validate'
import { NODE_DEFINITIONS, type WorkflowNode, type WorkflowEdge } from '@/types/workflow'

const GENERATION_MODEL = 'claude-sonnet'

interface GenerateRequest {
  intentText: string
  clientId?: string
  constraints?: {
    mustUseEmail?: boolean
    mustUseWebhook?: boolean
    maxNodes?: number
  }
}

interface GeneratedWorkflow {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

/**
 * POST /api/workflows/generate
 *
 * Generates a workflow from natural language description.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json() as GenerateRequest
    const { intentText, clientId, constraints } = body

    if (!intentText || intentText.trim().length < 10) {
      return NextResponse.json(
        { error: 'Beschrijf je workflow in minimaal 10 karakters' },
        { status: 400 }
      )
    }

    // Get client context if provided
    let clientContext: string | null = null
    if (clientId) {
      const { data: client } = await supabase
        .from('clients')
        .select('name, settings')
        .eq('id', clientId)
        .single()

      if (client) {
        const ctx = (client.settings as { context?: Record<string, unknown> })?.context
        if (ctx) {
          clientContext = `Klant: ${client.name}. Tone of Voice: ${ctx.toneOfVoice || 'professioneel'}.`
        }
      }
    }

    // Check if provider is available
    const modelConfig = getModel(GENERATION_MODEL)
    if (!modelConfig || !isProviderAvailable(modelConfig.provider)) {
      return NextResponse.json(
        { error: 'AI model is niet beschikbaar. Controleer de API configuratie.' },
        { status: 503 }
      )
    }

    // Build the prompt
    const systemPrompt = buildSystemPrompt(constraints)
    const userPrompt = buildUserPrompt(intentText, clientContext, constraints)

    // Generate the workflow
    const provider = getProviderAdapter(modelConfig.provider)
    const response = await provider.generateText({
      model: modelConfig.modelName,
      systemPrompt,
      userPrompt,
      maxTokens: 4096,
      temperature: 0.3, // Lower temperature for more consistent JSON
    })

    // Parse the generated workflow
    let generatedWorkflow: GeneratedWorkflow
    try {
      generatedWorkflow = parseWorkflowFromResponse(response.content)
    } catch (parseError) {
      // Try to repair the JSON
      const repaired = await tryRepairJson(response.content, provider, modelConfig.modelName)
      if (repaired) {
        generatedWorkflow = repaired
      } else {
        console.error('Failed to parse workflow:', parseError)
        return NextResponse.json(
          { error: 'Kon workflow niet genereren. Probeer het opnieuw met een andere beschrijving.' },
          { status: 422 }
        )
      }
    }

    // Validate the generated workflow
    const validation = validateWorkflow(generatedWorkflow.nodes, generatedWorkflow.edges)

    // Extract todos (missing fields)
    const todos = extractTodos(generatedWorkflow.nodes, validation)

    // Apply auto-layout positions
    const layoutedNodes = applyAutoLayout(generatedWorkflow.nodes, generatedWorkflow.edges)

    return NextResponse.json({
      success: true,
      nodes: layoutedNodes,
      edges: generatedWorkflow.edges,
      todos,
      validation: {
        valid: validation.valid,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
      },
      usage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    })
  } catch (error) {
    console.error('Workflow generation error:', error)
    return NextResponse.json(
      { error: 'Er is een fout opgetreden bij het genereren van de workflow' },
      { status: 500 }
    )
  }
}

function buildSystemPrompt(constraints?: GenerateRequest['constraints']): string {
  const nodeTypesDescription = NODE_DEFINITIONS.map(
    (n) => `- ${n.type}: ${n.label} - ${n.description}`
  ).join('\n')

  return `Je bent een workflow generator voor een marketing automation platform.
Je genereert workflows in JSON formaat op basis van gebruikersbeschrijvingen.

BESCHIKBARE NODE TYPES:
${nodeTypesDescription}

REGELS:
1. ALTIJD beginnen met exact één "triggerNode"
2. ALTIJD eindigen met minimaal één "outputNode"
3. Elke node moet een uniek "id" hebben (formaat: "nodeType-nummer", bijv. "aiAgentNode-1")
4. Elke node heeft "type", "position" (x, y), en "data" met "label" en "config"
5. Edges verbinden nodes via "source" en "target" (node ids)
6. Voor conditionNode: gebruik "sourceHandle": "true" of "sourceHandle": "false" op edges
7. Maximum ${constraints?.maxNodes || 10} nodes
8. Geef ALLEEN valid JSON terug, geen uitleg of markdown

NODE CONFIG VEREISTEN:
- aiAgentNode: config.model (string), config.prompt (string met {{input}} of {{previous_output}})
- emailNode: config.to (string), config.subject (string), config.template (string)
- webhookNode: config.url (string), config.method ("GET" | "POST")
- delayNode: config.duration (number), config.unit ("seconds")
- conditionNode: config.mode ("contains" | "equals"), config.condition (string)

VOORBEELD OUTPUT:
{
  "nodes": [
    {"id": "triggerNode-1", "type": "triggerNode", "position": {"x": 0, "y": 100}, "data": {"label": "Start", "config": {}}},
    {"id": "aiAgentNode-1", "type": "aiAgentNode", "position": {"x": 250, "y": 100}, "data": {"label": "Content Schrijven", "config": {"model": "claude-sonnet", "prompt": "Schrijf content over: {{input}}"}}}
  ],
  "edges": [
    {"id": "e1", "source": "triggerNode-1", "target": "aiAgentNode-1"}
  ]
}`
}

function buildUserPrompt(
  intentText: string,
  clientContext: string | null,
  constraints?: GenerateRequest['constraints']
): string {
  let prompt = `Genereer een workflow voor het volgende doel:\n\n"${intentText}"\n\n`

  if (clientContext) {
    prompt += `Context: ${clientContext}\n\n`
  }

  if (constraints?.mustUseEmail) {
    prompt += 'VEREISTE: De workflow moet een email versturen.\n'
  }
  if (constraints?.mustUseWebhook) {
    prompt += 'VEREISTE: De workflow moet een webhook aanroepen.\n'
  }

  prompt += '\nGeef ALLEEN de JSON terug, zonder markdown codeblocks of uitleg.'

  return prompt
}

function parseWorkflowFromResponse(content: string): GeneratedWorkflow {
  // Try to extract JSON from the response
  let jsonStr = content.trim()

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7)
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3)
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3)
  }
  jsonStr = jsonStr.trim()

  const parsed = JSON.parse(jsonStr)

  if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
    throw new Error('Missing or invalid nodes array')
  }
  if (!parsed.edges || !Array.isArray(parsed.edges)) {
    throw new Error('Missing or invalid edges array')
  }

  // Validate and normalize nodes
  const nodes: WorkflowNode[] = parsed.nodes.map((node: Record<string, unknown>, index: number) => ({
    id: node.id || `node-${index}`,
    type: node.type || 'aiAgentNode',
    position: node.position || { x: index * 250, y: 100 },
    data: {
      label: (node.data as Record<string, unknown>)?.label || `Node ${index + 1}`,
      config: (node.data as Record<string, unknown>)?.config || {},
    },
  }))

  // Validate and normalize edges
  const edges: WorkflowEdge[] = parsed.edges.map((edge: Record<string, unknown>, index: number) => ({
    id: edge.id || `e${index}`,
    source: edge.source as string,
    target: edge.target as string,
    sourceHandle: edge.sourceHandle as string | undefined,
    targetHandle: edge.targetHandle as string | undefined,
  }))

  return { nodes, edges }
}

async function tryRepairJson(
  content: string,
  provider: ReturnType<typeof getProviderAdapter>,
  model: string
): Promise<GeneratedWorkflow | null> {
  try {
    const repairResponse = await provider.generateText({
      model,
      systemPrompt: 'Je bent een JSON reparatie tool. Repareer de volgende JSON zodat het valid is. Geef ALLEEN de gerepareerde JSON terug.',
      userPrompt: `Repareer deze JSON:\n\n${content}`,
      maxTokens: 4096,
      temperature: 0.1,
    })

    return parseWorkflowFromResponse(repairResponse.content)
  } catch {
    return null
  }
}

/**
 * Apply simple auto-layout to nodes (left-to-right DAG layout)
 */
function applyAutoLayout(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  // Build adjacency list
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()

  for (const node of nodes) {
    outgoing.set(node.id, [])
    incoming.set(node.id, [])
  }

  for (const edge of edges) {
    outgoing.get(edge.source)?.push(edge.target)
    incoming.get(edge.target)?.push(edge.source)
  }

  // Find start nodes (no incoming edges)
  const startNodes = nodes.filter((n) => (incoming.get(n.id)?.length || 0) === 0)

  // BFS to assign layers
  const layers = new Map<string, number>()
  const queue = startNodes.map((n) => ({ id: n.id, layer: 0 }))
  const visited = new Set<string>()

  while (queue.length > 0) {
    const { id, layer } = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)

    layers.set(id, Math.max(layers.get(id) || 0, layer))

    for (const targetId of outgoing.get(id) || []) {
      queue.push({ id: targetId, layer: layer + 1 })
    }
  }

  // Group nodes by layer
  const nodesByLayer = new Map<number, WorkflowNode[]>()
  for (const node of nodes) {
    const layer = layers.get(node.id) || 0
    if (!nodesByLayer.has(layer)) {
      nodesByLayer.set(layer, [])
    }
    nodesByLayer.get(layer)!.push(node)
  }

  // Position nodes
  const LAYER_WIDTH = 280
  const NODE_HEIGHT = 120
  const START_X = 50
  const START_Y = 50

  const layoutedNodes: WorkflowNode[] = []

  Array.from(nodesByLayer.entries()).forEach(([layer, layerNodes]) => {
    const x = START_X + layer * LAYER_WIDTH

    for (let i = 0; i < layerNodes.length; i++) {
      const node = layerNodes[i]
      const y = START_Y + i * NODE_HEIGHT

      layoutedNodes.push({
        ...node,
        position: { x, y },
      })
    }
  })

  return layoutedNodes
}
