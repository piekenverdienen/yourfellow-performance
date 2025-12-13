import type { Node, Edge } from '@xyflow/react'

// Node configuration types
export interface TriggerConfig {
  inputPlaceholder?: string
  [key: string]: unknown
}

export interface AIAgentConfig {
  model: 'claude-sonnet' | 'claude-haiku' | 'gpt-4'
  prompt: string
  temperature?: number
  maxTokens?: number
  [key: string]: unknown
}

export interface EmailConfig {
  to?: string
  subject?: string
  template?: string
  [key: string]: unknown
}

export interface WebhookConfig {
  url?: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  [key: string]: unknown
}

export interface DelayConfig {
  duration: number
  unit: 'seconds' | 'minutes' | 'hours' | 'days'
  [key: string]: unknown
}

export interface ConditionConfig {
  condition: string
  trueLabel?: string
  falseLabel?: string
  [key: string]: unknown
}

// Node data types
export interface BaseNodeData {
  label: string
  config: Record<string, unknown>
  [key: string]: unknown
}

export interface TriggerNodeData extends BaseNodeData {
  config: TriggerConfig
}

export interface AIAgentNodeData extends BaseNodeData {
  config: AIAgentConfig
}

export interface EmailNodeData extends BaseNodeData {
  config: EmailConfig
}

export interface WebhookNodeData extends BaseNodeData {
  config: WebhookConfig
}

export interface DelayNodeData extends BaseNodeData {
  config: DelayConfig
}

export interface ConditionNodeData extends BaseNodeData {
  config: ConditionConfig
}

export interface OutputNodeData extends BaseNodeData {
  config: Record<string, never>
}

// Workflow node types
export type WorkflowNodeType =
  | 'triggerNode'
  | 'aiAgentNode'
  | 'emailNode'
  | 'webhookNode'
  | 'delayNode'
  | 'conditionNode'
  | 'outputNode'

export type WorkflowNode = Node<BaseNodeData, WorkflowNodeType>
export type WorkflowEdge = Edge

// Workflow database types
export interface Workflow {
  id: string
  user_id: string
  name: string
  description: string | null
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  is_active: boolean
  is_template: boolean
  trigger_type: 'manual' | 'schedule' | 'webhook'
  schedule_cron: string | null
  webhook_secret: string | null
  total_runs: number
  last_run_at: string | null
  created_at: string
  updated_at: string
}

export interface WorkflowRun {
  id: string
  workflow_id: string
  user_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  node_results: Record<string, NodeResult>
  error_message: string | null
  error_node_id: string | null
  started_at: string
  completed_at: string | null
  trigger_type: string
  input_data: Record<string, unknown> | null
}

export interface NodeResult {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  output?: string | Record<string, unknown>
  error?: string
  startedAt?: string
  completedAt?: string
  tokensUsed?: number
}

// Node definitions for the sidebar
export interface NodeDefinition {
  type: WorkflowNodeType
  label: string
  description: string
  icon: string
  color: string
  defaultConfig: Record<string, unknown>
}

export const NODE_DEFINITIONS: NodeDefinition[] = [
  {
    type: 'triggerNode',
    label: 'Start Trigger',
    description: 'Startpunt van de workflow',
    icon: 'Play',
    color: '#22C55E',
    defaultConfig: { inputPlaceholder: 'Voer je input in...' },
  },
  {
    type: 'aiAgentNode',
    label: 'AI Agent',
    description: 'Gebruik AI om tekst te genereren',
    icon: 'Bot',
    color: '#8B5CF6',
    defaultConfig: {
      model: 'claude-sonnet',
      prompt: 'Verwerk de volgende input: {{input}}',
      temperature: 0.7,
      maxTokens: 2048,
    },
  },
  {
    type: 'emailNode',
    label: 'Email',
    description: 'Verstuur een email',
    icon: 'Mail',
    color: '#3B82F6',
    defaultConfig: {
      to: '',
      subject: '',
      template: '{{previous_output}}',
    },
  },
  {
    type: 'webhookNode',
    label: 'Webhook',
    description: 'Roep een externe API aan',
    icon: 'Globe',
    color: '#F97316',
    defaultConfig: {
      url: '',
      method: 'POST',
      headers: {},
    },
  },
  {
    type: 'delayNode',
    label: 'Wachten',
    description: 'Wacht een bepaalde tijd',
    icon: 'Clock',
    color: '#64748B',
    defaultConfig: {
      duration: 1,
      unit: 'minutes',
    },
  },
  {
    type: 'conditionNode',
    label: 'Conditie',
    description: 'Maak een beslissing',
    icon: 'GitBranch',
    color: '#EAB308',
    defaultConfig: {
      condition: '',
      trueLabel: 'Ja',
      falseLabel: 'Nee',
    },
  },
  {
    type: 'outputNode',
    label: 'Output',
    description: 'Eindpunt met resultaat',
    icon: 'Flag',
    color: '#EF4444',
    defaultConfig: {},
  },
]
