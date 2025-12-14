'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Mail } from 'lucide-react'
import type { EmailNodeData } from '@/types/workflow'

function EmailNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as EmailNodeData

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-white shadow-lg min-w-[180px]
        ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-300'}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-blue-500 border-2 border-white"
      />

      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg bg-blue-100">
          <Mail className="w-4 h-4 text-blue-600" />
        </div>
        <span className="font-semibold text-sm text-gray-900">{nodeData.label}</span>
      </div>

      {nodeData.config?.to && (
        <p className="text-xs text-gray-500">
          Naar: {nodeData.config.to}
        </p>
      )}
      {nodeData.config?.subject && (
        <p className="text-xs text-gray-500 truncate">
          {nodeData.config.subject}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-blue-500 border-2 border-white"
      />
    </div>
  )
}

export default memo(EmailNode)
