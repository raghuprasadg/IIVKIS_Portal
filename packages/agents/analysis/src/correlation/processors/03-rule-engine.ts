/**
 * Processor 03 — RuleEngineProcessor
 *
 * Evaluates tenant correlation rules (CorrelationRuleDsl).
 * Matches signals against `match` criteria, groups by topology/time window,
 * checks require_signals.min, and returns groups with rule confidence scores.
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult, ProposedGroup } from '../types.js';
import type { CorrelationRuleDsl } from '@iivkis/shared';
import type { EnrichedSignal } from '../types.js';

/** Shallow match: every key-value pair in criteria must exist on signal. */
function matchesRule(signal: EnrichedSignal, criteria: Record<string, unknown>): boolean {
  const signalRecord = signal as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(criteria)) {
    if (signalRecord[key] !== value) return false;
  }
  return true;
}

function ruleScore(rule: CorrelationRuleDsl): number {
  // Clamp rule score to 0–20 per LLD formula
  return Math.min(20, Math.max(0, rule.output.confidence_base));
}

export class RuleEngineProcessor implements CorrelationProcessorI {
  readonly name = 'rule-engine';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const proposedGroups: ProposedGroup[] = [];

    for (const rule of ctx.rules) {
      const windowMs = rule.group_by.time_window_minutes * 60_000;

      // Filter matching signals
      const matched = ctx.signals.filter(s => matchesRule(s, rule.match));
      if (matched.length < rule.require_signals.min) continue;

      // Sort by time
      const sorted = [...matched].sort(
        (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
      );

      // Slide time window
      let i = 0;
      while (i < sorted.length) {
        const anchor = sorted[i]!;
        const anchorMs = new Date(anchor.occurredAt).getTime();
        const windowSignals: typeof sorted = [anchor];

        for (let j = i + 1; j < sorted.length; j++) {
          const s = sorted[j]!;
          if (new Date(s.occurredAt).getTime() - anchorMs <= windowMs) {
            windowSignals.push(s);
          }
        }

        if (windowSignals.length >= rule.require_signals.min) {
          const baseConf = Math.min(
            rule.output.max_confidence,
            rule.output.confidence_base +
              (windowSignals.length - rule.require_signals.min) *
                rule.output.confidence_boost_per_additional_signal,
          );

          // Topology grouping: pick CI with lowest topologyDepth as root
          const rootCiSignal = windowSignals.reduce((best, s) =>
            (s.topologyDepth ?? 999) < (best.topologyDepth ?? 999) ? s : best,
          );

          proposedGroups.push({
            signalIds: windowSignals.map(s => s.internalId),
            correlationMethod: `${this.name}:${rule.name}`,
            baseConfidence: baseConf,
            rootCauseCiId: rootCiSignal.affectedCiId,
            narrative: `Rule '${rule.name}' matched ${windowSignals.length} signals within ${rule.group_by.time_window_minutes} min. Rule score: ${ruleScore(rule)}.`,
          });
        }

        i += windowSignals.length > 1 ? windowSignals.length : 1;
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
