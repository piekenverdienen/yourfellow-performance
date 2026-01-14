/**
 * Audit Logging Service
 *
 * Logboek voor belangrijke acties:
 * - Wie deed wat
 * - Wanneer
 * - Welke data was betrokken
 *
 * Logs worden opgeslagen in de database voor compliance en debugging.
 */

import { createClient } from '@/lib/supabase/server'

// Audit event types
export type AuditAction =
  | 'client.create'
  | 'client.update'
  | 'client.delete'
  | 'client.access'
  | 'user.login'
  | 'user.logout'
  | 'user.settings_change'
  | 'data.export'
  | 'data.delete'
  | 'api.rate_limited'
  | 'security.suspicious_activity'
  | 'membership.requested'
  | 'membership.approved'
  | 'membership.rejected'

export interface AuditLogEntry {
  action: AuditAction
  userId: string
  userEmail?: string
  resourceType?: string // 'client', 'user', 'opportunity', etc.
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

/**
 * Log an audit event
 *
 * Voorbeeld:
 * await auditLog({
 *   action: 'client.update',
 *   userId: user.id,
 *   resourceType: 'client',
 *   resourceId: clientId,
 *   details: { field: 'name', oldValue: 'Acme', newValue: 'Acme Inc' }
 * })
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = await createClient()

    await supabase.from('audit_logs').insert({
      action: entry.action,
      user_id: entry.userId,
      user_email: entry.userEmail,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      details: entry.details,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    // Don't let audit logging failures break the app
    // But do log to console for monitoring
    console.error('[AuditLog] Failed to write audit log:', error)
  }
}

/**
 * Helper to extract request metadata for audit logs
 */
export function getRequestMetadata(request: Request): {
  ipAddress: string
  userAgent: string
} {
  const forwarded = request.headers.get('x-forwarded-for')
  const ipAddress =
    forwarded?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  const userAgent = request.headers.get('user-agent') || 'unknown'

  return { ipAddress, userAgent }
}

/**
 * Audit log met rate limit info
 */
export async function logRateLimitHit(
  request: Request,
  userId?: string,
  endpoint?: string
): Promise<void> {
  const { ipAddress, userAgent } = getRequestMetadata(request)

  await auditLog({
    action: 'api.rate_limited',
    userId: userId || 'anonymous',
    details: {
      endpoint,
      timestamp: new Date().toISOString(),
    },
    ipAddress,
    userAgent,
  })
}

/**
 * Audit log voor security events
 */
export async function logSecurityEvent(
  request: Request,
  userId: string | undefined,
  reason: string,
  details?: Record<string, unknown>
): Promise<void> {
  const { ipAddress, userAgent } = getRequestMetadata(request)

  await auditLog({
    action: 'security.suspicious_activity',
    userId: userId || 'anonymous',
    details: {
      reason,
      ...details,
    },
    ipAddress,
    userAgent,
  })
}
