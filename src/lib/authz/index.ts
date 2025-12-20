/**
 * Authorization Helpers
 *
 * Provides utilities for feature access control and role-based permissions.
 * MVP: Simple environment-based feature flags with role checks.
 */

import { createClient } from '@/lib/supabase/server'

// ============================================
// Types
// ============================================

export type UserRole = 'admin' | 'marketer' | 'client'

export interface FeatureFlags {
  viralHub: boolean
  advancedAnalytics: boolean
  multiClient: boolean
}

export interface AuthzContext {
  userId: string
  role: UserRole
  features: FeatureFlags
}

// ============================================
// Feature Flag Configuration
// ============================================

/**
 * Get feature flags from environment
 * Environment variables:
 * - VIRAL_HUB_INTERNAL_ONLY: 'true' | 'false' (default: 'true')
 * - ADVANCED_ANALYTICS_ENABLED: 'true' | 'false' (default: 'false')
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    viralHub: process.env.VIRAL_HUB_INTERNAL_ONLY !== 'false', // internal only by default
    advancedAnalytics: process.env.ADVANCED_ANALYTICS_ENABLED === 'true',
    multiClient: true, // Always enabled for MVP
  }
}

// ============================================
// Role Checks
// ============================================

const INTERNAL_ROLES: UserRole[] = ['admin', 'marketer']

/**
 * Check if a role is considered "internal" (staff)
 */
export function isInternalRole(role: UserRole): boolean {
  return INTERNAL_ROLES.includes(role)
}

/**
 * Check if a role has minimum required access level
 */
export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    admin: 3,
    marketer: 2,
    client: 1,
  }

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

// ============================================
// Feature Access Checks
// ============================================

/**
 * Check if a user can access the Viral Hub feature
 */
export function canAccessViralHub(role: UserRole): boolean {
  const flags = getFeatureFlags()

  // If internal only, check role
  if (flags.viralHub) {
    return isInternalRole(role)
  }

  // If not internal only, allow all authenticated users
  return true
}

/**
 * Check if a user can access advanced analytics
 */
export function canAccessAdvancedAnalytics(role: UserRole): boolean {
  const flags = getFeatureFlags()

  if (!flags.advancedAnalytics) {
    return false
  }

  return hasMinimumRole(role, 'marketer')
}

// ============================================
// Server-Side Authorization
// ============================================

/**
 * Get authorization context for the current user
 * Use in API routes to check permissions
 */
export async function getAuthzContext(): Promise<AuthzContext | null> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return null
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (profile?.role as UserRole) || 'client'

    return {
      userId: user.id,
      role,
      features: getFeatureFlags(),
    }
  } catch {
    return null
  }
}

/**
 * Check feature access and return error response if denied
 * Use in API routes for consistent error handling
 */
export async function checkViralHubAccess(): Promise<{ allowed: true; context: AuthzContext } | { allowed: false; error: string; status: number }> {
  const context = await getAuthzContext()

  if (!context) {
    return {
      allowed: false,
      error: 'Authentication required',
      status: 401,
    }
  }

  if (!canAccessViralHub(context.role)) {
    return {
      allowed: false,
      error: 'Access denied. Viral Hub is internal-only in MVP.',
      status: 403,
    }
  }

  return {
    allowed: true,
    context,
  }
}

// ============================================
// Client-Side Helpers
// ============================================

/**
 * Feature flag names for client-side use
 */
export const FEATURE_NAMES = {
  VIRAL_HUB: 'viralHub',
  ADVANCED_ANALYTICS: 'advancedAnalytics',
  MULTI_CLIENT: 'multiClient',
} as const
