'use client'

import { useState } from 'react'
import { SchemaType, SchemaProperty, ValidationError } from '@/types/schema-markup'
import { getSchemaTemplate } from '@/lib/schema-templates'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { RepeatableField, ArrayField } from './repeatable-field'
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SchemaFormProps {
  schemaType: SchemaType
  formData: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
  onReset: () => void
  errors: ValidationError[]
}

export function SchemaForm({
  schemaType,
  formData,
  onChange,
  onReset,
  errors,
}: SchemaFormProps) {
  const [showOptional, setShowOptional] = useState(true)
  const template = getSchemaTemplate(schemaType)

  const requiredProperties = template.properties.filter((p) => p.required)
  const optionalProperties = template.properties.filter((p) => !p.required)

  const updateField = (name: string, value: unknown) => {
    onChange({
      ...formData,
      [name]: value,
    })
  }

  const getFieldError = (fieldName: string): string | undefined => {
    const error = errors.find(
      (e) => e.field === fieldName || e.field.startsWith(`${fieldName}[`)
    )
    return error?.message
  }

  const errorMap: Record<string, string> = {}
  errors.forEach((e) => {
    errorMap[e.field] = e.message
  })

  const renderField = (property: SchemaProperty) => {
    const value = formData[property.name]
    const error = getFieldError(property.name)
    const hasError = !!error

    switch (property.type) {
      case 'textarea':
        return (
          <Textarea
            value={(value as string) || ''}
            onChange={(e) => updateField(property.name, e.target.value)}
            placeholder={property.placeholder}
            error={hasError}
            className="min-h-[100px]"
          />
        )

      case 'select':
        return (
          <Select
            value={(value as string) || property.defaultValue?.toString() || ''}
            onChange={(e) => updateField(property.name, e.target.value)}
            options={property.options || []}
            placeholder={property.placeholder || 'Selecteer...'}
            error={hasError}
          />
        )

      case 'repeatable-group':
        return (
          <RepeatableField
            property={property}
            value={(value as Record<string, unknown>[]) || []}
            onChange={(newValue) => updateField(property.name, newValue)}
            errors={errorMap}
          />
        )

      case 'array':
        return (
          <ArrayField
            property={property}
            value={(value as string[]) || []}
            onChange={(newValue) => updateField(property.name, newValue)}
            errors={errorMap}
          />
        )

      case 'date':
        return (
          <Input
            type="date"
            value={(value as string) || ''}
            onChange={(e) => updateField(property.name, e.target.value)}
            error={hasError}
          />
        )

      case 'datetime':
        return (
          <Input
            type="datetime-local"
            value={(value as string) || ''}
            onChange={(e) => updateField(property.name, e.target.value)}
            error={hasError}
          />
        )

      case 'number':
        return (
          <Input
            type="number"
            step="any"
            value={(value as string) || ''}
            onChange={(e) => updateField(property.name, e.target.value)}
            placeholder={property.placeholder}
            error={hasError}
          />
        )

      case 'url':
        return (
          <Input
            type="url"
            value={(value as string) || ''}
            onChange={(e) => updateField(property.name, e.target.value)}
            placeholder={property.placeholder}
            error={hasError}
          />
        )

      default:
        return (
          <Input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => updateField(property.name, e.target.value)}
            placeholder={property.placeholder}
            error={hasError}
          />
        )
    }
  }

  const renderPropertyField = (property: SchemaProperty) => {
    const error = getFieldError(property.name)

    return (
      <div key={property.name} className="space-y-1.5">
        <label className="block text-sm font-medium text-surface-700">
          {property.label}
          {property.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {property.description && (
          <p className="text-xs text-surface-500 mb-1.5">{property.description}</p>
        )}
        {renderField(property)}
        {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Required fields section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-surface-900 uppercase tracking-wide">
          Verplichte velden
        </h3>
        <div className="space-y-4">
          {requiredProperties.map(renderPropertyField)}
        </div>
      </div>

      {/* Optional fields section */}
      {optionalProperties.length > 0 && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="flex items-center gap-2 text-sm font-semibold text-surface-900 uppercase tracking-wide w-full"
          >
            <span>Optionele velden</span>
            <span className="text-surface-400 normal-case font-normal">
              ({optionalProperties.length})
            </span>
            {showOptional ? (
              <ChevronUp className="w-4 h-4 text-surface-400 ml-auto" />
            ) : (
              <ChevronDown className="w-4 h-4 text-surface-400 ml-auto" />
            )}
          </button>

          {showOptional && (
            <div className="space-y-4 pl-0">
              {optionalProperties.map(renderPropertyField)}
            </div>
          )}
        </div>
      )}

      {/* Reset button */}
      <div className="pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-surface-500"
        >
          <RotateCcw className="w-4 h-4 mr-1.5" />
          Formulier resetten
        </Button>
      </div>
    </div>
  )
}
