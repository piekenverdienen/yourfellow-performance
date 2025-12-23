import type { GoogleAdsCheck } from './base-check';

// Import all checks
import { DisapprovedAdsCheck } from './disapproved-ads';
import { NoDeliveryCheck } from './no-delivery';
import { BudgetDepletedCheck } from './budget-depleted';
import { PaymentIssuesCheck } from './payment-issues';
import { LowQualityScoreCheck } from './low-quality-score';
import { HighCpcCheck } from './high-cpc';
import { ConversionTrackingCheck } from './conversion-tracking';
import { LimitedByBudgetCheck } from './limited-by-budget';
import { LowAdStrengthCheck } from './low-ad-strength';
import { ExtensionsDisapprovedCheck } from './extensions-disapproved';
import { AudienceIssuesCheck } from './audience-issues';
import { PausedHighPerformersCheck } from './paused-high-performers';

// Export base class and types
export { BaseGoogleAdsCheck } from './base-check';
export type { GoogleAdsCheck } from './base-check';

// Export all check classes
export { DisapprovedAdsCheck } from './disapproved-ads';
export { NoDeliveryCheck } from './no-delivery';
export { BudgetDepletedCheck } from './budget-depleted';
export { PaymentIssuesCheck } from './payment-issues';
export { LowQualityScoreCheck } from './low-quality-score';
export { HighCpcCheck } from './high-cpc';
export { ConversionTrackingCheck } from './conversion-tracking';
export { LimitedByBudgetCheck } from './limited-by-budget';
export { LowAdStrengthCheck } from './low-ad-strength';
export { ExtensionsDisapprovedCheck } from './extensions-disapproved';
export { AudienceIssuesCheck } from './audience-issues';
export { PausedHighPerformersCheck } from './paused-high-performers';

/**
 * Registry of all available Google Ads checks
 *
 * Checks are ordered by priority/importance:
 * 1. Critical blockers (payment, disapproved ads)
 * 2. Delivery issues (no delivery, budget)
 * 3. Performance issues (QS, CPC, conversions)
 * 4. Optimization opportunities (ad strength, extensions, audiences)
 */
export const GOOGLE_ADS_CHECKS: GoogleAdsCheck[] = [
  // Critical - These can completely stop ad delivery
  new PaymentIssuesCheck(),
  new DisapprovedAdsCheck(),

  // Delivery Issues - Ads enabled but not showing
  new NoDeliveryCheck(),
  new BudgetDepletedCheck(),
  new LimitedByBudgetCheck(),

  // Tracking & Measurement - Can't optimize without data
  new ConversionTrackingCheck(),

  // Performance Issues - Wasting budget or underperforming
  new LowQualityScoreCheck(),
  new HighCpcCheck(),
  new PausedHighPerformersCheck(),

  // Optimization Opportunities - Room for improvement
  new LowAdStrengthCheck(),
  new ExtensionsDisapprovedCheck(),
  new AudienceIssuesCheck(),
];

/**
 * Get a check by ID
 */
export function getCheck(checkId: string): GoogleAdsCheck | undefined {
  return GOOGLE_ADS_CHECKS.find(check => check.id === checkId);
}

/**
 * Get all check IDs
 */
export function getAllCheckIds(): string[] {
  return GOOGLE_ADS_CHECKS.map(check => check.id);
}

/**
 * Get checks by category
 */
export function getChecksByCategory(): Record<string, GoogleAdsCheck[]> {
  return {
    critical: [
      new PaymentIssuesCheck(),
      new DisapprovedAdsCheck(),
    ],
    delivery: [
      new NoDeliveryCheck(),
      new BudgetDepletedCheck(),
      new LimitedByBudgetCheck(),
    ],
    tracking: [
      new ConversionTrackingCheck(),
    ],
    performance: [
      new LowQualityScoreCheck(),
      new HighCpcCheck(),
      new PausedHighPerformersCheck(),
    ],
    optimization: [
      new LowAdStrengthCheck(),
      new ExtensionsDisapprovedCheck(),
      new AudienceIssuesCheck(),
    ],
  };
}
