'use client'

import { ValidationResult } from '@/types/schema-markup'
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ValidationDisplayProps {
  validation: ValidationResult | null
  className?: string
}

export function ValidationDisplay({ validation, className }: ValidationDisplayProps) {
  if (!validation) {
    return null
  }

  const { isValid, errors, warnings } = validation
  const hasIssues = errors.length > 0 || warnings.length > 0

  return (
    <div className={cn('rounded-xl border p-4', className)}>
      {/* Status header */}
      <div className="flex items-center gap-2 mb-3">
        {isValid ? (
          <>
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="font-medium text-green-700">
              Schema is geldig
            </span>
          </>
        ) : (
          <>
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="font-medium text-red-700">
              {errors.length} fout{errors.length !== 1 ? 'en' : ''} gevonden
            </span>
          </>
        )}
      </div>

      {/* Issues list */}
      {hasIssues && (
        <div className="space-y-2">
          {/* Errors */}
          {errors.map((error, index) => (
            <div
              key={`error-${index}`}
              className="flex items-start gap-2 text-sm"
            >
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <span className="text-red-700">{error.message}</span>
            </div>
          ))}

          {/* Warnings */}
          {warnings.map((warning, index) => (
            <div
              key={`warning-${index}`}
              className="flex items-start gap-2 text-sm"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-amber-700">{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Success message */}
      {isValid && warnings.length === 0 && (
        <div className="flex items-start gap-2 text-sm text-green-600">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Alle verplichte velden zijn ingevuld</span>
        </div>
      )}
    </div>
  )
}

interface ValidationSummaryProps {
  validation: ValidationResult | null
}

export function ValidationSummary({ validation }: ValidationSummaryProps) {
  if (!validation) {
    return null
  }

  const { isValid, errors, warnings } = validation

  return (
    <div className="flex items-center gap-4 text-sm">
      {isValid ? (
        <div className="flex items-center gap-1.5 text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span>Geldig</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span>{errors.length} fout{errors.length !== 1 ? 'en' : ''}</span>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="flex items-center gap-1.5 text-amber-600">
          <AlertTriangle className="w-4 h-4" />
          <span>{warnings.length} aanbeveling{warnings.length !== 1 ? 'en' : ''}</span>
        </div>
      )}
    </div>
  )
}
