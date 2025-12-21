'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Clock } from 'lucide-react'
import type { DelayNodeData } from '@/types/workflow'

function DelayNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as DelayNodeData

  const formatDuration = () => {
    const duration = nodeData.config?.duration || 1
    const unit = nodeData.config?.unit || 'seconds'

    const unitLabels: Record<string, string> = {
      seconds: duration === 1 ? 'seconde' : 'seconden',
      minutes: duration === 1 ? 'minuut' : 'minuten',
      hours: duration === 1 ? 'uur' : 'uur',
      days: duration === 1 ? 'dag' : 'dagen',
    }

    return `${duration} ${unitLabels[unit] || unit}`
  }

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-white shadow-lg min-w-[160px]
        ${selected ? 'border-slate-500 ring-2 ring-slate-200' : 'border-slate-300'}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-slate-500 border-2 border-white"
      />

      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg bg-slate-100">
          <Clock className="w-4 h-4 text-slate-600" />
        </div>
        <span className="font-semibold text-sm text-gray-900">{nodeData.label}</span>
      </div>

      <p className="text-xs text-slate-600 bg-slate-50 rounded px-1.5 py-1 text-center">
        {formatDuration()}
      </p>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-slate-500 border-2 border-white"
      />
    </div>
  )
}

export default memo(DelayNode)
