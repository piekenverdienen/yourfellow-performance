'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Play, Clock, Webhook } from 'lucide-react'
import type { TriggerNodeData, TriggerConfig } from '@/types/workflow'

const triggerTypeLabels: Record<TriggerConfig['triggerType'], string> = {
  manual: 'Handmatig starten',
  schedule: 'Gepland',
  webhook: 'Webhook trigger',
}

const triggerTypeIcons: Record<TriggerConfig['triggerType'], typeof Play> = {
  manual: Play,
  schedule: Clock,
  webhook: Webhook,
}

function TriggerNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as TriggerNodeData
  const triggerType = nodeData.config?.triggerType || 'manual'
  const Icon = triggerTypeIcons[triggerType]

  const getSubtitle = () => {
    switch (triggerType) {
      case 'schedule':
        return nodeData.config?.scheduleDescription || nodeData.config?.scheduleCron || 'Geen schema ingesteld'
      case 'webhook':
        return nodeData.config?.webhookPath ? `/${nodeData.config.webhookPath}` : 'Webhook URL'
      case 'manual':
      default:
        return nodeData.config?.inputRequired ? 'Met input' : 'Directe start'
    }
  }

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-white shadow-lg min-w-[180px]
        ${selected ? 'border-green-500 ring-2 ring-green-200' : 'border-green-300'}
      `}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg bg-green-100">
          <Icon className="w-4 h-4 text-green-600" />
        </div>
        <span className="font-semibold text-sm text-gray-900">{nodeData.label}</span>
      </div>
      <p className="text-xs text-gray-500">{triggerTypeLabels[triggerType]}</p>
      <p className="text-xs text-green-600 mt-0.5">{getSubtitle()}</p>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-green-500 border-2 border-white"
      />
    </div>
  )
}

export default memo(TriggerNode)
