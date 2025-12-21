import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProviderAdapter, isProviderAvailable } from '@/lib/ai/providers'
import { getModel } from '@/lib/ai/models'
import { sendWorkflowEmail } from '@/lib/email'
import type {
  WorkflowNode,
  WorkflowEdge,
  NodeResult,
  AIAgentConfig,
  WebhookConfig,
  DelayConfig,
  ConditionConfig,
  EmailConfig,
  TriggerConfig,
} from '@/types/workflow'

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
    const { input = '', clientId } = body

    // Input validation happens after we fetch the workflow to check trigger config

    // Get client context if clientId provided
    let clientContext: Record<string, unknown> | null = null
    let clientName: string | null = null

    if (clientId) {
      const { data: clientAccess } = await supabase
        .rpc('has_client_access', { check_client_id: clientId, min_role: 'editor' })

      if (!clientAccess) {
        return NextResponse.json({ error: 'Geen toegang tot deze klant' }, { status: 403 })
      }

      // Fetch client with context
      const { data: client } = await supabase
        .from('clients')
        .select('name, settings')
        .eq('id', clientId)
        .single()

      if (client) {
        clientName = client.name
        clientContext = (client.settings as { context?: Record<string, unknown> })?.context || null
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

    // Check if input is required based on trigger configuration
    const triggerNode = nodes.find((n) => n.type === 'triggerNode')
    const triggerConfig = triggerNode?.data?.config as TriggerConfig | undefined
    const triggerType = triggerConfig?.triggerType || 'manual'
    const inputRequired = triggerType === 'manual' && triggerConfig?.inputRequired !== false

    if (inputRequired && !input) {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 })
    }

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
      const results = await executeWorkflow(nodes, edges, input, clientName, clientContext)

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

// Helper to get branch from edge (based on sourceHandle or explicit data)
function getEdgeBranch(edge: WorkflowEdge): 'true' | 'false' | 'default' {
  // If edge has explicit branch data, use it
  if (edge.data?.branch) {
    return edge.data.branch
  }
  // Otherwise, infer from sourceHandle (set by ConditionNode)
  if (edge.sourceHandle === 'true') return 'true'
  if (edge.sourceHandle === 'false') return 'false'
  return 'default'
}

