'use client'

import { SchemaProperty } from '@/types/schema-markup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RepeatableFieldProps {
  property: SchemaProperty
  value: Record<string, unknown>[]
  onChange: (value: Record<string, unknown>[]) => void
  errors?: Record<string, string>
}

export function RepeatableField({
  property,
  value = [],
  onChange,
  errors = {},
}: RepeatableFieldProps) {
  const addItem = () => {
    const newItem: Record<string, unknown> = {}
    if (property.groupFields) {
      for (const field of property.groupFields) {
        newItem[field.name] = field.defaultValue || ''
      }
    }
    onChange([...value, newItem])
  }

  const removeItem = (index: number) => {
    const newValue = value.filter((_, i) => i !== index)
    onChange(newValue)
  }

  const updateItem = (index: number, fieldName: string, fieldValue: unknown) => {
    const newValue = [...value]
    newValue[index] = {
      ...newValue[index],
      [fieldName]: fieldValue,
    }
    onChange(newValue)
  }

  const renderField = (
    field: SchemaProperty,
    itemIndex: number,
    itemValue: Record<string, unknown>
  ) => {
    const fieldValue = itemValue[field.name] as string || ''
    const errorKey = `${property.name}[${itemIndex}].${field.name}`
    const hasError = !!errors[errorKey]

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            value={fieldValue}
            onChange={(e) => updateItem(itemIndex, field.name, e.target.value)}
            placeholder={field.placeholder}
            error={hasError}
            className="min-h-[80px]"
          />
        )
      case 'select':
        return (
          <Select
            value={fieldValue}
            onChange={(e) => updateItem(itemIndex, field.name, e.target.value)}
            options={field.options || []}
            placeholder={field.placeholder}
            error={hasError}
          />
        )
      default:
        return (
          <Input
            type={field.type === 'url' ? 'url' : field.type === 'number' ? 'number' : 'text'}
            value={fieldValue}
            onChange={(e) => updateItem(itemIndex, field.name, e.target.value)}
            placeholder={field.placeholder}
            error={hasError}
          />
        )
    }
  }

  return (
    <div className="space-y-3">
      {/* Items list */}
      <div className="space-y-4">
        {value.map((item, index) => (
          <div
            key={index}
            className="relative rounded-xl border border-surface-200 bg-surface-50 p-4"
          >
            {/* Item header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-surface-400" />
                <span className="text-sm font-medium text-surface-600">
                  Item {index + 1}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeItem(index)}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 -mr-2"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Item fields */}
            <div className="space-y-3">
              {property.groupFields?.map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-surface-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {renderField(field, index, item)}
                  {errors[`${property.name}[${index}].${field.name}`] && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors[`${property.name}[${index}].${field.name}`]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        className="w-full border-dashed"
      >
        <Plus className="w-4 h-4 mr-2" />
        {property.label} toevoegen
      </Button>
    </div>
  )
}

interface ArrayFieldProps {
  property: SchemaProperty
  value: string[]
  onChange: (value: string[]) => void
  errors?: Record<string, string>
}

export function ArrayField({
  property,
  value = [],
  onChange,
  errors = {},
}: ArrayFieldProps) {
  const addItem = () => {
    onChange([...value, ''])
  }

  const removeItem = (index: number) => {
    const newValue = value.filter((_, i) => i !== index)
    onChange(newValue)
  }

  const updateItem = (index: number, newValue: string) => {
    const updated = [...value]
    updated[index] = newValue
    onChange(updated)
  }

  return (
    <div className="space-y-2">
      {value.map((item, index) => {
        const errorKey = `${property.name}[${index}]`
        const hasError = !!errors[errorKey]

        return (
          <div key={index} className="flex gap-2">
            <Input
              type={property.arrayItemType === 'url' ? 'url' : 'text'}
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={property.placeholder}
              error={hasError}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeItem(index)}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 px-2"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        className="w-full border-dashed"
      >
        <Plus className="w-4 h-4 mr-2" />
        Item toevoegen
      </Button>
    </div>
  )
}
