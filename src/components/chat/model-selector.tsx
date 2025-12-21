'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Zap, Sparkles, Brain, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// Chat model definitions with provider info
export const CHAT_MODELS = [
  {
    id: 'claude-sonnet',
    modelName: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet',
    provider: 'anthropic' as const,
    description: 'Balanced performance',
    icon: Brain,
    qualityScore: 4,
    speedScore: 3,
  },
  {
    id: 'claude-haiku',
    modelName: 'claude-3-5-haiku-20241022',
    displayName: 'Claude Haiku',
    provider: 'anthropic' as const,
    description: 'Fast & efficient',
    icon: Zap,
    qualityScore: 3,
    speedScore: 5,
  },
  {
    id: 'claude-opus',
    modelName: 'claude-3-opus-20240229',
    displayName: 'Claude Opus',
    provider: 'anthropic' as const,
    description: 'Highest quality',
    icon: Sparkles,
    qualityScore: 5,
    speedScore: 2,
  },
  {
    id: 'gpt-4o',
    modelName: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai' as const,
    description: 'OpenAI flagship',
    icon: Brain,
    qualityScore: 4,
    speedScore: 3,
  },
  {
    id: 'gpt-4o-mini',
    modelName: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openai' as const,
    description: 'Fast & affordable',
    icon: Zap,
    qualityScore: 3,
    speedScore: 5,
  },
  {
    id: 'gemini-flash',
    modelName: 'gemini-2.0-flash',
    displayName: 'Gemini Flash',
    provider: 'google' as const,
    description: 'Ultra fast',
    icon: Zap,
    qualityScore: 3,
    speedScore: 5,
  },
  {
    id: 'gemini-pro',
    modelName: 'gemini-1.5-pro',
    displayName: 'Gemini Pro',
    provider: 'google' as const,
    description: 'Google flagship',
    icon: Brain,
    qualityScore: 4,
    speedScore: 3,
  },
] as const

export type ChatModelId = typeof CHAT_MODELS[number]['id']

// Image model definitions
export const IMAGE_MODELS = [
  // OpenAI models
  {
    id: 'dall-e-3' as const,
    displayName: 'DALL-E 3',
    provider: 'openai' as const,
    description: 'Highest quality',
    qualityScore: 5,
  },
  {
    id: 'dall-e-2' as const,
    displayName: 'DALL-E 2',
    provider: 'openai' as const,
    description: 'Fast & simple',
    qualityScore: 3,
  },
  {
    id: 'gpt-image-1' as const,
    displayName: 'GPT Image',
    provider: 'openai' as const,
    description: 'Latest model',
    qualityScore: 4,
  },
  // Google Imagen models
  {
    id: 'imagen-3' as const,
    displayName: 'Imagen 3',
    provider: 'google' as const,
    description: 'Highest quality',
    qualityScore: 5,
  },
  {
    id: 'imagen-2' as const,
    displayName: 'Imagen 2',
    provider: 'google' as const,
    description: 'Fast iteration',
    qualityScore: 4,
  },
] as const

export type ImageModelId = typeof IMAGE_MODELS[number]['id']

const IMAGE_PROVIDER_LABELS = {
  openai: 'OpenAI',
  google: 'Google',
}

const PROVIDER_COLORS = {
  anthropic: 'bg-orange-100 text-orange-700 border-orange-200',
  openai: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  google: 'bg-blue-100 text-blue-700 border-blue-200',
}

const PROVIDER_LABELS = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  google: 'Google',
}

interface ModelSelectorProps {
  value: ChatModelId
  onChange: (modelId: ChatModelId) => void
  disabled?: boolean
  compact?: boolean
}

