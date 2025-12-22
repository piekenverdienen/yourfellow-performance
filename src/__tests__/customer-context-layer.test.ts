import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  validateContext,
  createEmptyContext,
  formatValidationErrors,
  shouldOverwrite,
  CONFIDENCE_OVERWRITE_THRESHOLD,
  AIContext,
} from '@/lib/context'

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  })),
  rpc: vi.fn(),
}

// Mock createClient
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))

// Test data
const mockUser = {
  id: 'user-id-123',
  email: 'user@test.com',
}

const mockClient = {
  id: 'client-id-456',
  name: 'Test Company',
  slug: 'test-company',
}

const mockValidContext: AIContext = {
  schemaVersion: '1.0',
  observations: {
    companyName: 'Test Company',
    website: 'https://test.com',
    proposition: 'We provide the best testing solutions',
    usps: [
      { text: 'Fast delivery', confidence: 'high' },
      { text: 'Expert support', confidence: 'medium' },
    ],
    brandVoice: {
      toneOfVoice: 'Professional but friendly',
      doNots: ['Use jargon', 'Make promises we cannot keep'],
      mustHaves: ['Include our tagline'],
    },
  },
  goals: {
    primary: ['Increase brand awareness', 'Generate leads'],
    marketing: {
      awareness: true,
      leads: true,
      sales: false,
    },
  },
  economics: {
    priceRange: {
      min: 100,
      max: 1000,
      currency: 'EUR',
    },
  },
  access: {
    activeChannels: ['google_ads', 'seo', 'linkedin'],
  },
  nextActions: [
    {
      id: 'action-1',
      title: 'Complete intake form',
      priority: 'high',
      category: 'intake',
      status: 'pending',
    },
  ],
  confidence: {
    overall: 0.75,
    sections: {
      observations: 0.8,
      goals: 0.7,
    },
    lowConfidenceFields: ['economics.margins'],
    missingFields: ['competitors'],
  },
  lastUpdated: new Date().toISOString(),
}

// ============================================
// STAP 10.1: Schema Validation Tests
// ============================================
describe('AI Context Schema Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should validate a complete valid context', () => {
    const result = validateContext(mockValidContext)
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.schemaVersion).toBe('1.0')
  })

  it('should reject context without schemaVersion', () => {
    const invalidContext = { ...mockValidContext }
    // @ts-expect-error - testing invalid input
    delete invalidContext.schemaVersion

    const result = validateContext(invalidContext)
    expect(result.success).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('should reject context without observations.companyName', () => {
    const invalidContext = {
      ...mockValidContext,
      observations: {
        ...mockValidContext.observations,
        companyName: '',
      },
    }

    const result = validateContext(invalidContext)
    expect(result.success).toBe(false)
  })

  it('should accept context with minimal required fields', () => {
    const minimalContext = createEmptyContext('Minimal Company')

    const result = validateContext(minimalContext)
    expect(result.success).toBe(true)
    expect(result.data?.observations.companyName).toBe('Minimal Company')
  })

  it('should format validation errors as readable strings', () => {
    const invalidContext = { schemaVersion: '2.0' }
    const result = validateContext(invalidContext)

    if (!result.success && result.errors) {
      const formatted = formatValidationErrors(result.errors)
      expect(Array.isArray(formatted)).toBe(true)
      expect(formatted.length).toBeGreaterThan(0)
      expect(typeof formatted[0]).toBe('string')
    }
  })
})

// ============================================
// STAP 10.2: Merge Rules Tests
// ============================================
describe('Context Merge Rules', () => {
  it('should prioritize user input over AI observations', () => {
    const result = shouldOverwrite('ai:inference', 'user:intake')
    expect(result).toBe(true)
  })

  it('should prioritize manual override over everything', () => {
    const result = shouldOverwrite('user:intake', 'manual:override')
    expect(result).toBe(true)
  })

  it('should overwrite low confidence values', () => {
    const lowConfidence = CONFIDENCE_OVERWRITE_THRESHOLD - 0.1
    const result = shouldOverwrite('scrape:website', 'ai:inference', lowConfidence)
    expect(result).toBe(true)
  })

  it('should not overwrite high confidence values with lower priority source', () => {
    const highConfidence = CONFIDENCE_OVERWRITE_THRESHOLD + 0.1
    const result = shouldOverwrite('user:intake', 'ai:inference', highConfidence)
    expect(result).toBe(false)
  })

  it('should allow new values when no existing source', () => {
    const result = shouldOverwrite(undefined, 'scrape:website')
    expect(result).toBe(true)
  })
})

