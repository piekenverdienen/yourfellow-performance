import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

interface BillingSetupRow {
  billingSetup: {
    id: string;
    status: string;
    paymentsAccount: string;
    paymentsAccountInfo?: {
      paymentsAccountId: string;
      paymentsAccountName: string;
      paymentsProfileId: string;
      paymentsProfileName: string;
    };
  };
}

interface AccountRow {
  customer: {
    id: string;
    descriptiveName: string;
    status: string;
  };
}

/**
 * Check for payment and billing issues
 *
 * This check identifies:
 * - Account suspended due to billing issues
 * - Pending payment setup
 * - Account status issues that affect ad delivery
 */
export class PaymentIssuesCheck extends BaseGoogleAdsCheck {
  id = 'payment_issues';
  name = 'Betalingsproblemen';
  description = 'Detecteert betalings- en factureringsproblemen die advertenties stoppen';

  // Query to check account status
  private static ACCOUNT_QUERY = `
    SELECT
      customer.id,
      customer.descriptive_name,
      customer.status
    FROM customer
  `;

  // Query to check billing setup status
  private static BILLING_QUERY = `
    SELECT
      billing_setup.id,
      billing_setup.status,
      billing_setup.payments_account
    FROM billing_setup
    WHERE billing_setup.status != 'CANCELLED'
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    const issues: Array<{
      type: string;
      description: string;
      severity: 'critical' | 'high' | 'medium';
    }> = [];

    try {
      // Check account status
      const accountResponse = await client.query(PaymentIssuesCheck.ACCOUNT_QUERY);

      if (accountResponse.results.length > 0) {
        const account = accountResponse.results[0] as AccountRow;
        const accountStatus = account.customer?.status;

        if (accountStatus === 'SUSPENDED') {
          issues.push({
            type: 'account_suspended',
            description: 'Account is geschorst - mogelijk door betalingsproblemen',
            severity: 'critical',
          });
        } else if (accountStatus === 'CLOSED') {
          issues.push({
            type: 'account_closed',
            description: 'Account is gesloten',
            severity: 'critical',
          });
        } else if (accountStatus === 'CANCELLED') {
          issues.push({
            type: 'account_cancelled',
            description: 'Account is geannuleerd',
            severity: 'critical',
          });
        }
      }

      // Check billing setup (may fail if no access)
      try {
        const billingResponse = await client.query(PaymentIssuesCheck.BILLING_QUERY);

        if (billingResponse.results.length === 0) {
          issues.push({
            type: 'no_billing_setup',
            description: 'Geen factureringsinstellingen gevonden',
            severity: 'high',
          });
        } else {
          for (const row of billingResponse.results as BillingSetupRow[]) {
            const billingStatus = row.billingSetup?.status;

            if (billingStatus === 'PENDING') {
              issues.push({
                type: 'billing_pending',
                description: 'Factureringsinstellingen wachten op goedkeuring',
                severity: 'high',
              });
            } else if (billingStatus === 'APPROVED_HELD') {
              issues.push({
                type: 'billing_held',
                description: 'Facturering goedgekeurd maar in de wacht gezet',
                severity: 'high',
              });
            }
          }
        }
      } catch (billingError) {
        // Billing query may fail due to permissions - this is not critical
        logger.debug('Could not query billing setup (may require higher permissions)', {
          error: (billingError as Error).message,
        });
      }

      if (issues.length === 0) {
        logger.debug('No payment issues found');
        return this.okResult({ message: 'Geen betalingsproblemen gedetecteerd' });
      }

      const count = issues.length;
      const hasCritical = issues.some(i => i.severity === 'critical');

      logger.warn(`Found ${count} payment/billing issues`, {
        clientName: config.clientName,
        issues: issues.map(i => i.type),
      });

      return this.errorResult(
        count,
        {
          title: 'Google Ads: betalingsproblemen gedetecteerd',
          shortDescription: hasCritical
            ? 'Kritieke betalingsproblemen - advertenties gestopt'
            : `${count} betalingsprobleem${count > 1 ? 'en' : ''} gevonden`,
          impact: hasCritical
            ? 'Alle advertenties zijn gestopt totdat betalingsproblemen zijn opgelost'
            : 'Advertenties kunnen worden onderbroken als dit niet wordt opgelost',
          suggestedActions: [
            'Controleer de betaalmethode in Google Ads',
            'Verifieer dat er voldoende saldo is',
            'Check of de creditcard niet is verlopen',
            'Neem contact op met Google Ads support indien nodig',
            'Bekijk factureringsgeschiedenis voor afgewezen betalingen',
          ],
          severity: hasCritical ? 'critical' : 'high',
          details: {
            issueCount: count,
            issueTypes: issues.map(i => i.type),
            hasCriticalIssue: hasCritical,
          },
        },
        {
          issues,
          checkTime: new Date().toISOString(),
        }
      );
    } catch (error) {
      logger.error(`Error running ${this.id} check`, {
        error: (error as Error).message,
        clientName: config.clientName,
      });
      throw error;
    }
  }
}
