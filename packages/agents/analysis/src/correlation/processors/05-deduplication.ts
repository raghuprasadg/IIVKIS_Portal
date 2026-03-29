/**
 * Processor 05 — DeduplicationProcessor
 *
 * Detects duplicate signals: same fingerprint OR near-identical title+CI within
 * 1 minute. Suppresses the duplicate, keeping the earliest signal.
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult } from '../types.js';

const DEDUP_WINDOW_MS = 60_000;

export class DeduplicationProcessor implements CorrelationProcessorI {
  readonly name = 'deduplication';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const suppressedSignalIds: string[] = [];

    // Sort by occurredAt ascending so we keep the earliest
    const sorted = [...ctx.signals].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );

    // Track seen fingerprints and seen title+CI keys with timestamp
    const seenFingerprints = new Map<string, number>(); // fingerprint → earliestMs
    const seenTitleCi = new Map<string, number>();       // titleCiKey → earliestMs

    for (const signal of sorted) {
      const signalMs = new Date(signal.occurredAt).getTime();

      // Fingerprint dedup
      const prevFpMs = seenFingerprints.get(signal.fingerprint);
      if (prevFpMs !== undefined && signalMs - prevFpMs < DEDUP_WINDOW_MS) {
        suppressedSignalIds.push(signal.internalId);
        continue;
      }

      // Title + CI near-identical dedup
      const titleCiKey = `${signal.title.toLowerCase().trim()}::${signal.affectedCiId ?? '__none__'}`;
      const prevTcMs = seenTitleCi.get(titleCiKey);
      if (prevTcMs !== undefined && signalMs - prevTcMs < DEDUP_WINDOW_MS) {
        suppressedSignalIds.push(signal.internalId);
        continue;
      }

      seenFingerprints.set(signal.fingerprint, signalMs);
      seenTitleCi.set(titleCiKey, signalMs);
    }

    return {
      processorName: this.name,
      proposedGroups: [],
      suppressedSignalIds,
      confidenceAdjustments: new Map(),
    };
  }
}
