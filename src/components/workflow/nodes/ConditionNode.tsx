'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import type { ConditionNodeData } from '@/types/workflow'

function ConditionNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as ConditionNodeData

  const trueLabel = nodeData.config?.trueLabel || 'Ja'
  const falseLabel = nodeData.config?.falseLabel || 'Nee'

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-white shadow-lg min-w-[180px]
        ${selected ? 'border-yellow-500 ring-2 ring-yellow-200' : 'border-yellow-400'}
      `}
    >
      {/* Input handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-yellow-500 border-2 border-white"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-yellow-100">
          <GitBranch className="w-4 h-4 text-yellow-600" />
        </div>
        <span className="font-semibold text-sm text-gray-900">{nodeData.label}</span>
      </div>

      {nodeData.config?.condition && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded px-1.5 py-1 mb-2 truncate">
          {nodeData.config.condition}
        </p>
      )}

      {/* Branch labels */}
      <div className="flex flex-col gap-1.5 relative">
        {/* True branch */}
        <div className="flex items-center justify-end gap-1">
          <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
            {trueLabel}
          </span>
        </div>
        {/* False branch */}
        <div className="flex items-center justify-end gap-1">
          <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
            {falseLabel}
          </span>
        </div>
      </div>

      {/* True output handle (top-right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="w-3 h-3 !bg-green-500 border-2 border-white"
        style={{ top: '50%', transform: 'translateY(-12px)' }}
      />

      {/* False output handle (bottom-right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="w-3 h-3 !bg-red-500 border-2 border-white"
        style={{ top: '50%', transform: 'translateY(12px)' }}
      />
    </div>
  )
}

export default memo(ConditionNode)
