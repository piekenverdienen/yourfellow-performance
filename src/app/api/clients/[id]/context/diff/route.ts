import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface FieldDiff {
  path: string
  label: string
  oldValue: unknown
  newValue: unknown
  changeType: 'added' | 'removed' | 'changed'
}

export interface DiffResponse {
  success: boolean
  fromVersion: number
  toVersion: number
  changes: FieldDiff[]
  summary: {
    added: number
    removed: number
    changed: number
    total: number
  }
  error?: string
}

/**
 * GET /api/clients/:id/context/diff
 *
 * Compare two context versions and return field-level differences.
 * Query params:
 *   - from: version number (required)
 *   - to: version number (required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params
    const { searchParams } = new URL(request.url)
    const fromVersion = parseInt(searchParams.get('from') || '', 10)
    const toVersion = parseInt(searchParams.get('to') || '', 10)

    if (isNaN(fromVersion) || isNaN(toVersion)) {
      return NextResponse.json<DiffResponse>(
        {
          success: false,
          fromVersion: 0,
          toVersion: 0,
          changes: [],
          summary: { added: 0, removed: 0, changed: 0, total: 0 },
          error: 'Beide versienummers zijn verplicht (?from=1&to=2)'
        },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json<DiffResponse>(
        {
          success: false,
          fromVersion,
          toVersion,
          changes: [],
          summary: { added: 0, removed: 0, changed: 0, total: 0 },
          error: 'Niet geauthenticeerd'
        },
        { status: 401 }
      )
    }

    // Check client access
    const { data: hasAccess } = await supabase.rpc('has_client_access', {
      check_client_id: clientId,
      min_role: 'viewer',
    })

    if (!hasAccess) {
      return NextResponse.json<DiffResponse>(
        {
          success: false,
          fromVersion,
          toVersion,
          changes: [],
          summary: { added: 0, removed: 0, changed: 0, total: 0 },
          error: 'Geen toegang tot deze klant'
        },
        { status: 403 }
      )
    }

    // Get both versions
    const { data: versions, error: versionsError } = await supabase
      .from('ai_context_versions')
      .select('version, context_json')
      .eq('client_id', clientId)
      .in('version', [fromVersion, toVersion])

    if (versionsError || !versions || versions.length < 2) {
      return NextResponse.json<DiffResponse>(
        {
          success: false,
          fromVersion,
          toVersion,
          changes: [],
          summary: { added: 0, removed: 0, changed: 0, total: 0 },
          error: 'Een of beide versies niet gevonden'
        },
        { status: 404 }
      )
    }

    const fromData = versions.find(v => v.version === fromVersion)?.context_json as Record<string, unknown>
    const toData = versions.find(v => v.version === toVersion)?.context_json as Record<string, unknown>

    // Calculate differences
    const changes = calculateDiff(fromData, toData)

    const summary = {
      added: changes.filter(c => c.changeType === 'added').length,
      removed: changes.filter(c => c.changeType === 'removed').length,
      changed: changes.filter(c => c.changeType === 'changed').length,
      total: changes.length,
    }

    return NextResponse.json<DiffResponse>({
      success: true,
      fromVersion,
      toVersion,
      changes,
      summary,
    })
  } catch (error) {
    console.error('Diff error:', error)
    return NextResponse.json<DiffResponse>(
      {
        success: false,
        fromVersion: 0,
        toVersion: 0,
        changes: [],
        summary: { added: 0, removed: 0, changed: 0, total: 0 },
        error: 'Fout bij vergelijken'
      },
      { status: 500 }
    )
  }
}

/**
 * Human-readable labels for context paths
 */
