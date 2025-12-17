import { MetricType, Severity, ThresholdConfig, GlobalConfig, ClientConfig } from '../config';
import { MetricDataset } from '../ga4';
import { AnomalyResult, AnomalyReason } from './types';

export interface EvaluatorOptions {
  globalConfig: GlobalConfig;
  clientConfig: ClientConfig;
  thresholds: ThresholdConfig;
}

/**
 * Calculate baseline average from data points
 */
export function calculateBaseline(data: { value: number }[]): number {
  if (data.length === 0) return 0;
  const sum = data.reduce((acc, d) => acc + d.value, 0);
  return sum / data.length;
}

/**
 * Calculate percentage change
 */
export function calculateDeltaPct(actual: number, baseline: number): number {
  if (baseline === 0) {
    return actual === 0 ? 0 : 100; // 100% increase from zero baseline
  }
  return ((actual - baseline) / baseline) * 100;
}

/**
 * Generate diagnosis hint based on metric and anomaly
 */
function generateDiagnosisHint(
  metric: MetricType,
  deltaPct: number,
  reason: AnomalyReason,
  isZero: boolean
): string {
  if (reason === 'zero_value') {
    switch (metric) {
      case 'sessions':
        return 'Geen sessies geregistreerd. Mogelijke oorzaken: tracking code verwijderd, website offline, of filter-probleem.';
      case 'conversions':
        return 'Geen conversies geregistreerd. Check of de key event nog correct geconfigureerd is in GA4.';
      case 'purchaseRevenue':
        return 'Geen omzet geregistreerd. Check e-commerce tracking setup en of er daadwerkelijk aankopen zijn gedaan.';
      default:
        return `${metric} is nul terwijl er normaal wel data is. Check de tracking configuratie.`;
    }
  }

  const direction = deltaPct > 0 ? 'stijging' : 'daling';

  switch (metric) {
    case 'sessions':
      return deltaPct < 0
        ? 'Significante daling in sessies. Check recente campagne-wijzigingen, SEO-issues of technische problemen.'
        : 'Onverwachte stijging in sessies. Controleer of dit organische groei is of mogelijk spam/bot traffic.';

    case 'totalUsers':
      return deltaPct < 0
        ? 'Minder unieke gebruikers dan verwacht. Mogelijk minder bereik via campagnes of organisch verkeer.'
        : 'Meer unieke gebruikers. Controleer bron van extra traffic (campagne, viral content, etc.)';

    case 'engagementRate':
      return deltaPct < 0
        ? 'Engagement rate is gedaald. Check of er recente wijzigingen zijn aan de website/content.'
        : 'Engagement rate is gestegen. Positief signaal, maar verifieer dat dit niet door minder (maar geëngageerdere) bezoekers komt.';

    case 'conversions':
      return deltaPct < 0
        ? 'Conversies zijn gedaald. Check conversiepad, landingspagina\'s en eventuele technische issues.'
        : 'Conversies zijn gestegen. Positief! Verifieer dat tracking correct werkt en check succesvolle campagnes.';

    case 'purchaseRevenue':
      return deltaPct < 0
        ? 'Revenue is gedaald. Analyseer orderwaarde en aantal transacties apart.'
        : 'Revenue is gestegen. Goed nieuws! Check of dit door hogere volumes of hogere orderwaarde komt.';

    default:
      return `Significante ${direction} in ${metric}. Nader onderzoek aanbevolen.`;
  }
}

/**
 * Generate checklist items based on metric type
 */
