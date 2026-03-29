/**
 * Processor 08 — BlastRadiusProcessor
 *
 * When a critical/high-severity signal arrives on a "core" CI (topologyDepth 0
 * or 1), identifies all downstream CIs (higher topologyDepth) and groups their
 * related signals, adding blast-radius context to the narrative.
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult, ProposedGroup } from '../types.js';

const BLAST_TRIGGER_DEPTHS = new Set([0, 1]);
const BLAST_SEVERITIES = new Set(['critical', 'high']);

export class BlastRadiusProcessor implements CorrelationProcessorI {
  readonly name = 'blast-radius';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const proposedGroups: ProposedGroup[] = [];

    // Find "core" signals that trigger blast-radius analysis
    const coreSignals = ctx.signals.filter(
      s =>
        BLAST_SEVERITIES.has(s.severity) &&
        BLAST_TRIGGER_DEPTHS.has(s.topologyDepth ?? 999),
    );

    for (const core of coreSignals) {
      const coreDepth = core.topologyDepth ?? 0;

      // Downstream signals: same source system, greater topology depth
      const downstream = ctx.signals.filter(
        s =>
          s.internalId !== core.internalId &&
          (s.topologyDepth ?? 0) > coreDepth,
      );

      if (downstream.length === 0) continue;

      const allIds = [core.internalId, ...downstream.map(s => s.internalId)];
      const downstreamCis = [...new Set(downstream.map(s => s.affectedCiId).filter(Boolean))];

      proposedGroups.push({
        signalIds: allIds,
        correlationMethod: this.name,
        baseConfidence: 50,
        rootCauseCiId: core.affectedCiId,
        narrative: `Blast radius from core CI '${core.affectedCiId}' (depth ${coreDepth}, severity ${core.severity}). Downstream CIs affected: ${downstreamCis.join(', ')}.`,
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