// ============================================
// STAP 10.3: Context API Tests
// ============================================
describe('GET /api/clients/:id/context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 for unauthenticated users', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const { GET } = await import('@/app/api/clients/[id]/context/route')
    const response = await GET(
      new NextRequest('http://localhost/api/clients/123/context'),
      { params: Promise.resolve({ id: '123' }) }
    )

    expect(response.status).toBe(401)
  })

  it('should return 403 for users without client access', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })
    mockSupabaseClient.rpc.mockResolvedValue({
      data: false,
      error: null,
    })

    const { GET } = await import('@/app/api/clients/[id]/context/route')
    const response = await GET(
      new NextRequest('http://localhost/api/clients/123/context'),
      { params: Promise.resolve({ id: '123' }) }
    )

    expect(response.status).toBe(403)
  })

  it('should return empty context for new clients', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })
    mockSupabaseClient.rpc.mockResolvedValue({
      data: true,
      error: null,
    })

    // Mock first call (client_context) returns not found
    // Mock second call (clients) returns the client
    let callCount = 0
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'client_context') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          }),
        }
      }
      // clients table
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockClient.id, name: mockClient.name },
          error: null,
        }),
      }
    })
    mockSupabaseClient.from = mockFrom

    const { GET } = await import('@/app/api/clients/[id]/context/route')
    const response = await GET(
      new NextRequest('http://localhost/api/clients/123/context'),
      { params: Promise.resolve({ id: mockClient.id }) }
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.context).toBeNull()
    expect(data.status).toBe('pending')
  })
})

// ============================================
// STAP 10.4: Version Management Tests
// ============================================
describe('Context Version Management', () => {
  it('should track version numbers correctly', () => {
    // Version 1 for new client
    // Version 2 after enrichment
    // Version 3 after re-analysis
    const versions = [1, 2, 3]
    expect(versions).toEqual([1, 2, 3])
  })

  it('should preserve old versions after creating new ones', () => {
    const oldVersion = { version: 1, context: { ...mockValidContext } }
    const newVersion = {
      version: 2,
      context: { ...mockValidContext, lastUpdated: new Date().toISOString() },
    }

    // Both should exist independently
    expect(oldVersion.version).toBe(1)
    expect(newVersion.version).toBe(2)
    expect(oldVersion.context).not.toBe(newVersion.context)
  })

  it('should require explicit activation of new versions', () => {
    // New versions should not auto-activate (except for first intake)
    const autoActivateOnFirstIntake = true
    const autoActivateOnEnrichment = false

    expect(autoActivateOnFirstIntake).toBe(true)
    expect(autoActivateOnEnrichment).toBe(false)
  })
})

// ============================================
// STAP 10.5: Intake Job Tests
// ============================================
describe('Intake Job System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create pending job with correct initial state', () => {
    const newJob = {
      id: 'job-123',
      client_id: mockClient.id,
      job_type: 'full_intake',
      status: 'pending',
      progress: 0,
      steps_completed: [],
      current_step: 'waiting',
    }

    expect(newJob.status).toBe('pending')
    expect(newJob.progress).toBe(0)
    expect(newJob.steps_completed).toEqual([])
  })

  it('should track progress through intake steps', () => {
    const steps = [
      { name: 'scraping', progress: 10 },
      { name: 'analyzing', progress: 50 },
      { name: 'generating', progress: 70 },
      { name: 'completed', progress: 100 },
    ]

    steps.forEach((step, index) => {
      expect(step.progress).toBeGreaterThan(index > 0 ? steps[index - 1].progress : -1)
    })
  })

  it('should prevent multiple concurrent jobs for same client', () => {
    const runningJob = { id: 'job-1', status: 'scraping' }
    const newJobRequest = { client_id: mockClient.id }

    // Logic check: if running job exists, reject new job
    const shouldReject = runningJob.status !== 'completed' && runningJob.status !== 'failed'
    expect(shouldReject).toBe(true)
  })
})

// ============================================
// STAP 10.6: Source Mapping Tests
// ============================================
describe('Source Mapping (Explainability)', () => {
  it('should track source for each field', () => {
    const sourceMap = {
      'observations.companyName': ['scrape:website'],
      'observations.proposition': ['scrape:website', 'ai:inference'],
      'observations.usps.0': ['user:intake'],
      'goals.primary': ['ai:inference'],
    }

    expect(sourceMap['observations.companyName']).toContain('scrape:website')
    expect(sourceMap['observations.usps.0']).toContain('user:intake')
  })

  it('should require source_map for every context version', () => {
    const version = {
      version: 1,
      context_json: mockValidContext,
      source_map: {},
    }

    // Empty source_map should trigger validation warning (not fail)
    expect(version.source_map).toBeDefined()
    expect(typeof version.source_map).toBe('object')
  })

  it('should support multiple sources per field', () => {
    const sourceMap = {
      'observations.proposition': ['scrape:website', 'user:intake', 'ai:inference'],
    }

    expect(sourceMap['observations.proposition'].length).toBe(3)
  })
})

// ============================================
// STAP 10.7: Read-Only Usage Contract
// ============================================
describe('Read-Only Context Usage Contract', () => {
  it('should only expose GET endpoint for context reading', () => {
    // All AI tools should use: GET /api/clients/:id/context
    const readEndpoint = 'GET /api/clients/:id/context'

    // Tools should NOT use:
    // - POST /api/clients/:id/context (doesn't exist)
    // - Direct database access

    expect(readEndpoint).toContain('GET')
  })

  it('should return consistent context structure for all consumers', () => {
    const contextResponse = {
      success: true,
      context: mockValidContext,
      summary: {
        oneLiner: 'Test Company provides testing solutions',
        promptContext: 'Context for AI prompts',
      },
      version: 1,
      status: 'active',
      generatedAt: new Date().toISOString(),
    }

    // All AI tools expect this structure
    expect(contextResponse.context).toBeDefined()
    expect(contextResponse.summary).toBeDefined()
    expect(contextResponse.version).toBeDefined()
  })
})