function generateChecklist(
  metric: MetricType,
  deltaPct: number,
  isZero: boolean
): string[] {
  const baseChecklist = [
    'Check GA4 Realtime rapport voor actuele data',
    'Vergelijk met vorige week dezelfde dag'
  ];

  if (isZero) {
    return [
      'Check of GA4 tracking code aanwezig is op de website',
      'Controleer GA4 DebugView voor events',
      'Check of er filters actief zijn die data blokkeren',
      'Verifieer dat de property ID correct is',
      ...baseChecklist
    ];
  }

  switch (metric) {
    case 'sessions':
    case 'totalUsers':
      return [
        'Analyseer traffic bronnen in GA4 (Acquisition rapport)',
        'Check Google Search Console voor SEO wijzigingen',
        'Review actieve campagnes in Google Ads',
        'Controleer op technische website issues',
        ...baseChecklist
      ];

    case 'engagementRate':
      return [
        'Check bounce rate en sessieduur',
        'Analyseer welke pagina\'s het meest bezocht worden',
        'Review recente content/design wijzigingen',
        ...baseChecklist
      ];

    case 'conversions':
      return [
        'Test het conversiepad handmatig',
        'Check of de key event nog correct triggert',
        'Analyseer funnel stappen in GA4',
        'Review landingspagina performance',
        ...baseChecklist
      ];

    case 'purchaseRevenue':
      return [
        'Check aantal transacties vs gemiddelde orderwaarde',
        'Analyseer product performance',
        'Review checkout flow voor errors',
        'Check payment provider status',
        ...baseChecklist
      ];

    default:
      return baseChecklist;
  }
}

/**
 * Evaluate a single metric dataset for anomalies
 */
export function evaluateMetric(
  dataset: MetricDataset,
  options: EvaluatorOptions
): AnomalyResult {
  const { globalConfig, clientConfig, thresholds } = options;
  const { metric, yesterday, baselineData, daysAvailable } = dataset;

  const baseline = calculateBaseline(baselineData);
  const actual = yesterday.value;
  const deltaPct = calculateDeltaPct(actual, baseline);
  const direction = deltaPct > 0 ? 'increase' : deltaPct < 0 ? 'decrease' : 'none';

  // Default result (no anomaly)
  const baseResult: AnomalyResult = {
    clientId: dataset.clientId,
    clientName: clientConfig.name,
    metric,
    date: yesterday.date,
    severity: null,
    baseline,
    actual,
    deltaPct,
    direction,
    reason: 'no_anomaly',
    diagnosisHint: '',
    checklistItems: []
  };

  // Check for zero value on critical metrics
  const zeroValueMetrics: MetricType[] = ['sessions', 'conversions', 'purchaseRevenue'];
  if (zeroValueMetrics.includes(metric) && actual === 0 && baseline > 0) {
    return {
      ...baseResult,
      severity: 'CRITICAL',
      reason: 'zero_value',
      diagnosisHint: generateDiagnosisHint(metric, deltaPct, 'zero_value', true),
      checklistItems: generateChecklist(metric, deltaPct, true)
    };
  }

  // Check if we have enough data for percentage-based alerts
  if (daysAvailable < globalConfig.minDaysForPercentageAlerts) {
    return {
      ...baseResult,
      reason: 'insufficient_data',
      diagnosisHint: `Onvoldoende data (${daysAvailable} dagen beschikbaar, minimaal ${globalConfig.minDaysForPercentageAlerts} nodig).`
    };
  }

  // Check minimum baseline guardrail
  if (baseline < thresholds.minBaseline) {
    return {
      ...baseResult,
      reason: 'below_minimum_baseline',
      diagnosisHint: `Baseline (${baseline.toFixed(1)}) is onder minimum drempel (${thresholds.minBaseline}). Geen alert gegenereerd.`
    };
  }

  // Check percentage deviation
  const absDeltaPct = Math.abs(deltaPct);

  if (absDeltaPct >= thresholds.critical) {
    return {
      ...baseResult,
      severity: 'CRITICAL',
      reason: 'percentage_deviation',
      diagnosisHint: generateDiagnosisHint(metric, deltaPct, 'percentage_deviation', false),
      checklistItems: generateChecklist(metric, deltaPct, false)
    };
  }

  if (absDeltaPct >= thresholds.warning) {
    return {
      ...baseResult,
      severity: 'WARNING',
      reason: 'percentage_deviation',
      diagnosisHint: generateDiagnosisHint(metric, deltaPct, 'percentage_deviation', false),
      checklistItems: generateChecklist(metric, deltaPct, false)
    };
  }

  return baseResult;
}