const PATH_LABELS: Record<string, string> = {
  'observations.companyName': 'Bedrijfsnaam',
  'observations.website': 'Website',
  'observations.industry': 'Industrie',
  'observations.proposition': 'Propositie',
  'observations.tagline': 'Tagline',
  'observations.targetAudience': 'Doelgroep',
  'observations.targetAudience.primary': 'Primaire doelgroep',
  'observations.targetAudience.secondary': 'Secundaire doelgroep',
  'observations.usps': 'USPs',
  'observations.products': 'Producten',
  'observations.brandVoice': 'Merkstem',
  'observations.brandVoice.toneOfVoice': 'Tone of Voice',
  'observations.brandVoice.personality': 'Persoonlijkheid',
  'observations.brandVoice.doNots': 'Verboden woorden',
  'observations.brandVoice.mustHaves': 'Verplichte elementen',
  'goals.primary': 'Primaire doelen',
  'goals.marketing': 'Marketing doelen',
  'economics.priceRange': 'Prijsrange',
  'economics.margins': 'Marges',
  'economics.seasonality': 'Seizoensgebondenheid',
  'competitors.direct': 'Directe concurrenten',
  'access.activeChannels': 'Actieve kanalen',
  'access.social': 'Social media',
  'confidence.overall': 'Betrouwbaarheidsscore',
}

function getLabel(path: string): string {
  return PATH_LABELS[path] || path.split('.').pop() || path
}

/**
 * Calculate differences between two context objects
 */
function calculateDiff(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  prefix = ''
): FieldDiff[] {
  const changes: FieldDiff[] = []

  // Get all unique keys
  const allKeys = new Set([
    ...Object.keys(oldObj || {}),
    ...Object.keys(newObj || {}),
  ])

  for (const key of allKeys) {
    // Skip metadata fields
    if (key === 'schemaVersion' || key === 'lastUpdated') continue

    const path = prefix ? `${prefix}.${key}` : key
    const oldValue = oldObj?.[key]
    const newValue = newObj?.[key]

    // Both undefined/null - no change
    if (oldValue === undefined && newValue === undefined) continue
    if (oldValue === null && newValue === null) continue

    // Added
    if ((oldValue === undefined || oldValue === null) && newValue !== undefined && newValue !== null) {
      // Don't add if it's an empty object/array
      if (!isEmpty(newValue)) {
        changes.push({
          path,
          label: getLabel(path),
          oldValue: null,
          newValue: summarizeValue(newValue),
          changeType: 'added',
        })
      }
      continue
    }

    // Removed
    if (oldValue !== undefined && oldValue !== null && (newValue === undefined || newValue === null)) {
      if (!isEmpty(oldValue)) {
        changes.push({
          path,
          label: getLabel(path),
          oldValue: summarizeValue(oldValue),
          newValue: null,
          changeType: 'removed',
        })
      }
      continue
    }

    // Both are objects - recurse (but not for arrays)
    if (
      typeof oldValue === 'object' &&
      typeof newValue === 'object' &&
      !Array.isArray(oldValue) &&
      !Array.isArray(newValue)
    ) {
      const nestedChanges = calculateDiff(
        oldValue as Record<string, unknown>,
        newValue as Record<string, unknown>,
        path
      )
      changes.push(...nestedChanges)
      continue
    }

    // Compare values
    if (!isEqual(oldValue, newValue)) {
      changes.push({
        path,
        label: getLabel(path),
        oldValue: summarizeValue(oldValue),
        newValue: summarizeValue(newValue),
        changeType: 'changed',
      })
    }
  }

  return changes
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (typeof value === 'object' && Object.keys(value).length === 0) return true
  return false
}

/**
 * Deep equality check
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return a === b
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((val, i) => isEqual(val, b[i]))
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as object)
    const bKeys = Object.keys(b as object)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every(key => isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
  }
  return false
}

/**
 * Summarize a value for display (truncate long strings, count arrays)
 */
function summarizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    return value.length > 100 ? value.substring(0, 100) + '...' : value
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    // For arrays of objects with 'text' or 'name', extract those
    if (typeof value[0] === 'object' && value[0] !== null) {
      const firstItem = value[0] as Record<string, unknown>
      if ('text' in firstItem) {
        return value.map(v => (v as Record<string, unknown>).text)
      }
      if ('name' in firstItem) {
        return value.map(v => (v as Record<string, unknown>).name)
      }
    }
    return value
  }
  return value
}
