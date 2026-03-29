/**
 * Processor 06 — FlapDetectionProcessor
 *
 * Detects flapping: a CI that oscillates between alert/clear more than 3 times
 * in a 15-minute window. Creates a "flap" correlation group and suppresses
 * individual signal notifications.
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult, ProposedGroup } from '../types.js';

const FLAP_WINDOW_MS = 15 * 60_000;
const FLAP_THRESHOLD = 3;

/** Simple heuristic: alternating severity between critical/high and info/low. */
function isAlertState(severity: string): boolean {
  return severity === 'critical' || severity === 'high';
}

function isClearState(severity: string): boolean {
  return severity === 'info' || severity === 'low';
}

export class FlapDetectionProcessor implements CorrelationProcessorI {
  readonly name = 'flap-detection';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const proposedGroups: ProposedGroup[] = [];
    const suppressedSignalIds: string[] = [];

    // Group by CI
    const byCi = new Map<string, typeof ctx.signals>();
    for (const signal of ctx.signals) {
      const ci = signal.affectedCiId;
      if (!ci) continue;
      if (!byCi.has(ci)) byCi.set(ci, []);
      byCi.get(ci)!.push(signal);
    }

    for (const [ciId, signals] of byCi.entries()) {
      if (signals.length < FLAP_THRESHOLD) continue;

      const sorted = [...signals].sort(
        (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
      );

      // Slide window
      for (let i = 0; i < sorted.length; i++) {
        const anchorMs = new Date(sorted[i]!.occurredAt).getTime();
        const window = sorted.filter(s => {
          const ms = new Date(s.occurredAt).getTime();
          return ms >= anchorMs && ms - anchorMs <= FLAP_WINDOW_MS;
        });

        if (window.length < FLAP_THRESHOLD) continue;

        // Count oscillations: alert → clear or clear → alert transitions
        let transitions = 0;
        let prevState: 'alert' | 'clear' | 'unknown' = 'unknown';
        for (const s of window) {
          const cur = isAlertState(s.severity) ? 'alert' : isClearState(s.severity) ? 'clear' : 'unknown';
          if (cur !== 'unknown' && cur !== prevState && prevState !== 'unknown') {
            transitions++;
          }
          if (cur !== 'unknown') prevState = cur;
        }

        if (transitions >= FLAP_THRESHOLD) {
          proposedGroups.push({
            signalIds: window.map(s => s.internalId),
            correlationMethod: this.name,
            baseConfidence: 60,
            rootCauseCiId: ciId,
            narrative: `CI '${ciId}' flapped ${transitions} times within ${FLAP_WINDOW_MS / 60_000} min window.`,
          });
          window.forEach(s => suppressedSignalIds.push(s.internalId));
          break; // one flap group per CI per run
        }
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
