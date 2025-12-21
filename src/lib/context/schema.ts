/**
 * AI Context Schema - Customer Intelligence Layer
 *
 * This schema defines the structure for AI-generated customer context.
 * All context must be validated against this schema before storage.
 */

import { z } from 'zod'

// ===========================================
// CONFIDENCE LEVELS
// ===========================================
export const ConfidenceLevel = z.enum(['high', 'medium', 'low', 'uncertain'])
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>

// ===========================================
// SOURCE TYPES
// ===========================================
export const SourceType = z.enum([
  'scrape:website',
  'scrape:competitor',
  'scrape:social',
  'user:intake',
  'user:form',
  'user:chat',
  'ai:heuristic',
  'ai:inference',
  'import:csv',
  'import:api',
  'manual:override',
])
export type SourceType = z.infer<typeof SourceType>

// ===========================================
// OBSERVATIONS - What we know about the client
// ===========================================
export const ObservationSchema = z.object({
  // Core business identity
  companyName: z.string().min(1),
  website: z.string().url().optional(),
  industry: z.string().optional(),
  subIndustry: z.string().optional(),

  // Value proposition
  proposition: z.string().optional(),
  tagline: z.string().optional(),
  elevator_pitch: z.string().optional(),

  // Target audience
  targetAudience: z.object({
    primary: z.string(),
    secondary: z.string().optional(),
    demographics: z.object({
      ageRange: z.string().optional(),
      gender: z.string().optional(),
      location: z.array(z.string()).optional(),
      income: z.string().optional(),
    }).optional(),
    psychographics: z.object({
      interests: z.array(z.string()).optional(),
      values: z.array(z.string()).optional(),
      painPoints: z.array(z.string()).optional(),
      motivations: z.array(z.string()).optional(),
    }).optional(),
  }).optional(),

  // USPs and differentiators
  usps: z.array(
    z.object({
      text: z.string(),
      confidence: ConfidenceLevel,
    })
  ).default([]),

  // Products/Services
  products: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      category: z.string().optional(),
      priceRange: z.string().optional(),
      isBestseller: z.boolean().optional(),
    })
  ).optional(),

  bestsellers: z.array(z.string()).optional(),

  // Brand identity
  brandVoice: z.object({
    toneOfVoice: z.string().optional(),
    personality: z.array(z.string()).optional(),
    doNots: z.array(z.string()).default([]),
    mustHaves: z.array(z.string()).default([]),
    examplePhrases: z.array(z.string()).optional(),
  }).optional(),

  // Company info
  companyInfo: z.object({
    founded: z.string().optional(),
    employees: z.string().optional(),
    locations: z.array(z.string()).optional(),
    certifications: z.array(z.string()).optional(),
  }).optional(),
})
export type Observation = z.infer<typeof ObservationSchema>

// ===========================================
// GOALS - What the client wants to achieve
// ===========================================
export const GoalsSchema = z.object({
  // Business goals
  primary: z.array(z.string()).default([]),
  secondary: z.array(z.string()).optional(),

  // Marketing goals
  marketing: z.object({
    awareness: z.boolean().optional(),
    leads: z.boolean().optional(),
    sales: z.boolean().optional(),
    retention: z.boolean().optional(),
    branding: z.boolean().optional(),
  }).optional(),

  // KPIs
  kpis: z.array(
    z.object({
      metric: z.string(),
      target: z.string().optional(),
      current: z.string().optional(),
    })
  ).optional(),

  // Timeline
  shortTerm: z.array(z.string()).optional(), // 0-3 months
  mediumTerm: z.array(z.string()).optional(), // 3-12 months
  longTerm: z.array(z.string()).optional(), // 12+ months
})
export type Goals = z.infer<typeof GoalsSchema>

// ===========================================
// ECONOMICS - Financial/business metrics
// ===========================================
export const EconomicsSchema = z.object({
  // Pricing
  priceRange: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    average: z.number().optional(),
    currency: z.string().default('EUR'),
  }).optional(),

  // Margins
  margins: z.object({
    min: z.number().min(0).max(100).optional(),
    target: z.number().min(0).max(100).optional(),
    average: z.number().min(0).max(100).optional(),
  }).optional(),

  // Customer value
  customerValue: z.object({
    averageOrderValue: z.number().optional(),
    lifetimeValue: z.number().optional(),
    repeatPurchaseRate: z.number().optional(),
  }).optional(),

  // Seasonality
  seasonality: z.array(
    z.object({
      period: z.string(), // e.g., "Q4", "December", "Summer"
      impact: z.enum(['peak', 'high', 'normal', 'low', 'off']),
      notes: z.string().optional(),
    })
  ).optional(),

  // Budget (if known)
  marketingBudget: z.object({
    monthly: z.number().optional(),
    channels: z.record(z.string(), z.number()).optional(), // channel -> budget
  }).optional(),
})
export type Economics = z.infer<typeof EconomicsSchema>