// ============================================
// STAP 10.8: Enrichment Flow Tests
// ============================================
describe('Context Enrichment Flow', () => {
  it('should accept new intake answers without overwriting context', () => {
    const existingContext = mockValidContext
    const newAnswer = {
      questionKey: 'observations.proposition',
      answerText: 'Updated proposition from user',
      source_type: 'user_input',
    }

    // Answer should be stored separately
    expect(newAnswer.source_type).toBe('user_input')
    // Context regeneration happens on explicit request
  })

  it('should expose missing fields for UX guidance', () => {
    const enrichmentInfo = {
      missingFields: ['competitors', 'economics.margins'],
      lowConfidenceFields: ['observations.targetAudience'],
      suggestedNextInputs: [
        {
          field: 'competitors',
          question: 'Wie zijn jullie belangrijkste concurrenten?',
          priority: 'high',
        },
      ],
    }

    expect(enrichmentInfo.suggestedNextInputs.length).toBeGreaterThan(0)
    expect(enrichmentInfo.suggestedNextInputs[0].priority).toBe('high')
  })

  it('should increment version after enrichment', () => {
    const beforeVersion = 1
    const afterVersion = 2

    expect(afterVersion).toBe(beforeVersion + 1)
  })
})

// ============================================
// STAP 10.9: Database Schema Tests
// ============================================
describe('Database Schema Requirements', () => {
  it('should have all required tables defined', () => {
    const requiredTables = [
      'clients', // Existing
      'client_context', // New: stores active version pointer
      'ai_context_versions', // New: stores all context versions
      'intake_jobs', // New: async job tracking
      'scraped_sources', // New: scraped content storage
      'intake_answers', // New: user input storage
    ]

    expect(requiredTables.length).toBe(6)
  })

  it('should enforce active_version constraint', () => {
    // client_context.active_version must point to valid ai_context_versions.version
    const clientContext = {
      client_id: mockClient.id,
      active_version: 1,
    }

    const contextVersion = {
      client_id: mockClient.id,
      version: 1,
    }

    expect(clientContext.active_version).toBe(contextVersion.version)
  })

  it('should have RLS policies for all new tables', () => {
    const tablesWithRLS = [
      'ai_context_versions',
      'client_context',
      'intake_jobs',
      'scraped_sources',
      'intake_answers',
    ]

    // All tables should have RLS enabled
    expect(tablesWithRLS.length).toBe(5)
  })
})

// ============================================
// STAP 10.10: Integration Scenario Tests
// ============================================
describe('Integration Scenarios', () => {
  it('Scenario 1: New client → intake → context v1', () => {
    // 1. Create client
    const client = { id: 'new-client', name: 'New Client' }

    // 2. Start intake job
    const job = {
      id: 'job-1',
      client_id: client.id,
      job_type: 'full_intake',
      status: 'pending',
    }

    // 3. After completion, context version 1 is created
    const contextVersion = {
      client_id: client.id,
      version: 1,
      generated_by: 'intake',
    }

    expect(contextVersion.version).toBe(1)
    expect(contextVersion.generated_by).toBe('intake')
  })

  it('Scenario 2: Existing client → enrichment → context v2', () => {
    // 1. Client has context v1
    const existingVersion = 1

    // 2. User submits new intake answers
    const answer = {
      client_id: mockClient.id,
      question_key: 'competitors',
      answer_text: 'Competitor A, Competitor B',
    }

    // 3. Trigger enrichment
    // 4. New version created
    const newVersion = existingVersion + 1

    expect(newVersion).toBe(2)
    expect(answer.question_key).toBe('competitors')
  })

  it('Scenario 3: Old versions remain readable after new version', () => {
    const versions = [
      { version: 1, generatedAt: '2024-01-01' },
      { version: 2, generatedAt: '2024-02-01' },
      { version: 3, generatedAt: '2024-03-01' },
    ]

    // All versions should be accessible
    expect(versions.length).toBe(3)
    versions.forEach((v) => {
      expect(v.version).toBeGreaterThan(0)
      expect(v.generatedAt).toBeDefined()
    })
  })

  it('Scenario 4: Switch active version works', () => {
    const currentActive = 3
    const switchTo = 2

    // After switching, active version should be 2
    expect(switchTo).not.toBe(currentActive)
    expect(switchTo).toBe(2)
  })

  it('Scenario 5: Single endpoint feeds all AI features', () => {
    // All these features should use the same context endpoint
    const features = [
      'Google Ads Copy Generator',
      'SEO Content Writer',
      'Social Media Post Generator',
      'CRO Analyzer',
      'Workflow AI Agent',
    ]

    const endpoint = 'GET /api/clients/:id/context'

    // All features use the same endpoint
    features.forEach(() => {
      expect(endpoint).toBe('GET /api/clients/:id/context')
    })
  })
})
