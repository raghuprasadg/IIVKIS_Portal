/**
 * Processor 14 — SLABreachPredictionProcessor
 *
 * Examines signals that are linked to incidents (signalType === 'incident').
 * If the incident's SLA resolution deadline (rawPayload.slaDeadlineAt as ISO
 * string) is within 30 minutes and there is no CONFIRMED resolution group for
 * that CI, emits a predicted SLA breach signal (as a special proposed group).
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult, ProposedGroup } from '../types.js';

const SLA_WARNING_WINDOW_MS = 30 * 60_000;

export class SLABreachPredictionProcessor implements CorrelationProcessorI {
  readonly name = 'sla-breach-prediction';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const proposedGroups: ProposedGroup[] = [];
    const nowMs = ctx.now.getTime();

    // Resolved CI IDs from confirmed groups
    const resolvedCiIds = new Set<string>(
      ctx.existingGroups
        .filter(g => g.status === 'confirmed' && g.resolvedAt)
        .map(g => g.rootCauseCiId)
        .filter((id): id is string => id !== undefined),
    );

    const incidentSignals = ctx.signals.filter(s => s.signalType === 'incident');

    for (const signal of incidentSignals) {
      const deadline = signal.rawPayload?.['slaDeadlineAt'];
      if (typeof deadline !== 'string') continue;

      const deadlineMs = new Date(deadline).getTime();
      const timeToBreachMs = deadlineMs - nowMs;

      if (timeToBreachMs <= 0 || timeToBreachMs > SLA_WARNING_WINDOW_MS) continue;
      if (signal.affectedCiId && resolvedCiIds.has(signal.affectedCiId)) continue;

      const minutesRemaining = Math.round(timeToBreachMs / 60_000);

      proposedGroups.push({
        signalIds: [signal.internalId],
        correlationMethod: this.name,
        baseConfidence: 70,
        rootCauseCiId: signal.affectedCiId,
        narrative: `Predicted SLA breach for incident '${signal.title}' on CI '${signal.affectedCiId ?? 'unknown'}'. SLA deadline in ~${minutesRemaining} min.`,
      });
    }

    return {
      processorName: this.name,
      proposedGroups,
      suppressedSignalIds: [],
      confidenceAdjustments: new Map(),
    };
  }
}
