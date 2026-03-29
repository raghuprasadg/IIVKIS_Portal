/**
 * Processor 09 — RootCauseIsolationProcessor
 *
 * Among all proposed groups (from existingGroups and the current run),
 * identifies the CI with the highest-confidence signal at the lowest topology
 * depth as the root cause. Emits confidence adjustments for groups whose
 * rootCauseCiId matches.
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult } from '../types.js';

export class RootCauseIsolationProcessor implements CorrelationProcessorI {
  readonly name = 'root-cause-isolation';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const confidenceAdjustments = new Map<string, number>();

    if (ctx.signals.length === 0) {
      return {
        processorName: this.name,
        proposedGroups: [],
        suppressedSignalIds: [],
        confidenceAdjustments,
      };
    }

    // Find the signal at the minimum topologyDepth (closest to root)
    const candidateSignals = ctx.signals.filter(s => s.topologyDepth !== undefined);
    if (candidateSignals.length === 0) {
      return {
        processorName: this.name,
        proposedGroups: [],
        suppressedSignalIds: [],
        confidenceAdjustments,
      };
    }

    const rootSignal = candidateSignals.reduce((best, s) =>
      (s.topologyDepth ?? 999) < (best.topologyDepth ?? 999) ? s : best,
    );
    const rootCiId = rootSignal.affectedCiId;

    // Apply a positive confidence boost to existing groups that identify this CI as root cause
    for (const group of ctx.existingGroups) {
      if (group.rootCauseCiId === rootCiId) {
        confidenceAdjustments.set(group.id, 10);
      }
    }

    return {
      processorName: this.name,
      proposedGroups: [],
      suppressedSignalIds: [],
      confidenceAdjustments,
    };
  }
}
