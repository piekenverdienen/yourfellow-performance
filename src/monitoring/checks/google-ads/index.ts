import type { GoogleAdsCheck } from './base-check';
import { DisapprovedAdsCheck } from './disapproved-ads';
import { NoDeliveryCheck } from './no-delivery';

export { BaseGoogleAdsCheck } from './base-check';
export type { GoogleAdsCheck } from './base-check';
export { DisapprovedAdsCheck } from './disapproved-ads';
export { NoDeliveryCheck } from './no-delivery';

/**
 * Registry of all available Google Ads checks
 */
export const GOOGLE_ADS_CHECKS: GoogleAdsCheck[] = [
  new DisapprovedAdsCheck(),
  new NoDeliveryCheck(),
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
