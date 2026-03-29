/**
 * Processor 13 — SuppressionProcessor
 *
 * Applies suppression rules: if a CONFIRMED parent group already exists for the
 * same CI cluster, suppress newly-arriving signals that would form duplicate
 * groups with those same CIs.
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult } from '../types.js';

export class SuppressionProcessor implements CorrelationProcessorI {
  readonly name = 'suppression';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const suppressedSignalIds: string[] = [];

    // Collect CI IDs covered by confirmed groups (via rootCauseCiId)
    const confirmedCiIds = new Set<string>();
    for (const group of ctx.existingGroups) {
      if (group.status === 'confirmed' && group.rootCauseCiId) {
        confirmedCiIds.add(group.rootCauseCiId);
      }
    }

    if (confirmedCiIds.size === 0) {
      return {
        processorName: this.name,
        proposedGroups: [],
        suppressedSignalIds: [],
        confidenceAdjustments: new Map(),
      };
    }

    // Suppress signals whose CI is already covered by a confirmed group
    for (const signal of ctx.signals) {
      if (signal.affectedCiId && confirmedCiIds.has(signal.affectedCiId)) {
        suppressedSignalIds.push(signal.internalId);
      }
    }

    return {
      processorName: this.name,
      proposedGroups: [],
      suppressedSignalIds,
      confidenceAdjustments: new Map(),
    };
  }
}
