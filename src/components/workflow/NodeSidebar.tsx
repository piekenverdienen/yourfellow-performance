'use client'

import { NODE_DEFINITIONS } from '@/types/workflow'
import { Play, Bot, Mail, Flag, Clock, GitBranch, Globe } from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Play,
  Bot,
  Mail,
  Flag,
  Clock,
  GitBranch,
  Globe,
}

export function NodeSidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string, defaultConfig: Record<string, unknown>, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.setData('nodeData', JSON.stringify({ label, config: defaultConfig }))
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-64 bg-white border-r border-surface-200 p-4 overflow-y-auto">
      <h3 className="text-sm font-semibold text-surface-600 uppercase tracking-wider mb-4">
        Nodes
      </h3>
      <p className="text-xs text-surface-400 mb-4">
        Sleep een node naar het canvas
      </p>

      <div className="space-y-2">
        {NODE_DEFINITIONS.map((nodeDef) => {
          const Icon = iconMap[nodeDef.icon] || Play

          return (
            <div
              key={nodeDef.type}
              draggable
              onDragStart={(e) => onDragStart(e, nodeDef.type, nodeDef.defaultConfig, nodeDef.label)}
              className="flex items-center gap-3 p-3 rounded-lg border border-surface-200 cursor-grab hover:border-surface-300 hover:shadow-sm transition-all active:cursor-grabbing"
              style={{ borderLeftColor: nodeDef.color, borderLeftWidth: 4 }}
            >
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${nodeDef.color}20` }}
              >
                <Icon className="w-4 h-4" style={{ color: nodeDef.color }} />
              </div>
              <div>
                <p className="text-sm font-medium text-surface-900">{nodeDef.label}</p>
                <p className="text-xs text-surface-500">{nodeDef.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 p-3 bg-surface-50 rounded-lg">
        <h4 className="text-xs font-semibold text-surface-600 uppercase mb-2">Tips</h4>
        <ul className="text-xs text-surface-500 space-y-1">
          <li>• Verbind nodes door de punten te slepen</li>
          <li>• Klik op een node om te configureren</li>
          <li>• Gebruik {"{{input}}"} in prompts voor dynamische data</li>
        </ul>
      </div>
    </div>
  )
}
