'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Globe } from 'lucide-react'
import type { WebhookNodeData } from '@/types/workflow'

function WebhookNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as WebhookNodeData

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-white shadow-lg min-w-[180px] max-w-[250px]
        ${selected ? 'border-orange-500 ring-2 ring-orange-200' : 'border-orange-300'}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-orange-500 border-2 border-white"
      />

      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg bg-orange-100">
          <Globe className="w-4 h-4 text-orange-600" />
        </div>
        <div>
          <span className="font-semibold text-sm text-gray-900 block">{nodeData.label}</span>
          <span className="text-[10px] text-orange-600 font-medium">
            {nodeData.config?.method || 'POST'}
          </span>
        </div>
      </div>

      {nodeData.config?.url && (
        <p className="text-xs text-gray-500 truncate bg-gray-50 rounded px-1.5 py-1">
          {nodeData.config.url}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-orange-500 border-2 border-white"
      />
    </div>
  )
}

export default memo(WebhookNode)
