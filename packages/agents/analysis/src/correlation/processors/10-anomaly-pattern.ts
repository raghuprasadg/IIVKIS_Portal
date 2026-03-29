/**
 * Processor 10 — AnomalyPatternProcessor
 *
 * Statistical outlier detection: signals whose numeric value (from rawPayload.value)
 * lies beyond 3 standard deviations from the rolling 1-hour mean for that metric
 * (keyed by sourceSystem + affectedCiId + metric name) are flagged as anomalies
 * and grouped.
 *
 * In this processor the "rolling mean/stddev" is computed from the current signal
 * batch itself (no external state). The API layer is responsible for pre-seeding
 * rawPayload with historical stats if available.
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult, ProposedGroup } from '../types.js';

const ONE_HOUR_MS = 60 * 60_000;
const Z_THRESHOLD = 3;

function extractNumericValue(signal: { rawPayload?: Record<string, unknown> }): number | undefined {
  const val = signal.rawPayload?.['value'];
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

function extractMetricName(signal: { rawPayload?: Record<string, unknown> }): string {
  const m = signal.rawPayload?.['metric'];
  return typeof m === 'string' ? m : '__default__';
}

export class AnomalyPatternProcessor implements CorrelationProcessorI {
  readonly name = 'anomaly-pattern';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const proposedGroups: ProposedGroup[] = [];
    const nowMs = ctx.now.getTime();

    // Only consider signals within last 1 hour
    const recent = ctx.signals.filter(
      s => nowMs - new Date(s.occurredAt).getTime() <= ONE_HOUR_MS,
    );

    // Bucket by metric key
    const metricBuckets = new Map<string, typeof recent>();
    for (const signal of recent) {
      const value = extractNumericValue(signal);
      if (value === undefined) continue;
      const key = `${signal.sourceSystem}::${signal.affectedCiId ?? '__none__'}::${extractMetricName(signal)}`;
      if (!metricBuckets.has(key)) metricBuckets.set(key, []);
      metricBuckets.get(key)!.push(signal);
    }

    for (const [key, signals] of metricBuckets.entries()) {
      if (signals.length < 3) continue; // need at least 3 data points for meaningful stats

      const values = signals.map(s => extractNumericValue(s)!);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
      const stddev = Math.sqrt(variance);

      if (stddev === 0) continue; // all identical values — no anomaly

      const outliers = signals.filter(s => {
        const v = extractNumericValue(s)!;
        return Math.abs(v - mean) > Z_THRESHOLD * stddev;
      });

      if (outliers.length > 0) {
        proposedGroups.push({
          signalIds: outliers.map(s => s.internalId),
          correlationMethod: this.name,
          baseConfidence: 55,
          rootCauseCiId: outliers[0]!.affectedCiId,
          narrative: `Anomaly detected on metric '${key}': ${outliers.length} outlier(s) beyond ${Z_THRESHOLD}σ (mean=${mean.toFixed(2)}, σ=${stddev.toFixed(2)}).`,
        });
      }
    }

    return {
      processorName: this.name,
      proposedGroups,
      suppressedSignalIds: [],
      confidenceAdjustments: new Map(),
    };
  }
}
