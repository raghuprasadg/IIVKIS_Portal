/**
 * Processor 07 — MaintenanceWindowProcessor
 *
 * Suppresses signals from CIs currently inside a maintenance window where
 * suppressAlerts is true. A maintenance window with no ciId suppresses all CIs.
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult } from '../types.js';

export class MaintenanceWindowProcessor implements CorrelationProcessorI {
  readonly name = 'maintenance-window';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const suppressedSignalIds: string[] = [];
    const nowMs = ctx.now.getTime();

    const activeWindows = ctx.maintenanceWindows.filter(
      mw =>
        mw.suppressAlerts &&
        mw.startsAt.getTime() <= nowMs &&
        mw.endsAt.getTime() >= nowMs,
    );

    if (activeWindows.length === 0) {
      return {
        processorName: this.name,
        proposedGroups: [],
        suppressedSignalIds: [],
        confidenceAdjustments: new Map(),
      };
    }

    for (const signal of ctx.signals) {
      const suppressed = activeWindows.some(
        mw => mw.ciId === undefined || mw.ciId === signal.affectedCiId,
      );
      if (suppressed) {
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
