import { describe, it, expect } from 'vitest';
import {
  calculateBaseline,
  calculateDeltaPct,
  evaluateMetric,
  EvaluatorOptions
} from '../evaluator';
import { MetricDataset } from '../../ga4';
import { GlobalConfig, ClientConfig, ThresholdConfig } from '../../config';

// Default test fixtures
const defaultGlobalConfig: GlobalConfig = {
  defaultThresholds: { warning: 20, critical: 40, minBaseline: 20 },
  baselineWindowDays: 7,
  minDaysForPercentageAlerts: 3,
  rateLimiting: { requestsPerMinute: 60, retryAttempts: 2, retryDelayMs: 1000 }
};

const defaultClientConfig: ClientConfig = {
  id: 'test-client',
  name: 'Test Client',
  ga4PropertyId: '123456789',
  timezone: 'Europe/Amsterdam',
  metrics: {
    sessions: true,
    totalUsers: true,
    engagementRate: true,
    conversions: false,
    purchaseRevenue: false
  },
  isEcommerce: false,
  clickup: { listId: 'test-list' }
};

const defaultThresholds: ThresholdConfig = {
  warning: 20,
  critical: 40,
  minBaseline: 20
};

function createDataset(
  metric: 'sessions' | 'totalUsers' | 'engagementRate' | 'conversions' | 'purchaseRevenue',
  actual: number,
  baselineValues: number[]
): MetricDataset {
  return {
    clientId: 'test-client',
    metric,
    yesterday: { metric, date: '2024-01-15', value: actual },
    baselineData: baselineValues.map((value, i) => ({
      metric,
      date: `2024-01-${String(14 - i).padStart(2, '0')}`,
      value
    })),
    daysAvailable: baselineValues.length + 1
  };
}

function createOptions(overrides?: Partial<EvaluatorOptions>): EvaluatorOptions {
  return {
    globalConfig: defaultGlobalConfig,
    clientConfig: defaultClientConfig,
    thresholds: defaultThresholds,
    ...overrides
  };
}

describe('calculateBaseline', () => {
  it('returns 0 for empty array', () => {
    expect(calculateBaseline([])).toBe(0);
  });

  it('calculates correct average', () => {
    expect(calculateBaseline([{ value: 100 }, { value: 200 }, { value: 300 }])).toBe(200);
  });

  it('handles single value', () => {
    expect(calculateBaseline([{ value: 50 }])).toBe(50);
  });
});

describe('calculateDeltaPct', () => {
  it('returns 0 when both values are 0', () => {
    expect(calculateDeltaPct(0, 0)).toBe(0);
  });

  it('returns 100 when baseline is 0 and actual > 0', () => {
    expect(calculateDeltaPct(50, 0)).toBe(100);
  });

  it('calculates positive percentage correctly', () => {
    expect(calculateDeltaPct(120, 100)).toBe(20);
  });

  it('calculates negative percentage correctly', () => {
    expect(calculateDeltaPct(80, 100)).toBe(-20);
  });

  it('handles exact match', () => {
    expect(calculateDeltaPct(100, 100)).toBe(0);
  });
});

