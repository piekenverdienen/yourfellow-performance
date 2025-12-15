import { SchemaType, GeneratedSchema } from '@/types/schema-markup'

type FormData = Record<string, unknown>

/**
 * Remove empty values from an object recursively
 */
function cleanEmptyFields(obj: unknown): unknown {
  if (obj === null || obj === undefined || obj === '') {
    return undefined
  }

  if (Array.isArray(obj)) {
    const cleaned = obj
      .map(item => cleanEmptyFields(item))
      .filter(item => item !== undefined && item !== null && item !== '')
    return cleaned.length > 0 ? cleaned : undefined
  }

  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const cleanedValue = cleanEmptyFields(value)
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined
  }

  return obj
}

/**
 * Build address object if any address fields are present
 */
function buildAddress(data: FormData): object | undefined {
  const address: Record<string, unknown> = {}

  if (data.streetAddress) address.streetAddress = data.streetAddress
  if (data.addressLocality) address.addressLocality = data.addressLocality
  if (data.postalCode) address.postalCode = data.postalCode
  if (data.addressCountry) address.addressCountry = data.addressCountry

  if (Object.keys(address).length > 0) {
    return {
      '@type': 'PostalAddress',
      ...address,
    }
  }
  return undefined
}

/**
 * Build geo coordinates if present
 */
function buildGeo(data: FormData): object | undefined {
  if (data.latitude && data.longitude) {
    return {
      '@type': 'GeoCoordinates',
      latitude: data.latitude,
      longitude: data.longitude,
    }
  }
  return undefined
}

/**
 * Build opening hours specification
 */
function buildOpeningHours(openingHours: unknown[]): object[] | undefined {
  if (!Array.isArray(openingHours) || openingHours.length === 0) {
    return undefined
  }

  return openingHours.map(hours => {
    const h = hours as Record<string, unknown>
    return {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.dayOfWeek,
      opens: h.opens,
      closes: h.closes,
    }
  })
}

/**
 * Generate Organization schema
 */
function generateOrganization(data: FormData): object {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.name,
    url: data.url,
    logo: data.logo,
  }

  if (data.description) schema.description = data.description
  if (data.email) schema.email = data.email
  if (data.telephone) schema.telephone = data.telephone

  const address = buildAddress(data)
  if (address) schema.address = address

  if (Array.isArray(data.sameAs) && data.sameAs.length > 0) {
    schema.sameAs = data.sameAs.filter(Boolean)
  }

  return schema
}

/**
 * Generate LocalBusiness schema
 */
function generateLocalBusiness(data: FormData): object {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: data.name,
    url: data.url,
    image: data.image,
    telephone: data.telephone,
  }

  const address = buildAddress(data)
  if (address) schema.address = address

  if (data.priceRange) schema.priceRange = data.priceRange
  if (data.description) schema.description = data.description

  const openingHours = buildOpeningHours(data.openingHours as unknown[])
  if (openingHours) schema.openingHoursSpecification = openingHours

  const geo = buildGeo(data)
  if (geo) schema.geo = geo

  return schema
}

/**
 * Generate Product schema
 */
function generateProduct(data: FormData): object {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.name,
    image: data.image,
    description: data.description,
  }

  if (data.sku) schema.sku = data.sku

  if (data.brand) {
    schema.brand = {
      '@type': 'Brand',
      name: data.brand,
    }
  }

  // Build offers
  const offers: Record<string, unknown> = {
    '@type': 'Offer',
    price: data.price,
    priceCurrency: data.priceCurrency,
    availability: data.availability,
  }
  if (data.url) offers.url = data.url
  schema.offers = offers

  // Build aggregate rating if present
  if (data.ratingValue && data.reviewCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: data.ratingValue,
      reviewCount: data.reviewCount,
    }
  }

  return schema
}

/**
 * Generate Article schema
 */
function generateArticle(data: FormData): object {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.headline,
    image: data.image,
    datePublished: data.datePublished,
  }

  if (data.dateModified) schema.dateModified = data.dateModified
  if (data.description) schema.description = data.description

  // Author
  const author: Record<string, unknown> = {
    '@type': 'Person',
    name: data.authorName,
  }
  if (data.authorUrl) author.url = data.authorUrl
  schema.author = author

  // Publisher
  schema.publisher = {
    '@type': 'Organization',
    name: data.publisherName,
    logo: {
      '@type': 'ImageObject',
      url: data.publisherLogo,
    },
  }

  return schema
}

/**
 * Generate FAQPage schema
 */
function generateFAQPage(data: FormData): object {
  const items = (data.items as Array<{ question: string; answer: string }>) || []

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

/**
 * Generate BreadcrumbList schema
 */
function generateBreadcrumbList(data: FormData): object {
  const items = (data.items as Array<{ name: string; url: string }>) || []

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/**
 * Generate HowTo schema
 */
function generateHowTo(data: FormData): object {
  const steps = (data.steps as Array<{ name: string; text: string; image?: string }>) || []

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: data.name,
    description: data.description,
  }

  if (data.image) schema.image = data.image
  if (data.totalTime) schema.totalTime = data.totalTime

  if (data.estimatedCost) {
    schema.estimatedCost = {
      '@type': 'MonetaryAmount',
      currency: 'EUR',
      value: data.estimatedCost,
    }
  }

  schema.step = steps.map((step, index) => {
    const stepSchema: Record<string, unknown> = {
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    }
    if (step.image) stepSchema.image = step.image
    return stepSchema
  })

  return schema
}

/**
 * Generate Event schema
 */
function generateEvent(data: FormData): object {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: data.name,
    description: data.description,
    startDate: data.startDate,
  }

  if (data.endDate) schema.endDate = data.endDate
  if (data.eventStatus) schema.eventStatus = data.eventStatus
  if (data.image) schema.image = data.image
  if (data.url) schema.url = data.url

  // Location
  const location: Record<string, unknown> = {
    '@type': 'Place',
    name: data.location,
  }
  if (data.locationAddress) {
    location.address = data.locationAddress
  }
  schema.location = location

  // Performer
  if (data.performerName) {
    schema.performer = {
      '@type': 'Person',
      name: data.performerName,
    }
  }

  // Organizer
  if (data.organizerName) {
    schema.organizer = {
      '@type': 'Organization',
      name: data.organizerName,
    }
  }

  // Offers (tickets)
  if (data.price) {
    schema.offers = {
      '@type': 'Offer',
      price: data.price,
      priceCurrency: data.priceCurrency || 'EUR',
      availability: data.availability,
    }
  }

  return schema
}

