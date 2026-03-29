/**
 * Processor 15 — CrossServiceProcessor
 *
 * Groups signals from different source systems (e.g., Zabbix + ServiceNow +
 * PagerDuty) that reference the same CI or the same vendor advisory
 * (rawPayload.vendorAdvisoryId).
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult, ProposedGroup } from '../types.js';

export class CrossServiceProcessor implements CorrelationProcessorI {
  readonly name = 'cross-service';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const proposedGroups: ProposedGroup[] = [];

    // --- Group by affectedCiId across different source systems ---
    const byCi = new Map<string, typeof ctx.signals>();
    for (const signal of ctx.signals) {
      if (!signal.affectedCiId) continue;
      if (!byCi.has(signal.affectedCiId)) byCi.set(signal.affectedCiId, []);
      byCi.get(signal.affectedCiId)!.push(signal);
    }

    for (const [ciId, signals] of byCi.entries()) {
      const sources = new Set(signals.map(s => s.sourceSystem));
      if (sources.size < 2) continue; // only one source system — not cross-service

      proposedGroups.push({
        signalIds: signals.map(s => s.internalId),
        correlationMethod: this.name,
        baseConfidence: 35,
        rootCauseCiId: ciId,
        narrative: `Cross-service correlation: CI '${ciId}' has signals from ${sources.size} source systems: ${[...sources].join(', ')}.`,
      });
    }

    // --- Group by vendor advisory ID across different source systems ---
    const byAdvisory = new Map<string, typeof ctx.signals>();
    for (const signal of ctx.signals) {
      const advisoryId = signal.rawPayload?.['vendorAdvisoryId'];
      if (typeof advisoryId !== 'string') continue;
      if (!byAdvisory.has(advisoryId)) byAdvisory.set(advisoryId, []);
      byAdvisory.get(advisoryId)!.push(signal);
    }

    for (const [advisoryId, signals] of byAdvisory.entries()) {
      const sources = new Set(signals.map(s => s.sourceSystem));
      if (sources.size < 2) continue;

      proposedGroups.push({
        signalIds: signals.map(s => s.internalId),
        correlationMethod: `${this.name}:advisory`,
        baseConfidence: 40,
        rootCauseCiId: signals[0]!.affectedCiId,
        narrative: `Cross-service vendor advisory '${advisoryId}' referenced by ${sources.size} source systems: ${[...sources].join(', ')}.`,
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
