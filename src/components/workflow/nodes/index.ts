import TriggerNode from './TriggerNode'
import AIAgentNode from './AIAgentNode'
import EmailNode from './EmailNode'
import OutputNode from './OutputNode'
import WebhookNode from './WebhookNode'
import DelayNode from './DelayNode'
import ConditionNode from './ConditionNode'

export const nodeTypes = {
  triggerNode: TriggerNode,
  aiAgentNode: AIAgentNode,
  emailNode: EmailNode,
  outputNode: OutputNode,
  webhookNode: WebhookNode,
  delayNode: DelayNode,
  conditionNode: ConditionNode,
}

export {
  TriggerNode,
  AIAgentNode,
  EmailNode,
  OutputNode,
  WebhookNode,
  DelayNode,
  ConditionNode,
}