// ===========================================
// COMPETITORS - Competitive landscape
// ===========================================
export const CompetitorSchema = z.object({
  name: z.string(),
  website: z.string().url().optional(),
  description: z.string().optional(),

  // Positioning
  positioning: z.string().optional(),
  usps: z.array(z.string()).optional(),

  // Strengths/Weaknesses
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),

  // Market info
  marketShare: z.string().optional(),
  pricePositioning: z.enum(['premium', 'mid-range', 'budget', 'unknown']).optional(),

  // Scraped info
  lastScraped: z.string().datetime().optional(),
  scrapedContent: z.string().optional(),
})
export type Competitor = z.infer<typeof CompetitorSchema>

export const CompetitorsSchema = z.object({
  direct: z.array(CompetitorSchema).default([]),
  indirect: z.array(CompetitorSchema).optional(),
  positioning: z.string().optional(), // How client positions vs competitors
  differentiators: z.array(z.string()).optional(),
})
export type Competitors = z.infer<typeof CompetitorsSchema>

// ===========================================
// ACCESS - Active channels and integrations
// ===========================================
export const ChannelTypeSchema = z.enum([
  'google_ads',
  'meta',
  'seo',
  'klaviyo',
  'cro',
  'linkedin',
  'tiktok',
  'pinterest',
  'youtube',
  'email',
  'content',
])
export type ChannelType = z.infer<typeof ChannelTypeSchema>

export const AccessSchema = z.object({
  // Active marketing channels
  activeChannels: z.array(ChannelTypeSchema).default([]),

  // Platform access
  platforms: z.object({
    googleAds: z.object({
      hasAccess: z.boolean().default(false),
      accountId: z.string().optional(),
    }).optional(),
    meta: z.object({
      hasAccess: z.boolean().default(false),
      adAccountId: z.string().optional(),
      pixelId: z.string().optional(),
    }).optional(),
    searchConsole: z.object({
      hasAccess: z.boolean().default(false),
      siteUrl: z.string().optional(),
    }).optional(),
    ga4: z.object({
      hasAccess: z.boolean().default(false),
      propertyId: z.string().optional(),
    }).optional(),
    klaviyo: z.object({
      hasAccess: z.boolean().default(false),
    }).optional(),
  }).optional(),

  // Social presence
  social: z.object({
    linkedin: z.string().url().optional(),
    instagram: z.string().url().optional(),
    facebook: z.string().url().optional(),
    twitter: z.string().url().optional(),
    youtube: z.string().url().optional(),
    tiktok: z.string().url().optional(),
  }).optional(),
})
export type Access = z.infer<typeof AccessSchema>

// ===========================================
// NEXT ACTIONS - Recommended next steps
// ===========================================
export const NextActionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']),
  category: z.enum(['intake', 'setup', 'optimization', 'strategy', 'content', 'technical']),
  estimatedImpact: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).default('pending'),
})
export type NextAction = z.infer<typeof NextActionSchema>

// ===========================================
// CONFIDENCE & GAPS
// ===========================================
export const ConfidenceSchema = z.object({
  // Overall confidence score (0-1)
  overall: z.number().min(0).max(1),

  // Per-section confidence
  sections: z.object({
    observations: z.number().min(0).max(1).optional(),
    goals: z.number().min(0).max(1).optional(),
    economics: z.number().min(0).max(1).optional(),
    competitors: z.number().min(0).max(1).optional(),
    access: z.number().min(0).max(1).optional(),
  }).optional(),

  // Fields with low confidence
  lowConfidenceFields: z.array(z.string()).default([]),

  // Missing required fields
  missingFields: z.array(z.string()).default([]),
})
export type Confidence = z.infer<typeof ConfidenceSchema>

export const GapsSchema = z.object({
  // Critical gaps that need filling
  critical: z.array(
    z.object({
      field: z.string(),
      reason: z.string(),
      suggestedAction: z.string().optional(),
    })
  ).default([]),

  // Nice to have
  optional: z.array(
    z.object({
      field: z.string(),
      reason: z.string(),
    })
  ).optional(),

  // Questions to ask user
  questionsToAsk: z.array(
    z.object({
      questionKey: z.string(),
      questionText: z.string(),
      fieldPath: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    })
  ).default([]),
})
export type Gaps = z.infer<typeof GapsSchema>

