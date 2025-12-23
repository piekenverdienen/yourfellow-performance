import type { GoogleAdsCheck } from './base-check';
import { DisapprovedAdsCheck } from './disapproved-ads';
import { NoDeliveryCheck } from './no-delivery';
import { BudgetDepletedCheck } from './budget-depleted';
import { ConversionTrackingBrokenCheck } from './conversion-tracking-broken';
import { LowQualityScoreCheck } from './low-quality-score';
import { KeywordConflictsCheck } from './keyword-conflicts';
import { MissingExtensionsCheck } from './missing-extensions';
import { CpcSpikeCheck } from './cpc-spike';
import { SearchTermWasteCheck } from './search-term-waste';
import { AdGroupWithoutAdsCheck } from './ad-group-without-ads';
import { LimitedByBudgetCheck } from './limited-by-budget';
import { LandingPageErrorsCheck } from './landing-page-errors';

export { BaseGoogleAdsCheck } from './base-check';
export type { GoogleAdsCheck } from './base-check';

// Export all check classes
export { DisapprovedAdsCheck } from './disapproved-ads';
export { NoDeliveryCheck } from './no-delivery';
export { BudgetDepletedCheck } from './budget-depleted';
export { ConversionTrackingBrokenCheck } from './conversion-tracking-broken';
export { LowQualityScoreCheck } from './low-quality-score';
export { KeywordConflictsCheck } from './keyword-conflicts';
export { MissingExtensionsCheck } from './missing-extensions';
export { CpcSpikeCheck } from './cpc-spike';
export { SearchTermWasteCheck } from './search-term-waste';
export { AdGroupWithoutAdsCheck } from './ad-group-without-ads';
export { LimitedByBudgetCheck } from './limited-by-budget';
export { LandingPageErrorsCheck } from './landing-page-errors';

/**
 * Registry of all available Google Ads checks
 * These run automatically every 30 minutes
 */
export const GOOGLE_ADS_CHECKS: GoogleAdsCheck[] = [
  // Critical issues - always run
  new DisapprovedAdsCheck(),
  new NoDeliveryCheck(),
  new LandingPageErrorsCheck(),
  new ConversionTrackingBrokenCheck(),
  new AdGroupWithoutAdsCheck(),

  // Budget & performance
  new BudgetDepletedCheck(),
  new LimitedByBudgetCheck(),
  new CpcSpikeCheck(),

  // Optimization opportunities
  new LowQualityScoreCheck(),
  new KeywordConflictsCheck(),
  new SearchTermWasteCheck(),

  // Extensions (currently returns OK, needs enhancement)
  new MissingExtensionsCheck(),
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