/**
 * Generate Person schema
 */
function generatePerson(data: FormData): object {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: data.name,
  }

  if (data.url) schema.url = data.url
  if (data.image) schema.image = data.image
  if (data.jobTitle) schema.jobTitle = data.jobTitle
  if (data.email) schema.email = data.email
  if (data.telephone) schema.telephone = data.telephone

  if (data.worksFor) {
    schema.worksFor = {
      '@type': 'Organization',
      name: data.worksFor,
    }
  }

  if (Array.isArray(data.sameAs) && data.sameAs.length > 0) {
    schema.sameAs = data.sameAs.filter(Boolean)
  }

  return schema
}

/**
 * Generate WebSite schema
 */
function generateWebSite(data: FormData): object {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: data.name,
    url: data.url,
  }

  if (data.searchUrl) {
    schema.potentialAction = {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: data.searchUrl,
      },
      'query-input': 'required name=search_term_string',
    }
  }

  return schema
}

/**
 * Generate Recipe schema
 */
function generateRecipe(data: FormData): object {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: data.name,
    image: data.image,
    description: data.description,
  }

  if (data.prepTime) schema.prepTime = data.prepTime
  if (data.cookTime) schema.cookTime = data.cookTime
  if (data.totalTime) schema.totalTime = data.totalTime
  if (data.recipeYield) schema.recipeYield = data.recipeYield

  // Ingredients
  if (Array.isArray(data.recipeIngredient) && data.recipeIngredient.length > 0) {
    schema.recipeIngredient = data.recipeIngredient.filter(Boolean)
  }

  // Instructions
  const instructions = (data.recipeInstructions as Array<{ text: string }>) || []
  if (instructions.length > 0) {
    schema.recipeInstructions = instructions.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      text: step.text,
    }))
  }

  // Author
  if (data.authorName) {
    schema.author = {
      '@type': 'Person',
      name: data.authorName,
    }
  }

  // Aggregate rating
  if (data.ratingValue && data.reviewCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: data.ratingValue,
      reviewCount: data.reviewCount,
    }
  }

  return schema
}

/**
 * Generate Review schema
 */
function generateReview(data: FormData): object {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': data.itemReviewedType || 'Product',
      name: data.itemReviewedName,
    },
    reviewBody: data.reviewBody,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: data.ratingValue,
      bestRating: data.bestRating || '5',
      worstRating: data.worstRating || '1',
    },
    author: {
      '@type': 'Person',
      name: data.authorName,
    },
  }

  if (data.datePublished) schema.datePublished = data.datePublished

  if (data.publisherName) {
    schema.publisher = {
      '@type': 'Organization',
      name: data.publisherName,
    }
  }

  return schema
}

/**
 * Main generator function - generates JSON-LD based on schema type
 */
export function generateJsonLd(schemaType: SchemaType, formData: FormData): object {
  let schema: object

  switch (schemaType) {
    case SchemaType.Organization:
      schema = generateOrganization(formData)
      break
    case SchemaType.LocalBusiness:
      schema = generateLocalBusiness(formData)
      break
    case SchemaType.Product:
      schema = generateProduct(formData)
      break
    case SchemaType.Article:
      schema = generateArticle(formData)
      break
    case SchemaType.FAQPage:
      schema = generateFAQPage(formData)
      break
    case SchemaType.BreadcrumbList:
      schema = generateBreadcrumbList(formData)
      break
    case SchemaType.HowTo:
      schema = generateHowTo(formData)
      break
    case SchemaType.Event:
      schema = generateEvent(formData)
      break
    case SchemaType.Person:
      schema = generatePerson(formData)
      break
    case SchemaType.WebSite:
      schema = generateWebSite(formData)
      break
    case SchemaType.Recipe:
      schema = generateRecipe(formData)
      break
    case SchemaType.Review:
      schema = generateReview(formData)
      break
    default:
      schema = { '@context': 'https://schema.org', '@type': schemaType }
  }

  // Clean empty fields
  return cleanEmptyFields(schema) as object
}

/**
 * Format JSON-LD as pretty-printed string
 */
export function formatJsonLd(schema: object): string {
  return JSON.stringify(schema, null, 2)
}

/**
 * Generate HTML script tag with JSON-LD
 */
export function generateHtmlSnippet(schema: object): string {
  const jsonString = formatJsonLd(schema)
  return `<script type="application/ld+json">
${jsonString}
</script>`
}

/**
 * Complete generation - returns JSON-LD object, string, and HTML snippet
 */
export function generateSchema(schemaType: SchemaType, formData: FormData): GeneratedSchema {
  const jsonLd = generateJsonLd(schemaType, formData)
  const jsonLdString = formatJsonLd(jsonLd)
  const htmlSnippet = generateHtmlSnippet(jsonLd)

  return {
    jsonLd,
    jsonLdString,
    htmlSnippet,
  }
}