describe('evaluateMetric', () => {
  describe('no anomaly cases', () => {
    it('returns no anomaly when within threshold', () => {
      const dataset = createDataset('sessions', 110, [100, 100, 100, 100, 100, 100, 100]);
      const result = evaluateMetric(dataset, createOptions());

      expect(result.severity).toBeNull();
      expect(result.reason).toBe('no_anomaly');
      expect(result.deltaPct).toBe(10);
    });

    it('returns no anomaly for small decrease', () => {
      const dataset = createDataset('sessions', 90, [100, 100, 100, 100, 100, 100, 100]);
      const result = evaluateMetric(dataset, createOptions());

      expect(result.severity).toBeNull();
      expect(result.reason).toBe('no_anomaly');
    });
  });

  describe('warning alerts', () => {
    it('triggers WARNING at 20% increase', () => {
      const dataset = createDataset('sessions', 120, [100, 100, 100, 100, 100, 100, 100]);
      const result = evaluateMetric(dataset, createOptions());

      expect(result.severity).toBe('WARNING');
      expect(result.reason).toBe('percentage_deviation');
      expect(result.direction).toBe('increase');
    });

    it('triggers WARNING at 25% decrease', () => {
      const dataset = createDataset('sessions', 75, [100, 100, 100, 100, 100, 100, 100]);
      const result = evaluateMetric(dataset, createOptions());

      expect(result.severity).toBe('WARNING');
      expect(result.direction).toBe('decrease');
    });
  });

  describe('critical alerts', () => {
    it('triggers CRITICAL at 40% decrease', () => {
      const dataset = createDataset('sessions', 60, [100, 100, 100, 100, 100, 100, 100]);
      const result = evaluateMetric(dataset, createOptions());

      expect(result.severity).toBe('CRITICAL');
      expect(result.reason).toBe('percentage_deviation');
    });

    it('triggers CRITICAL at 50% increase', () => {
      const dataset = createDataset('sessions', 150, [100, 100, 100, 100, 100, 100, 100]);
      const result = evaluateMetric(dataset, createOptions());

      expect(result.severity).toBe('CRITICAL');
    });
  });

  describe('zero value alerts', () => {
    it('triggers CRITICAL when sessions = 0 with positive baseline', () => {
      const dataset = createDataset('sessions', 0, [100, 100, 100, 100, 100, 100, 100]);
      const result = evaluateMetric(dataset, createOptions());

      expect(result.severity).toBe('CRITICAL');
      expect(result.reason).toBe('zero_value');
      expect(result.diagnosisHint).toContain('Geen sessies');
    });

    it('triggers CRITICAL when conversions = 0 with positive baseline', () => {
      const dataset = createDataset('conversions', 0, [50, 50, 50, 50, 50, 50, 50]);
      const result = evaluateMetric(dataset, createOptions());

      expect(result.severity).toBe('CRITICAL');
      expect(result.reason).toBe('zero_value');
    });

    it('triggers CRITICAL when purchaseRevenue = 0 with positive baseline', () => {
      const dataset = createDataset('purchaseRevenue', 0, [1000, 1000, 1000, 1000, 1000, 1000, 1000]);
      const result = evaluateMetric(dataset, createOptions());

      expect(result.severity).toBe('CRITICAL');
      expect(result.reason).toBe('zero_value');
    });

    it('does NOT trigger zero alert for engagementRate = 0', () => {
      const dataset = createDataset('engagementRate', 0, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
      const result = evaluateMetric(dataset, createOptions());

      // engagementRate is not in the zero-value critical list
      expect(result.reason).not.toBe('zero_value');
    });
  });

  describe('insufficient data', () => {
    it('returns insufficient_data when < minDaysForPercentageAlerts', () => {
      const dataset = createDataset('sessions', 60, [100]); // Only 1 baseline day + yesterday = 2 days < 3
      const result = evaluateMetric(dataset, createOptions());

      expect(result.severity).toBeNull();
      expect(result.reason).toBe('insufficient_data');
    });

    it('still triggers zero alerts with insufficient data', () => {
      const dataset = createDataset('sessions', 0, [100, 100]); // Only 2 baseline days
      const result = evaluateMetric(dataset, createOptions());

      // Zero alerts should still fire even with little data
      expect(result.severity).toBe('CRITICAL');
      expect(result.reason).toBe('zero_value');
    });
  });

  describe('minimum baseline guardrail', () => {
    it('skips alert when baseline < minBaseline', () => {
      const dataset = createDataset('sessions', 5, [10, 10, 10, 10, 10, 10, 10]); // baseline = 10 < 20
      const result = evaluateMetric(dataset, createOptions());

      expect(result.severity).toBeNull();
      expect(result.reason).toBe('below_minimum_baseline');
    });

    it('triggers alert when baseline >= minBaseline', () => {
      const dataset = createDataset('sessions', 12, [20, 20, 20, 20, 20, 20, 20]); // baseline = 20 >= 20
      const result = evaluateMetric(dataset, createOptions());

      expect(result.severity).toBe('CRITICAL'); // 40% decrease
    });
  });

  describe('custom thresholds', () => {
    it('respects custom warning threshold', () => {
      const dataset = createDataset('sessions', 115, [100, 100, 100, 100, 100, 100, 100]);
      const options = createOptions({
        thresholds: { warning: 10, critical: 30, minBaseline: 20 }
      });
      const result = evaluateMetric(dataset, options);

      expect(result.severity).toBe('WARNING'); // 15% > 10%
    });

    it('respects custom critical threshold', () => {
      const dataset = createDataset('sessions', 75, [100, 100, 100, 100, 100, 100, 100]);
      const options = createOptions({
        thresholds: { warning: 20, critical: 25, minBaseline: 20 }
      });
      const result = evaluateMetric(dataset, options);

      expect(result.severity).toBe('CRITICAL'); // 25% > 25% threshold
    });
  });

  describe('output format', () => {
    it('includes all required fields', () => {
      const dataset = createDataset('sessions', 60, [100, 100, 100, 100, 100, 100, 100]);
      const result = evaluateMetric(dataset, createOptions());

      expect(result.clientId).toBe('test-client');
      expect(result.clientName).toBe('Test Client');
      expect(result.metric).toBe('sessions');
      expect(result.date).toBe('2024-01-15');
      expect(result.baseline).toBe(100);
      expect(result.actual).toBe(60);
      expect(result.deltaPct).toBe(-40);
      expect(result.direction).toBe('decrease');
      expect(result.diagnosisHint).toBeTruthy();
      expect(result.checklistItems).toBeInstanceOf(Array);
      expect(result.checklistItems.length).toBeGreaterThan(0);
    });
  });
});