export function ModelSelector({ value, onChange, disabled, compact }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedModel = CHAT_MODELS.find(m => m.id === value) || CHAT_MODELS[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Group models by provider
  const modelsByProvider = CHAT_MODELS.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = []
    acc[model.provider].push(model)
    return acc
  }, {} as Record<string, typeof CHAT_MODELS[number][]>)

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 rounded-lg border transition-all',
          compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm',
          disabled
            ? 'opacity-50 cursor-not-allowed bg-surface-100'
            : 'hover:bg-surface-50 cursor-pointer bg-white border-surface-200',
          isOpen && 'ring-2 ring-primary/20 border-primary'
        )}
      >
        <span className={cn(
          'px-1.5 py-0.5 rounded text-xs font-medium border',
          PROVIDER_COLORS[selectedModel.provider]
        )}>
          {PROVIDER_LABELS[selectedModel.provider]}
        </span>
        <span className="font-medium text-surface-900">{selectedModel.displayName}</span>
        <ChevronDown className={cn(
          'h-4 w-4 text-surface-400 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-xl shadow-lg border border-surface-200 py-2 z-50 max-h-80 overflow-y-auto">
          {Object.entries(modelsByProvider).map(([provider, models]) => (
            <div key={provider}>
              <div className="px-3 py-1.5 text-xs font-semibold text-surface-500 uppercase tracking-wide">
                {PROVIDER_LABELS[provider as keyof typeof PROVIDER_LABELS]}
              </div>
              {models.map(model => {
                const Icon = model.icon
                const isSelected = model.id === value
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onChange(model.id as ChatModelId)
                      setIsOpen(false)
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left hover:bg-surface-50 transition-colors flex items-center gap-3',
                      isSelected && 'bg-primary/5'
                    )}
                  >
                    <div className={cn(
                      'p-1.5 rounded-lg',
                      isSelected ? 'bg-primary/10 text-primary' : 'bg-surface-100 text-surface-500'
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'font-medium text-sm',
                          isSelected && 'text-primary'
                        )}>
                          {model.displayName}
                        </span>
                      </div>
                      <div className="text-xs text-surface-500 flex items-center gap-2">
                        <span>{model.description}</span>
                        <span className="text-surface-300">•</span>
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: model.qualityScore }).map((_, i) => (
                            <span key={i} className="w-1 h-1 rounded-full bg-primary" />
                          ))}
                          {Array.from({ length: 5 - model.qualityScore }).map((_, i) => (
                            <span key={i} className="w-1 h-1 rounded-full bg-surface-200" />
                          ))}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface ImageModelSelectorProps {
  value: ImageModelId
  onChange: (modelId: ImageModelId) => void
  disabled?: boolean
  compact?: boolean
}

export function ImageModelSelector({ value, onChange, disabled, compact }: ImageModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedModel = IMAGE_MODELS.find(m => m.id === value) || IMAGE_MODELS[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Group image models by provider
  const imageModelsByProvider = IMAGE_MODELS.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = []
    acc[model.provider].push(model)
    return acc
  }, {} as Record<string, typeof IMAGE_MODELS[number][]>)

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 rounded-lg border transition-all',
          compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm',
          disabled
            ? 'opacity-50 cursor-not-allowed bg-surface-100'
            : 'hover:bg-surface-50 cursor-pointer bg-white border-surface-200',
          isOpen && 'ring-2 ring-primary/20 border-primary'
        )}
      >
        <span className={cn(
          'px-1.5 py-0.5 rounded text-xs font-medium border',
          PROVIDER_COLORS[selectedModel.provider]
        )}>
          {IMAGE_PROVIDER_LABELS[selectedModel.provider]}
        </span>
        <span className="font-medium text-surface-900">{selectedModel.displayName}</span>
        <ChevronDown className={cn(
          'h-4 w-4 text-surface-400 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-lg border border-surface-200 py-2 z-50 max-h-80 overflow-y-auto">
          {Object.entries(imageModelsByProvider).map(([provider, models]) => (
            <div key={provider}>
              <div className="px-3 py-1.5 text-xs font-semibold text-surface-500 uppercase tracking-wide">
                {IMAGE_PROVIDER_LABELS[provider as keyof typeof IMAGE_PROVIDER_LABELS]}
              </div>
              {models.map(model => {
                const isSelected = model.id === value
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onChange(model.id)
                      setIsOpen(false)
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left hover:bg-surface-50 transition-colors flex items-center gap-3',
                      isSelected && 'bg-primary/5'
                    )}
                  >
                    <div className={cn(
                      'p-1.5 rounded-lg',
                      isSelected ? 'bg-primary/10 text-primary' : 'bg-surface-100 text-surface-500'
                    )}>
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        'font-medium text-sm',
                        isSelected && 'text-primary'
                      )}>
                        {model.displayName}
                      </div>
                      <div className="text-xs text-surface-500 flex items-center gap-2">
                        <span>{model.description}</span>
                        <span className="text-surface-300">•</span>
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: model.qualityScore }).map((_, i) => (
                            <span key={i} className="w-1 h-1 rounded-full bg-primary" />
                          ))}
                          {Array.from({ length: 5 - model.qualityScore }).map((_, i) => (
                            <span key={i} className="w-1 h-1 rounded-full bg-surface-200" />
                          ))}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
