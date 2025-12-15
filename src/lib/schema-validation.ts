import { SchemaType, ValidationResult, ValidationError, SchemaProperty } from '@/types/schema-markup'
import { getSchemaTemplate } from './schema-templates'

type FormData = Record<string, unknown>

/**
 * Check if a value is empty
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return true
  }
  if (Array.isArray(value)) {
    return value.length === 0 || value.every(item => isEmpty(item))
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(v => isEmpty(v))
  }
  return false
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Validate ISO 8601 date format
 */
function isValidIsoDate(dateStr: string): boolean {
  // Basic ISO date patterns: YYYY-MM-DD or full datetime
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)?)?$/
  return isoDatePattern.test(dateStr)
}

/**
 * Validate a single field
 */
function validateField(
  property: SchemaProperty,
  value: unknown,
  formData: FormData
): ValidationError | null {
  const label = property.label

  // Check required fields
  if (property.required && isEmpty(value)) {
    return {
      field: property.name,
      message: `${label} is verplicht`,
      type: 'error',
    }
  }

  // Skip further validation if empty and not required
  if (isEmpty(value)) {
    return null
  }

  // URL validation
  if (property.type === 'url' && typeof value === 'string') {
    if (!isValidUrl(value)) {
      return {
        field: property.name,
        message: `${label} moet een geldige URL zijn`,
        type: 'error',
      }
    }
  }

  // Date validation
  if ((property.type === 'date' || property.type === 'datetime') && typeof value === 'string') {
    if (!isValidIsoDate(value)) {
      return {
        field: property.name,
        message: `${label} moet een geldige datum zijn (YYYY-MM-DD)`,
        type: 'error',
      }
    }
  }

  // Number validation
  if (property.type === 'number' && typeof value === 'string' && value !== '') {
    const num = parseFloat(value)
    if (isNaN(num)) {
      return {
        field: property.name,
        message: `${label} moet een geldig getal zijn`,
        type: 'error',
      }
    }

    // Rating validation (1-5)
    if (property.name === 'ratingValue' && (num < 1 || num > 5)) {
      return {
        field: property.name,
        message: `${label} moet tussen 1 en 5 zijn`,
        type: 'error',
      }
    }
  }

  // Array validation (for repeatable groups)
  if (property.type === 'repeatable-group' && property.groupFields) {
    if (!Array.isArray(value)) {
      return null
    }

    // Check if array has items
    if (property.required && value.length === 0) {
      return {
        field: property.name,
        message: `Voeg minimaal 1 item toe voor ${label}`,
        type: 'error',
      }
    }

    // Validate each item in the group
    for (let i = 0; i < value.length; i++) {
      const item = value[i] as Record<string, unknown>
      for (const groupField of property.groupFields) {
        if (groupField.required && isEmpty(item[groupField.name])) {
          return {
            field: `${property.name}[${i}].${groupField.name}`,
            message: `${groupField.label} is verplicht in item ${i + 1}`,
            type: 'error',
          }
        }
      }
    }
  }

  // Array of URLs validation
  if (property.type === 'array' && property.arrayItemType === 'url' && Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const item = value[i]
      if (typeof item === 'string' && item && !isValidUrl(item)) {
        return {
          field: `${property.name}[${i}]`,
          message: `Item ${i + 1} in ${label} moet een geldige URL zijn`,
          type: 'error',
        }
      }
    }
  }

  return null
}

/**
 * Check for recommended fields that are missing
 */
function checkRecommendedFields(
  schemaType: SchemaType,
  formData: FormData
): ValidationError[] {
  const template = getSchemaTemplate(schemaType)
  const warnings: ValidationError[] = []

  if (!template.recommendedFields) {
    return warnings
  }

  for (const fieldName of template.recommendedFields) {
    const property = template.properties.find(p => p.name === fieldName)
    if (property && isEmpty(formData[fieldName])) {
      warnings.push({
        field: fieldName,
        message: `${property.label} wordt aanbevolen voor betere zoekresultaten`,
        type: 'warning',
      })
    }
  }

  return warnings
}

/**
 * Schema-specific validation rules
 */
