'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Flag } from 'lucide-react'
import type { OutputNodeData } from '@/types/workflow'

function OutputNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as OutputNodeData

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-white shadow-lg min-w-[180px]
        ${selected ? 'border-red-500 ring-2 ring-red-200' : 'border-red-300'}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-red-500 border-2 border-white"
      />

      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg bg-red-100">
          <Flag className="w-4 h-4 text-red-600" />
        </div>
        <span className="font-semibold text-sm text-gray-900">{nodeData.label}</span>
      </div>
      <p className="text-xs text-gray-500">Workflow output</p>
    </div>
  )
}

export default memo(OutputNode)
