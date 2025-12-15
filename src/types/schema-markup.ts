// Schema Markup Generator Types

export enum SchemaType {
  Organization = 'Organization',
  LocalBusiness = 'LocalBusiness',
  Product = 'Product',
  Article = 'Article',
  FAQPage = 'FAQPage',
  BreadcrumbList = 'BreadcrumbList',
  HowTo = 'HowTo',
  Event = 'Event',
  Person = 'Person',
  WebSite = 'WebSite',
  Recipe = 'Recipe',
  Review = 'Review'
}

export type FieldType =
  | 'text'
  | 'url'
  | 'date'
  | 'datetime'
  | 'number'
  | 'textarea'
  | 'select'
  | 'array'
  | 'object'
  | 'repeatable-group'

export interface SelectOption {
  value: string
  label: string
}

export interface SchemaProperty {
  name: string
  label: string
  type: FieldType
  required: boolean
  placeholder?: string
  description?: string
  options?: SelectOption[]
  nestedType?: string // For nested @type like Person, Organization
  nestedProperties?: SchemaProperty[] // Properties for nested objects
  arrayItemType?: FieldType // For array items
  groupFields?: SchemaProperty[] // For repeatable groups
  defaultValue?: string | number | boolean
}

export interface SchemaTemplate {
  type: SchemaType
  label: string
  description: string
  icon: string // Lucide icon name
  properties: SchemaProperty[]
  requiredGoogleFields?: string[] // Fields required by Google
  recommendedFields?: string[] // Recommended for better results
}

export interface ValidationError {
  field: string
  message: string
  type: 'error' | 'warning'
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

export interface GeneratedSchema {
  jsonLd: object
  jsonLdString: string
  htmlSnippet: string
}

// Form data types for each schema
export interface OrganizationFormData {
  name: string
  url: string
  logo: string
  description?: string
  email?: string
  telephone?: string
  streetAddress?: string
  addressLocality?: string
  postalCode?: string
  addressCountry?: string
  sameAs?: string[]
}

export interface LocalBusinessFormData extends OrganizationFormData {
  priceRange?: string
  openingHours?: OpeningHoursData[]
  geo?: {
    latitude: string
    longitude: string
  }
}

export interface OpeningHoursData {
  dayOfWeek: string[]
  opens: string
  closes: string
}

export interface ProductFormData {
  name: string
  image: string
  description: string
  sku?: string
  brand?: string
  price: string
  priceCurrency: string
  availability: string
  url?: string
  ratingValue?: string
  reviewCount?: string
}

export interface ArticleFormData {
  headline: string
  image: string
  datePublished: string
  dateModified?: string
  authorName: string
  authorUrl?: string
  publisherName: string
  publisherLogo: string
  description?: string
}

export interface FAQItem {
  question: string
  answer: string
}

export interface FAQPageFormData {
  items: FAQItem[]
}

export interface BreadcrumbItem {
  name: string
  url: string
}

export interface BreadcrumbListFormData {
  items: BreadcrumbItem[]
}

export interface HowToStep {
  name: string
  text: string
  image?: string
}

export interface HowToFormData {
  name: string
  description: string
  image?: string
  totalTime?: string
  estimatedCost?: string
  steps: HowToStep[]
}

export interface EventFormData {
  name: string
  description: string
  startDate: string
  endDate?: string
  location: string
  locationAddress?: string
  image?: string
  url?: string
  performerName?: string
  organizerName?: string
  price?: string
  priceCurrency?: string
  availability?: string
}

export type SchemaFormData =
  | OrganizationFormData
  | LocalBusinessFormData
  | ProductFormData
  | ArticleFormData
  | FAQPageFormData
  | BreadcrumbListFormData
  | HowToFormData
  | EventFormData
  | Record<string, unknown>
