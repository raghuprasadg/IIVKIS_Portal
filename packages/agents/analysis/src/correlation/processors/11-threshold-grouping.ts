/**
 * Processor 11 — ThresholdGroupingProcessor
 *
 * Groups signals that are all threshold-breach type (monitoring_alert with
 * severity >= high) on the same CI within a 5-minute window — classic "alert
 * storm" grouping.
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult, ProposedGroup } from '../types.js';

const STORM_WINDOW_MS = 5 * 60_000;
const HIGH_SEVERITIES = new Set(['critical', 'high']);

export class ThresholdGroupingProcessor implements CorrelationProcessorI {
  readonly name = 'threshold-grouping';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const proposedGroups: ProposedGroup[] = [];

    // Filter to monitoring_alert signals with high/critical severity
    const stormCandidates = ctx.signals.filter(
      s => s.signalType === 'monitoring_alert' && HIGH_SEVERITIES.has(s.severity),
    );

    // Bucket by CI
    const byCi = new Map<string, typeof stormCandidates>();
    for (const signal of stormCandidates) {
      const ci = signal.affectedCiId ?? '__none__';
      if (!byCi.has(ci)) byCi.set(ci, []);
      byCi.get(ci)!.push(signal);
    }

    for (const [ciId, signals] of byCi.entries()) {
      if (signals.length < 2) continue;

      const sorted = [...signals].sort(
        (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
      );

      let i = 0;
      while (i < sorted.length) {
        const anchorMs = new Date(sorted[i]!.occurredAt).getTime();
        const window = sorted.filter(s => {
          const ms = new Date(s.occurredAt).getTime();
          return ms >= anchorMs && ms - anchorMs <= STORM_WINDOW_MS;
        });

        if (window.length >= 2) {
          proposedGroups.push({
            signalIds: window.map(s => s.internalId),
            correlationMethod: this.name,
            baseConfidence: 45,
            rootCauseCiId: ciId === '__none__' ? undefined : ciId,
            narrative: `Alert storm: ${window.length} threshold-breach signals on CI '${ciId}' within ${STORM_WINDOW_MS / 60_000} min.`,
          });
          i += window.length;
        } else {
          i++;
        }
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