function validateSchemaSpecific(
  schemaType: SchemaType,
  formData: FormData
): ValidationError[] {
  const errors: ValidationError[] = []

  switch (schemaType) {
    case SchemaType.FAQPage:
      // FAQ needs at least 2 items for best results
      const faqItems = formData.items as Array<unknown>
      if (Array.isArray(faqItems) && faqItems.length < 2) {
        errors.push({
          field: 'items',
          message: 'Voeg minimaal 2 vragen toe voor betere zoekresultaten',
          type: 'warning',
        })
      }
      break

    case SchemaType.BreadcrumbList:
      // Breadcrumbs need at least 2 items
      const breadcrumbItems = formData.items as Array<unknown>
      if (Array.isArray(breadcrumbItems) && breadcrumbItems.length < 2) {
        errors.push({
          field: 'items',
          message: 'Voeg minimaal 2 breadcrumb items toe',
          type: 'warning',
        })
      }
      break

    case SchemaType.HowTo:
      // HowTo needs at least 2 steps
      const howToSteps = formData.steps as Array<unknown>
      if (Array.isArray(howToSteps) && howToSteps.length < 2) {
        errors.push({
          field: 'steps',
          message: 'Voeg minimaal 2 stappen toe',
          type: 'warning',
        })
      }
      break

    case SchemaType.Recipe:
      // Recipe needs at least 2 ingredients and 2 instructions
      const ingredients = formData.recipeIngredient as Array<unknown>
      if (Array.isArray(ingredients) && ingredients.filter(Boolean).length < 2) {
        errors.push({
          field: 'recipeIngredient',
          message: 'Voeg minimaal 2 ingrediënten toe',
          type: 'warning',
        })
      }
      const instructions = formData.recipeInstructions as Array<unknown>
      if (Array.isArray(instructions) && instructions.length < 2) {
        errors.push({
          field: 'recipeInstructions',
          message: 'Voeg minimaal 2 bereidingsstappen toe',
          type: 'warning',
        })
      }
      break

    case SchemaType.Article:
      // Headline should be under 110 characters
      const headline = formData.headline as string
      if (headline && headline.length > 110) {
        errors.push({
          field: 'headline',
          message: 'Titel is langer dan 110 tekens (aanbevolen maximum)',
          type: 'warning',
        })
      }
      break

    case SchemaType.Product:
      // If rating is provided, review count should be too
      if (formData.ratingValue && !formData.reviewCount) {
        errors.push({
          field: 'reviewCount',
          message: 'Aantal reviews is verplicht als je een beoordeling toevoegt',
          type: 'error',
        })
      }
      if (formData.reviewCount && !formData.ratingValue) {
        errors.push({
          field: 'ratingValue',
          message: 'Beoordeling is verplicht als je aantal reviews toevoegt',
          type: 'error',
        })
      }
      break
  }

  return errors
}

/**
 * Main validation function
 */
export function validateSchema(
  schemaType: SchemaType,
  formData: FormData
): ValidationResult {
  const template = getSchemaTemplate(schemaType)
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // Validate each property
  for (const property of template.properties) {
    const value = formData[property.name]
    const error = validateField(property, value, formData)
    if (error) {
      if (error.type === 'error') {
        errors.push(error)
      } else {
        warnings.push(error)
      }
    }
  }

  // Check recommended fields
  const recommendedWarnings = checkRecommendedFields(schemaType, formData)
  warnings.push(...recommendedWarnings)

  // Schema-specific validation
  const specificErrors = validateSchemaSpecific(schemaType, formData)
  for (const err of specificErrors) {
    if (err.type === 'error') {
      errors.push(err)
    } else {
      warnings.push(err)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Get only required field errors (for real-time validation)
 */
export function getRequiredFieldErrors(
  schemaType: SchemaType,
  formData: FormData
): ValidationError[] {
  const template = getSchemaTemplate(schemaType)
  const errors: ValidationError[] = []

  for (const property of template.properties) {
    if (property.required && isEmpty(formData[property.name])) {
      errors.push({
        field: property.name,
        message: `${property.label} is verplicht`,
        type: 'error',
      })
    }
  }

  return errors
}

/**
 * Check if form has minimum valid data to generate preview
 */
export function hasMinimumData(
  schemaType: SchemaType,
  formData: FormData
): boolean {
  const template = getSchemaTemplate(schemaType)
  const requiredFields = template.properties.filter(p => p.required)

  // Need at least one required field filled to show preview
  return requiredFields.some(field => !isEmpty(formData[field.name]))
}
