'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Play } from 'lucide-react'
import type { TriggerNodeData } from '@/types/workflow'

function TriggerNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as TriggerNodeData

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-white shadow-lg min-w-[180px]
        ${selected ? 'border-green-500 ring-2 ring-green-200' : 'border-green-300'}
      `}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg bg-green-100">
          <Play className="w-4 h-4 text-green-600" />
        </div>
        <span className="font-semibold text-sm text-gray-900">{nodeData.label}</span>
      </div>
      <p className="text-xs text-gray-500">Workflow startpunt</p>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-green-500 border-2 border-white"
      />
    </div>
  )
}

export default memo(TriggerNode)
