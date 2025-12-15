'use client'

import { useState, useMemo, useCallback } from 'react'
import { SchemaType } from '@/types/schema-markup'
import { getSchemaTemplate } from '@/lib/schema-templates'
import { generateSchema } from '@/lib/schema-generator'
import { validateSchema, hasMinimumData } from '@/lib/schema-validation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { SchemaTypeSelector } from '@/components/schema/schema-type-selector'
import { SchemaForm } from '@/components/schema/schema-form'
import { JsonLdPreview } from '@/components/schema/json-ld-preview'
import { ValidationDisplay, ValidationSummary } from '@/components/schema/validation-display'
import { Code2 } from 'lucide-react'

function getInitialFormData(schemaType: SchemaType): Record<string, unknown> {
  const template = getSchemaTemplate(schemaType)
  const data: Record<string, unknown> = {}

  for (const property of template.properties) {
    if (property.defaultValue !== undefined) {
      data[property.name] = property.defaultValue
    } else if (property.type === 'repeatable-group' || property.type === 'array') {
      data[property.name] = []
    } else {
      data[property.name] = ''
    }
  }

  return data
}

export default function SchemaMarkupPage() {
  const [selectedType, setSelectedType] = useState<SchemaType | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  const handleTypeSelect = useCallback((type: SchemaType) => {
    setSelectedType(type)
    setFormData(getInitialFormData(type))
  }, [])

  const handleFormChange = useCallback((data: Record<string, unknown>) => {
    setFormData(data)
  }, [])

  const handleReset = useCallback(() => {
    if (selectedType) {
      setFormData(getInitialFormData(selectedType))
    }
  }, [selectedType])

  // Generate schema and validation
  const { generatedSchema, validation, hasData } = useMemo(() => {
    if (!selectedType) {
      return { generatedSchema: null, validation: null, hasData: false }
    }

    const hasData = hasMinimumData(selectedType, formData)
    const validation = validateSchema(selectedType, formData)
    const generatedSchema = hasData ? generateSchema(selectedType, formData) : null

    return { generatedSchema, validation, hasData }
  }, [selectedType, formData])

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-brand">
            <Code2 className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">Schema Markup Generator</h1>
        </div>
        <p className="text-surface-600">
          Genereer structured data (JSON-LD) voor rich snippets in zoekresultaten.
        </p>
      </div>

      {/* Schema Type Selection */}
      {!selectedType ? (
        <Card>
          <CardHeader>
            <CardTitle>Selecteer een schema type</CardTitle>
            <CardDescription>
              Kies het type structured data dat je wilt genereren
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SchemaTypeSelector
              selectedType={selectedType}
              onSelect={handleTypeSelect}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Type switcher */}
          <div className="mb-6">
            <Card padding="sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-surface-600">Schema type:</span>
                  <span className="font-medium text-surface-900">
                    {getSchemaTemplate(selectedType).label}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedType(null)}
                  className="text-sm text-primary hover:text-primary/80 font-medium"
                >
                  Ander type kiezen
                </button>
              </div>
            </Card>
          </div>

          {/* Main content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Form */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Gegevens invullen</CardTitle>
                      <CardDescription>
                        Velden met * zijn verplicht
                      </CardDescription>
                    </div>
                    {validation && <ValidationSummary validation={validation} />}
                  </div>
                </CardHeader>
                <CardContent>
                  <SchemaForm
                    schemaType={selectedType}
                    formData={formData}
                    onChange={handleFormChange}
                    onReset={handleReset}
                    errors={validation?.errors || []}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right: Preview */}
            <div className="space-y-6">
              <div className="lg:sticky lg:top-6">
                <JsonLdPreview
                  jsonLdString={generatedSchema?.jsonLdString || ''}
                  htmlSnippet={generatedSchema?.htmlSnippet || ''}
                  isEmpty={!hasData}
                />

                {/* Validation Display */}
                {validation && hasData && (
                  <div className="mt-6">
                    <ValidationDisplay
                      validation={validation}
                      className={
                        validation.isValid
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