async function executeWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  input: string,
  clientName: string | null,
  clientContext: Record<string, unknown> | null
): Promise<Record<string, NodeResult>> {
  const results: Record<string, NodeResult> = {}
  const executed = new Set<string>()
  const skippedNodes = new Set<string>()

  // Build adjacency list for node dependencies
  const dependencies: Record<string, string[]> = {}
  const dependents: Record<string, { nodeId: string; branch: 'true' | 'false' | 'default' }[]> = {}
  const incomingEdges: Record<string, WorkflowEdge[]> = {}

  nodes.forEach((node) => {
    dependencies[node.id] = []
    dependents[node.id] = []
    incomingEdges[node.id] = []
  })

  edges.forEach((edge) => {
    dependencies[edge.target].push(edge.source)
    dependents[edge.source].push({
      nodeId: edge.target,
      branch: getEdgeBranch(edge),
    })
    incomingEdges[edge.target].push(edge)
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
    const allDepsExecuted = deps.every((depId) => executed.has(depId) || skippedNodes.has(depId))

    if (!allDepsExecuted) {
      queue.push(node)
      continue
    }

    // Check if this node should be skipped due to condition branching
    const shouldSkip = checkIfNodeShouldBeSkipped(node, incomingEdges[node.id], results, skippedNodes)

    if (shouldSkip) {
      skippedNodes.add(node.id)
      results[node.id] = {
        status: 'skipped',
        output: 'Overgeslagen door conditie',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }
      executed.add(node.id)

      // Add dependents to queue (they will also be checked for skipping)
      dependents[node.id].forEach((dep) => {
        if (!executed.has(dep.nodeId) && !skippedNodes.has(dep.nodeId)) {
          queue.push(nodes.find((n) => n.id === dep.nodeId)!)
        }
      })
      continue
    }

    // Get previous outputs (excluding skipped nodes)
    const previousOutputs: string[] = deps
      .filter((depId) => !skippedNodes.has(depId))
      .map((depId) => {
        const result = results[depId]
        return typeof result?.output === 'string' ? result.output : JSON.stringify(result?.output || '')
      })

    const previousOutput = previousOutputs.join('\n\n')

    // Execute the node
    const result = await executeNode(node, input, previousOutput, results, clientName, clientContext)
    results[node.id] = result
    executed.add(node.id)

    // For condition nodes, only enqueue the appropriate branch
    if (node.type === 'conditionNode' && result.status === 'completed') {
      const conditionResult = result.output as { result: boolean } | string
      const conditionPassed = typeof conditionResult === 'object'
        ? conditionResult.result
        : conditionResult === 'true'

      dependents[node.id].forEach((dep) => {
        if (!executed.has(dep.nodeId) && !skippedNodes.has(dep.nodeId)) {
          // Only add to queue if branch matches condition result
          const shouldEnqueue =
            dep.branch === 'default' ||
            (dep.branch === 'true' && conditionPassed) ||
            (dep.branch === 'false' && !conditionPassed)

          if (shouldEnqueue) {
            queue.push(nodes.find((n) => n.id === dep.nodeId)!)
          } else {
            // Mark as skipped (wrong branch)
            skippedNodes.add(dep.nodeId)
          }
        }
      })
    } else {
      // For non-condition nodes, add all dependents
      dependents[node.id].forEach((dep) => {
        if (!executed.has(dep.nodeId) && !skippedNodes.has(dep.nodeId)) {
          queue.push(nodes.find((n) => n.id === dep.nodeId)!)
        }
      })
    }
  }

  // Mark any remaining skipped nodes with proper results
  skippedNodes.forEach((nodeId) => {
    if (!results[nodeId]) {
      results[nodeId] = {
        status: 'skipped',
        output: 'Overgeslagen door conditie',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }
    }
  })

  return results
}

// Check if a node should be skipped based on incoming edges from condition nodes
function checkIfNodeShouldBeSkipped(
  node: WorkflowNode,
  incomingEdges: WorkflowEdge[],
  results: Record<string, NodeResult>,
  skippedNodes: Set<string>
): boolean {
  // If any dependency is skipped, this node is also skipped (propagation)
  for (const edge of incomingEdges) {
    if (skippedNodes.has(edge.source)) {
      // Check if ALL incoming edges are from skipped nodes
      const allIncomingSkipped = incomingEdges.every((e) => skippedNodes.has(e.source))
      if (allIncomingSkipped) {
        return true
      }
    }
  }

  // Check if this node is on the wrong branch of a condition
  for (const edge of incomingEdges) {
    const sourceResult = results[edge.source]
    if (!sourceResult) continue

    // Find the source node type - we need to check if it's a condition
    const branch = getEdgeBranch(edge)
    if (branch !== 'default' && sourceResult.output) {
      const conditionResult = sourceResult.output as { result: boolean } | string
      const conditionPassed = typeof conditionResult === 'object'
        ? conditionResult.result
        : String(conditionResult) === 'true'

      // If this edge is for 'true' branch but condition was false, skip
      if (branch === 'true' && !conditionPassed) return true
      // If this edge is for 'false' branch but condition was true, skip
      if (branch === 'false' && conditionPassed) return true
    }
  }

  return false
}

// Replace template variables in a string
function replaceTemplateVariables(
  template: string,
  input: string,
  previousOutput: string,
  allResults: Record<string, NodeResult>
): string {
  let result = template

  // Replace basic variables
  result = result.replace(/\{\{input\}\}/g, input)
  result = result.replace(/\{\{previous_output\}\}/g, previousOutput)

  // Replace specific node outputs
  const nodeRefRegex = /\{\{node_(\w+)_output\}\}/g
  result = result.replace(nodeRefRegex, (_, nodeId) => {
    const nodeResult = allResults[nodeId]
    return typeof nodeResult?.output === 'string'
      ? nodeResult.output
      : JSON.stringify(nodeResult?.output || '')
  })

  return result
}

async function executeNode(
  node: WorkflowNode,
  input: string,
  previousOutput: string,
  allResults: Record<string, NodeResult>,
  clientName: string | null,
  clientContext: Record<string, unknown> | null
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

      case 'aiAgentNode': {
        const config = node.data.config as unknown as AIAgentConfig
        const modelId = config.model || 'claude-sonnet'
        let prompt = config.prompt || ''

        // Get model config from registry
        const modelConfig = getModel(modelId)
        if (!modelConfig) {
          return {
            status: 'failed',
            error: `Onbekend model: ${modelId}`,
            startedAt,
            completedAt: new Date().toISOString(),
          }
        }

        // Check if provider is available
        if (!isProviderAvailable(modelConfig.provider)) {
          return {
            status: 'failed',
            error: `Provider ${modelConfig.provider} is niet geconfigureerd. Controleer de API key.`,
            startedAt,
            completedAt: new Date().toISOString(),
          }
        }

        // Replace variables in prompt
        prompt = replaceTemplateVariables(prompt, input, previousOutput, allResults)

        // Build system prompt with client context
        let systemPrompt = ''
        if (clientContext && clientName) {
          const ctx = clientContext as {
            proposition?: string
            targetAudience?: string
            usps?: string[]
            toneOfVoice?: string
            brandVoice?: string
            doNots?: string[]
            mustHaves?: string[]
            bestsellers?: string[]
            seasonality?: string[]
            margins?: { min?: number; target?: number }
            activeChannels?: string[]
          }

          const contextParts = [`Je werkt voor klant: ${clientName}`]
          if (ctx.proposition) contextParts.push(`Propositie: ${ctx.proposition}`)
          if (ctx.targetAudience) contextParts.push(`Doelgroep: ${ctx.targetAudience}`)
          if (ctx.usps && ctx.usps.length > 0) contextParts.push(`USP's: ${ctx.usps.join(', ')}`)
          if (ctx.toneOfVoice) contextParts.push(`Tone of Voice: ${ctx.toneOfVoice}`)
          if (ctx.brandVoice) contextParts.push(`Brand Voice: ${ctx.brandVoice}`)
          if (ctx.bestsellers && ctx.bestsellers.length > 0) contextParts.push(`Bestsellers: ${ctx.bestsellers.join(', ')}`)
          if (ctx.seasonality && ctx.seasonality.length > 0) contextParts.push(`Seizoensgebonden: ${ctx.seasonality.join(', ')}`)

          // Compliance rules are critical
          if (ctx.doNots && ctx.doNots.length > 0) {
            contextParts.push(`\n⚠️ VERBODEN (gebruik NOOIT): ${ctx.doNots.join(', ')}`)
          }
          if (ctx.mustHaves && ctx.mustHaves.length > 0) {
            contextParts.push(`✓ VERPLICHT (altijd toevoegen): ${ctx.mustHaves.join(', ')}`)
          }

          systemPrompt = `CLIENT CONTEXT:\n${contextParts.join('\n')}`
        }

        // Get provider adapter and generate text
        const provider = getProviderAdapter(modelConfig.provider)
        const response = await provider.generateText({
          model: modelConfig.modelName,
          systemPrompt,
          userPrompt: prompt,
          maxTokens: config.maxTokens || modelConfig.maxTokens || 2048,
          temperature: config.temperature || 0.7,
        })

        return {
          status: 'completed',
          output: response.content,
          startedAt,
          completedAt: new Date().toISOString(),
          tokensUsed: response.inputTokens + response.outputTokens,
        }
      }

      case 'conditionNode': {
        const config = node.data.config as unknown as ConditionConfig
        const mode = config.mode || 'contains'
        const conditionValue = config.condition || ''
        const caseSensitive = config.caseSensitive || false

        // Prepare the text to check
        let textToCheck = previousOutput
        let valueToMatch = conditionValue

        if (!caseSensitive) {
          textToCheck = textToCheck.toLowerCase()
          valueToMatch = valueToMatch.toLowerCase()
        }

        let conditionResult = false
        let matchedValue: string | undefined

        switch (mode) {
          case 'contains':
            conditionResult = textToCheck.includes(valueToMatch)
            if (conditionResult) matchedValue = conditionValue
            break

          case 'equals':
            conditionResult = textToCheck.trim() === valueToMatch.trim()
            if (conditionResult) matchedValue = conditionValue
            break

          case 'not_equals':
            conditionResult = textToCheck.trim() !== valueToMatch.trim()
            break

          case 'regex':
            try {
              const flags = caseSensitive ? '' : 'i'
              const regex = new RegExp(conditionValue, flags)
              const match = previousOutput.match(regex)
              conditionResult = match !== null
              if (match) matchedValue = match[0]
            } catch {
              // Invalid regex - treat as false
              conditionResult = false
            }
            break
        }

        return {
          status: 'completed',
          output: {
            result: conditionResult,
            matchedValue,
            mode,
            checkedValue: conditionValue,
            previousOutput: previousOutput.slice(0, 200), // Truncate for readability
          },
          startedAt,
          completedAt: new Date().toISOString(),
        }
      }

      case 'webhookNode': {
        const config = node.data.config as unknown as WebhookConfig

        if (!config.url) {
          return {
            status: 'failed',
            error: 'Webhook URL is niet geconfigureerd',
            startedAt,
            completedAt: new Date().toISOString(),
          }
        }

        // Prepare body
        let body: string | undefined
        if (config.method === 'POST') {
          const bodyTemplate = config.bodyTemplate || '{{previous_output}}'
          body = replaceTemplateVariables(bodyTemplate, input, previousOutput, allResults)
        }

        // Prepare headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...config.headers,
        }

        try {
          const response = await fetch(config.url, {
            method: config.method || 'POST',
            headers,
            ...(body ? { body } : {}),
          })

          let responseBody: unknown
          const contentType = response.headers.get('content-type')

          if (contentType?.includes('application/json')) {
            responseBody = await response.json()
          } else {
            responseBody = await response.text()
          }

          return {
            status: response.ok ? 'completed' : 'failed',
            output: {
              status: response.status,
              statusText: response.statusText,
              body: responseBody,
            },
            ...(response.ok ? {} : { error: `HTTP ${response.status}: ${response.statusText}` }),
            startedAt,
            completedAt: new Date().toISOString(),
          }
        } catch (fetchError) {
          return {
            status: 'failed',
            error: `Webhook request mislukt: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`,
            startedAt,
            completedAt: new Date().toISOString(),
          }
        }
      }

      case 'delayNode': {
        const config = node.data.config as unknown as DelayConfig
        const durationSeconds = Math.min(config.duration || 5, 60) // Max 60 seconds

        // Wait for the specified duration
        await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000))

        return {
          status: 'completed',
          output: previousOutput, // Pass through the previous output
          startedAt,
          completedAt: new Date().toISOString(),
        }
      }

      case 'emailNode': {
        const emailConfig = node.data.config as EmailConfig

        if (!emailConfig.to) {
          return {
            status: 'failed',
            error: 'Geen ontvanger geconfigureerd',
            startedAt,
            completedAt: new Date().toISOString(),
          }
        }

        // Replace variables in template
        let emailContent = emailConfig.template || '{{previous_output}}'
        emailContent = emailContent.replace(/\{\{previous_output\}\}/g, previousOutput)
        emailContent = emailContent.replace(/\{\{input\}\}/g, input || '')

        // Replace node outputs
        for (const [nodeId, result] of Object.entries(allResults || {})) {
          const outputStr = typeof result.output === 'string' ? result.output : JSON.stringify(result.output)
          emailContent = emailContent.replace(new RegExp(`\\{\\{${nodeId}_output\\}\\}`, 'g'), outputStr)
        }

        // Send the email
        const emailResult = await sendWorkflowEmail({
          to: emailConfig.to,
          subject: emailConfig.subject || 'Workflow Output',
          content: emailContent,
        })

        if (!emailResult.success) {
          return {
            status: 'failed',
            error: emailResult.error || 'Email verzenden mislukt',
            startedAt,
            completedAt: new Date().toISOString(),
          }
        }

        return {
          status: 'completed',
          output: `Email verzonden naar ${emailConfig.to} (ID: ${emailResult.messageId})`,
          startedAt,
          completedAt: new Date().toISOString(),
        }
      }

      case 'outputNode':
        return {
          status: 'completed',
          output: previousOutput,
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
