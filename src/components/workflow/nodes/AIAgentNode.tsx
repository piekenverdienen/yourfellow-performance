'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Bot } from 'lucide-react'
import type { AIAgentNodeData } from '@/types/workflow'

function AIAgentNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as AIAgentNodeData

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-white shadow-lg min-w-[200px] max-w-[280px]
        ${selected ? 'border-purple-500 ring-2 ring-purple-200' : 'border-purple-300'}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-purple-500 border-2 border-white"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-purple-100">
          <Bot className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <span className="font-semibold text-sm text-gray-900 block">{nodeData.label}</span>
          <span className="text-[10px] text-purple-600 font-medium">
            {nodeData.config?.model || 'claude-sonnet'}
          </span>
        </div>
      </div>

      {nodeData.config?.prompt && (
        <p className="text-xs text-gray-500 line-clamp-2 bg-gray-50 rounded p-1.5">
          {nodeData.config.prompt.slice(0, 80)}...
        </p>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-purple-500 border-2 border-white"
      />
    </div>
  )
}

export default memo(AIAgentNode)
