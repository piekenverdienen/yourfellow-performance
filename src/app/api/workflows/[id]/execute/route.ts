import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import type { WorkflowNode, WorkflowEdge, NodeResult, AIAgentConfig } from '@/types/workflow'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { input, clientId } = body

    if (!input) {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 })
    }

    // Verify client access if clientId provided
    if (clientId) {
      const { data: clientAccess } = await supabase
        .rpc('has_client_access', { check_client_id: clientId, min_role: 'editor' })

      if (!clientAccess) {
        return NextResponse.json({ error: 'Geen toegang tot deze client' }, { status: 403 })
      }
    }

    // Fetch the workflow
    const { data: workflow, error: fetchError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .or(`user_id.eq.${user.id},is_template.eq.true`)
      .single()

    if (fetchError || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const nodes = workflow.nodes as WorkflowNode[]
    const edges = workflow.edges as WorkflowEdge[]

    // Create a workflow run record
    const { data: run, error: runError } = await supabase
      .from('workflow_runs')
      .insert({
        workflow_id: workflowId,
        user_id: user.id,
        client_id: clientId || null,
        status: 'running',
        input_data: { input },
        node_results: {},
      })
      .select()
      .single()

    if (runError) {
      console.error('Error creating workflow run:', runError)
      return NextResponse.json({ error: 'Failed to start workflow' }, { status: 500 })
    }

    // Execute the workflow
    try {
      const results = await executeWorkflow(nodes, edges, input)

      // Update the run with results
      await supabase
        .from('workflow_runs')
        .update({
          status: 'completed',
          node_results: results,
          completed_at: new Date().toISOString(),
        })
        .eq('id', run.id)

      // Update workflow stats
      await supabase
        .from('workflows')
        .update({
          total_runs: workflow.total_runs + 1,
          last_run_at: new Date().toISOString(),
        })
        .eq('id', workflowId)

      // Get final output
      const outputNodeId = nodes.find((n) => n.type === 'outputNode')?.id
      const finalOutput = outputNodeId ? results[outputNodeId]?.output : null

      return NextResponse.json({
        success: true,
        runId: run.id,
        results,
        output: finalOutput,
      })
    } catch (execError) {
      const errorMessage = execError instanceof Error ? execError.message : 'Unknown error'

      // Update the run with error
      await supabase
        .from('workflow_runs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', run.id)

      return NextResponse.json({
        success: false,
        runId: run.id,
        error: errorMessage,
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Workflow execution error:', error)
    return NextResponse.json({ error: 'Failed to execute workflow' }, { status: 500 })
  }
}

async function executeWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  input: string
): Promise<Record<string, NodeResult>> {
  const results: Record<string, NodeResult> = {}
  const executed = new Set<string>()

  // Build adjacency list for node dependencies
  const dependencies: Record<string, string[]> = {}
  const dependents: Record<string, string[]> = {}

  nodes.forEach((node) => {
    dependencies[node.id] = []
    dependents[node.id] = []
  })

  edges.forEach((edge) => {
    dependencies[edge.target].push(edge.source)
    dependents[edge.source].push(edge.target)
  })

  // Find start nodes (nodes with no dependencies or trigger nodes)
  const startNodes = nodes.filter(
    (node) => node.type === 'triggerNode' || dependencies[node.id].length === 0
  )

  // Execute nodes in topological order
  const queue = [...startNodes]

  while (queue.length > 0) {
    const node = queue.shift()!

    if (executed.has(node.id)) continue

    // Check if all dependencies are executed
    const deps = dependencies[node.id]
    const allDepsExecuted = deps.every((depId) => executed.has(depId))

    if (!allDepsExecuted) {
      queue.push(node)
      continue
    }

    // Get previous outputs
    const previousOutputs: string[] = deps.map((depId) => {
      const result = results[depId]
      return typeof result?.output === 'string' ? result.output : JSON.stringify(result?.output || '')
    })

    const previousOutput = previousOutputs.join('\n\n')

    // Execute the node
    const result = await executeNode(node, input, previousOutput, results)
    results[node.id] = result
    executed.add(node.id)

    // Add dependents to queue
    dependents[node.id].forEach((depId) => {
      if (!executed.has(depId)) {
        queue.push(nodes.find((n) => n.id === depId)!)
      }
    })
  }

  return results
}

async function executeNode(
  node: WorkflowNode,
  input: string,
  previousOutput: string,
  allResults: Record<string, NodeResult>
): Promise<NodeResult> {
  const startedAt = new Date().toISOString()

  try {
    switch (node.type) {
      case 'triggerNode':
        return {
          status: 'completed',
          output: input,
          startedAt,
          completedAt: new Date().toISOString(),
        }

      case 'aiAgentNode':
        const config = node.data.config as unknown as AIAgentConfig
        let prompt = config.prompt || ''

        // Replace variables in prompt
        prompt = prompt.replace(/\{\{input\}\}/g, input)
        prompt = prompt.replace(/\{\{previous_output\}\}/g, previousOutput)

        // Replace specific node outputs
        const nodeRefRegex = /\{\{node_(\w+)_output\}\}/g
        prompt = prompt.replace(nodeRefRegex, (_, nodeId) => {
          const nodeResult = allResults[nodeId]
          return typeof nodeResult?.output === 'string'
            ? nodeResult.output
            : JSON.stringify(nodeResult?.output || '')
        })

        // Call Anthropic API
        const response = await anthropic.messages.create({
          model: config.model === 'claude-haiku' ? 'claude-3-haiku-20240307' : 'claude-sonnet-4-20250514',
          max_tokens: config.maxTokens || 2048,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        })

        const aiOutput = response.content[0].type === 'text' ? response.content[0].text : ''

        return {
          status: 'completed',
          output: aiOutput,
          startedAt,
          completedAt: new Date().toISOString(),
          tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        }

      case 'outputNode':
        return {
          status: 'completed',
          output: previousOutput,
          startedAt,
          completedAt: new Date().toISOString(),
        }

      case 'emailNode':
        // Email sending would be implemented here
        // For now, just pass through the data
        return {
          status: 'completed',
          output: `Email zou verzonden worden met content: ${previousOutput.slice(0, 200)}...`,
          startedAt,
          completedAt: new Date().toISOString(),
        }

      default:
        return {
          status: 'skipped',
          output: previousOutput,
          startedAt,
          completedAt: new Date().toISOString(),
        }
    }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      startedAt,
      completedAt: new Date().toISOString(),
    }
  }
}
