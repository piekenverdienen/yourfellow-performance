'use client'

import { SchemaType } from '@/types/schema-markup'
import { schemaTemplates } from '@/lib/schema-templates'
import { cn } from '@/lib/utils'
import {
  Building2,
  Store,
  ShoppingBag,
  FileText,
  HelpCircle,
  ChevronRight,
  ListChecks,
  Calendar,
  User,
  Globe,
  ChefHat,
  Star,
} from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Store,
  ShoppingBag,
  FileText,
  HelpCircle,
  ChevronRight,
  ListChecks,
  Calendar,
  User,
  Globe,
  ChefHat,
  Star,
}

interface SchemaTypeSelectorProps {
  selectedType: SchemaType | null
  onSelect: (type: SchemaType) => void
}

export function SchemaTypeSelector({ selectedType, onSelect }: SchemaTypeSelectorProps) {
  const schemaTypes = Object.values(SchemaType)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {schemaTypes.map((type) => {
        const template = schemaTemplates[type]
        const IconComponent = iconMap[template.icon] || FileText
        const isSelected = selectedType === type

        return (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
              'hover:border-primary/50 hover:bg-primary/5',
              isSelected
                ? 'border-primary bg-primary/10 shadow-sm'
                : 'border-surface-200 bg-white'
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                isSelected ? 'bg-primary text-white' : 'bg-surface-100 text-surface-600'
              )}
            >
              <IconComponent className="w-5 h-5" />
            </div>
            <div className="text-center">
              <div
                className={cn(
                  'text-sm font-medium',
                  isSelected ? 'text-primary' : 'text-surface-900'
                )}
              >
                {template.label}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

interface SchemaTypeSelectProps {
  value: SchemaType | null
  onChange: (type: SchemaType) => void
}

export function SchemaTypeSelect({ value, onChange }: SchemaTypeSelectProps) {
  const schemaTypes = Object.values(SchemaType)

  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value as SchemaType)}
        className={cn(
          'w-full appearance-none rounded-xl border bg-white px-4 py-2.5 pr-10 text-sm',
          'focus:outline-none focus:ring-2 transition-all duration-200 cursor-pointer',
          'border-surface-300 focus:border-primary focus:ring-primary/20',
          !value && 'text-surface-400'
        )}
      >
        <option value="" disabled>
          Selecteer een schema type...
        </option>
        {schemaTypes.map((type) => {
          const template = schemaTemplates[type]
          return (
            <option key={type} value={type}>
              {template.label}
            </option>
          )
        })}
      </select>
      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none rotate-90" />
    </div>
  )
}