// ===========================================
// MAIN AI CONTEXT SCHEMA
// ===========================================
export const AIContextSchema = z.object({
  // Schema version for migrations
  schemaVersion: z.literal('1.0'),

  // Core sections
  observations: ObservationSchema,
  goals: GoalsSchema.optional(),
  economics: EconomicsSchema.optional(),
  competitors: CompetitorsSchema.optional(),
  access: AccessSchema.optional(),

  // Actionable items
  nextActions: z.array(NextActionSchema).default([]),

  // Meta information
  confidence: ConfidenceSchema,
  gaps: GapsSchema.optional(),

  // Last updated
  lastUpdated: z.string().datetime(),
})
export type AIContext = z.infer<typeof AIContextSchema>

// ===========================================
// SUMMARY SCHEMA
// ===========================================
export const ContextSummarySchema = z.object({
  // One-liner
  oneLiner: z.string(),

  // Short description (2-3 sentences)
  shortDescription: z.string(),

  // Key facts (bullet points)
  keyFacts: z.array(z.string()),

  // For AI prompts
  promptContext: z.string(),
})
export type ContextSummary = z.infer<typeof ContextSummarySchema>

// ===========================================
// SOURCE MAP SCHEMA
// ===========================================
export const SourceMapSchema = z.record(
  z.string(), // field path e.g., "observations.usps.0"
  z.array(SourceType) // sources that contributed
)
export type SourceMap = z.infer<typeof SourceMapSchema>

// ===========================================
// FULL CONTEXT VERSION SCHEMA
// ===========================================
export const ContextVersionSchema = z.object({
  contextJson: AIContextSchema,
  summaryJson: ContextSummarySchema.optional(),
  sourceMap: SourceMapSchema,
})
export type ContextVersion = z.infer<typeof ContextVersionSchema>

// ===========================================
// VALIDATION FUNCTIONS
// ===========================================

export interface ValidationResult {
  success: boolean
  data?: AIContext
  errors?: z.ZodError
}

/**
 * Validate AI Context JSON against the schema
 */
export function validateContext(data: unknown): ValidationResult {
  const result = AIContextSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  return { success: false, errors: result.error }
}

/**
 * Validate source map
 */
export function validateSourceMap(data: unknown): boolean {
  const result = SourceMapSchema.safeParse(data)
  return result.success
}

/**
 * Validate summary
 */
export function validateSummary(data: unknown): boolean {
  const result = ContextSummarySchema.safeParse(data)
  return result.success
}

/**
 * Get validation errors as readable strings
 */
export function formatValidationErrors(errors: z.ZodError): string[] {
  return errors.issues.map((issue) => {
    const path = issue.path.join('.')
    return `${path}: ${issue.message}`
  })
}

// ===========================================
// MERGE RULES
// ===========================================
export const MERGE_PRIORITY = {
  'manual:override': 100,
  'user:intake': 90,
  'user:form': 85,
  'user:chat': 80,
  'import:api': 70,
  'import:csv': 65,
  'scrape:website': 50,
  'scrape:competitor': 45,
  'scrape:social': 40,
  'ai:inference': 30,
  'ai:heuristic': 20,
} as const

export const CONFIDENCE_OVERWRITE_THRESHOLD = 0.6

/**
 * Check if a value should overwrite existing based on merge rules
 */
export function shouldOverwrite(
  existingSource: SourceType | undefined,
  newSource: SourceType,
  existingConfidence?: number
): boolean {
  // User input always wins over AI
  if (newSource.startsWith('user:') || newSource === 'manual:override') {
    return true
  }

  // Low confidence values can be overwritten
  if (existingConfidence !== undefined && existingConfidence < CONFIDENCE_OVERWRITE_THRESHOLD) {
    return true
  }

  // Compare priorities
  if (!existingSource) {
    return true
  }

  const existingPriority = MERGE_PRIORITY[existingSource as keyof typeof MERGE_PRIORITY] ?? 0
  const newPriority = MERGE_PRIORITY[newSource as keyof typeof MERGE_PRIORITY] ?? 0

  return newPriority > existingPriority
}

// ===========================================
// DEFAULT/EMPTY CONTEXT
// ===========================================
export function createEmptyContext(companyName: string): AIContext {
  return {
    schemaVersion: '1.0',
    observations: {
      companyName,
      usps: [],
      brandVoice: {
        doNots: [],
        mustHaves: [],
      },
    },
    nextActions: [],
    confidence: {
      overall: 0,
      lowConfidenceFields: [],
      missingFields: [
        'observations.proposition',
        'observations.targetAudience',
        'goals',
        'economics',
      ],
    },
    lastUpdated: new Date().toISOString(),
  }
}
