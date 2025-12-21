/**
 * Workflow Validator
 *
 * Validates generated workflows for structural correctness.
 */

import type { WorkflowNode, WorkflowEdge, WorkflowNodeType } from '@/types/workflow'

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  type: 'missing_trigger' | 'missing_output' | 'disconnected_node' | 'invalid_node_type' | 'missing_config' | 'cycle_detected' | 'invalid_edge'
  message: string
  nodeId?: string
}

export interface ValidationWarning {
  type: 'missing_field' | 'unreachable_node'
  message: string
  nodeId?: string
  field?: string
}

const VALID_NODE_TYPES: WorkflowNodeType[] = [
  'triggerNode',
  'aiAgentNode',
  'emailNode',
  'webhookNode',
  'delayNode',
  'conditionNode',
  'outputNode',
]

/**
 * Validate a workflow structure
 */
export function validateWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // Check for at least one trigger node
  const triggerNodes = nodes.filter((n) => n.type === 'triggerNode')
  if (triggerNodes.length === 0) {
    errors.push({
      type: 'missing_trigger',
      message: 'Workflow moet minimaal één Start Trigger hebben',
    })
  }

  // Check for at least one output node
  const outputNodes = nodes.filter((n) => n.type === 'outputNode')
  if (outputNodes.length === 0) {
    errors.push({
      type: 'missing_output',
      message: 'Workflow moet minimaal één Output node hebben',
    })
  }

  // Check for valid node types
  for (const node of nodes) {
    if (!VALID_NODE_TYPES.includes(node.type as WorkflowNodeType)) {
      errors.push({
        type: 'invalid_node_type',
        message: `Ongeldig node type: ${node.type}`,
        nodeId: node.id,
      })
    }
  }

  // Check for invalid edges (referencing non-existent nodes)
  const nodeIds = new Set(nodes.map((n) => n.id))
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({
        type: 'invalid_edge',
        message: `Edge verwijst naar onbekende source node: ${edge.source}`,
      })
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({
        type: 'invalid_edge',
        message: `Edge verwijst naar onbekende target node: ${edge.target}`,
      })
    }
  }

  // Check for disconnected nodes (no incoming or outgoing edges, except trigger/output)
  for (const node of nodes) {
    const hasIncoming = edges.some((e) => e.target === node.id)
    const hasOutgoing = edges.some((e) => e.source === node.id)

    if (node.type === 'triggerNode' && !hasOutgoing) {
      warnings.push({
        type: 'unreachable_node',
        message: 'Start Trigger is niet verbonden met andere nodes',
        nodeId: node.id,
      })
    } else if (node.type === 'outputNode' && !hasIncoming) {
      warnings.push({
        type: 'unreachable_node',
        message: 'Output node ontvangt geen input',
        nodeId: node.id,
      })
    } else if (node.type !== 'triggerNode' && node.type !== 'outputNode') {
      if (!hasIncoming && !hasOutgoing) {
        errors.push({
          type: 'disconnected_node',
          message: `Node "${node.data?.label || node.id}" is niet verbonden`,
          nodeId: node.id,
        })
      }
    }
  }

  // Check for cycles
  if (hasCycle(nodes, edges)) {
    errors.push({
      type: 'cycle_detected',
      message: 'Workflow bevat een oneindige loop',
    })
  }

  // Check for missing required config fields
  for (const node of nodes) {
    const missingFields = getMissingRequiredFields(node)
    for (const field of missingFields) {
      warnings.push({
        type: 'missing_field',
        message: `"${node.data?.label || node.id}" mist verplicht veld: ${field}`,
        nodeId: node.id,
        field,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Check if the workflow graph has a cycle
 */
function hasCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
  const adjacencyList = new Map<string, string[]>()

  for (const node of nodes) {
    adjacencyList.set(node.id, [])
  }

  for (const edge of edges) {
    adjacencyList.get(edge.source)?.push(edge.target)
  }

  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function dfs(nodeId: string): boolean {
    visited.add(nodeId)
    recursionStack.add(nodeId)

    const neighbors = adjacencyList.get(nodeId) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true
      } else if (recursionStack.has(neighbor)) {
        return true
      }
    }

    recursionStack.delete(nodeId)
    return false
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true
    }
  }

  return false
}

/**
 * Get missing required fields for a node
 */
function getMissingRequiredFields(node: WorkflowNode): string[] {
  const missing: string[] = []
  const config = node.data?.config || {}

  switch (node.type) {
    case 'aiAgentNode':
      if (!config.prompt) missing.push('prompt')
      break
    case 'emailNode':
      if (!config.to) missing.push('to')
      if (!config.subject) missing.push('subject')
      break
    case 'webhookNode':
      if (!config.url) missing.push('url')
      break
    case 'conditionNode':
      if (!config.condition) missing.push('condition')
      break
  }

  return missing
}

/**
 * Extract todos from validation warnings
 */
export function extractTodos(
  nodes: WorkflowNode[],
  validation: ValidationResult
): Array<{ nodeId: string; field: string; reason: string; nodeLabel: string }> {
  const todos: Array<{ nodeId: string; field: string; reason: string; nodeLabel: string }> = []

  for (const warning of validation.warnings) {
    if (warning.type === 'missing_field' && warning.nodeId && warning.field) {
      const node = nodes.find((n) => n.id === warning.nodeId)
      todos.push({
        nodeId: warning.nodeId,
        field: warning.field,
        reason: warning.message,
        nodeLabel: node?.data?.label || warning.nodeId,
      })
    }
  }

  return todos
}
