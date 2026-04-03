import type { CorrelatedGroupWithEvidence, RCAResult } from '@iivkis/shared';

/**
 * RCA service that derives root cause, impact radius, confidence and reasoning
 * from correlated groups and signal evidence.
 */
export class RCAEngine {
  derive(groups: CorrelatedGroupWithEvidence[]): RCAResult {
    if (groups.length === 0) {
      return {
        root_cause: 'unknown',
        impacted_services: [],
        confidence: 0,
        reasoning: 'No correlated groups were produced for the provided signals.',
      };
    }

    const best = [...groups].sort((a, b) => (b.confidence - a.confidence))[0]!;
    const impacted = new Set<string>();

    for (const signal of best.signals) {
      if (signal.affectedCiId) impacted.add(signal.affectedCiId);
    }

    const methodText = best.correlationMethods.length > 0
      ? best.correlationMethods.join(', ')
      : 'temporal and topology heuristics';

    const narrativeText = best.evidenceNarratives.length > 0
      ? best.evidenceNarratives.slice(0, 3).join(' | ')
      : (best.rootCauseNarrative ?? 'Root-cause inferred from highest confidence group.');

    return {
      root_cause: best.rootCauseCiId ?? 'unknown',
      impacted_services: Array.from(impacted),
      confidence: Math.round(best.confidence),
      reasoning: `Selected group ${best.id} using ${methodText}. Evidence: ${narrativeText}`,
    };
  }
}
