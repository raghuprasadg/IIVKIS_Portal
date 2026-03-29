/**
 * Processor 01 — TimeWindowProcessor
 *
 * Groups signals occurring within a configurable time window (default 10 min)
 * from the same source system / CI.
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult, ProposedGroup } from '../types.js';
import { temporalScore } from '../confidence.js';

const DEFAULT_WINDOW_MS = 10 * 60_000;

export class TimeWindowProcessor implements CorrelationProcessorI {
  readonly name = 'time-window';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const proposedGroups: ProposedGroup[] = [];
    const suppressedSignalIds: string[] = [];

    // Bucket by sourceSystem + affectedCiId
    const buckets = new Map<string, typeof ctx.signals>();
    for (const signal of ctx.signals) {
      const key = `${signal.sourceSystem}::${signal.affectedCiId ?? '__none__'}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(signal);
    }

    const nowMs = ctx.now.getTime();

    for (const signals of buckets.values()) {
      if (signals.length < 2) continue;

      // Sort by occurredAt ascending
      const sorted = [...signals].sort(
        (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
      );

      // Slide a window of DEFAULT_WINDOW_MS
      let windowStart = 0;
      while (windowStart < sorted.length) {
        const anchor = sorted[windowStart]!;
        const anchorMs = new Date(anchor.occurredAt).getTime();
        const group: typeof sorted = [anchor];

        for (let i = windowStart + 1; i < sorted.length; i++) {
          const candidate = sorted[i]!;
          const candidateMs = new Date(candidate.occurredAt).getTime();
          if (candidateMs - anchorMs <= DEFAULT_WINDOW_MS) {
            group.push(candidate);
          }
        }

        if (group.length >= 2) {
          const earliest = new Date(group[0]!.occurredAt).getTime();
          const latest = new Date(group[group.length - 1]!.occurredAt).getTime();
          const tScore = temporalScore(earliest, latest);
          const elapsed = nowMs - earliest;
          void elapsed; // context available for future narrative enrichment

          proposedGroups.push({
            signalIds: group.map(s => s.internalId),
            correlationMethod: this.name,
            baseConfidence: 30,
            rootCauseCiId: group[0]!.affectedCiId,
            narrative: `${group.length} signals from '${group[0]!.sourceSystem}' within ${DEFAULT_WINDOW_MS / 60_000} min window. Temporal score: ${tScore}.`,
          });
        }

        // Advance past signals already covered by first window group
        windowStart += group.length > 1 ? group.length : 1;
      }
    }

    return {
      processorName: this.name,
      proposedGroups,
      suppressedSignalIds,
      confidenceAdjustments: new Map(),
    };
  }
}
