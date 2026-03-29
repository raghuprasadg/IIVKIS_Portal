/**
 * Processor 16 — ConfidenceAggregationProcessor
 *
 * Final step: for each proposed group, aggregates all component confidence
 * scores (temporal + topological + semantic + rule) using the LLD formula,
 * clamps to [0, 100], and finalises the group confidence.
 *
 * This processor does not produce new ProposedGroups. It emits
 * confidenceAdjustments for every proposed group tracked in existingGroups.
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult } from '../types.js';
import { temporalScore, topologicalScore, semanticScore, aggregateConfidence } from '../confidence.js';
import type { EnrichedSignal } from '../types.js';

function computeTemporalScore(signals: EnrichedSignal[]): number {
  if (signals.length < 2) return 0;
  const times = signals.map(s => new Date(s.occurredAt).getTime());
  return temporalScore(Math.min(...times), Math.max(...times));
}

function computeTopologicalScore(signals: EnrichedSignal[]): number {
  const depths = signals.map(s => s.topologyDepth).filter((d): d is number => d !== undefined);
  if (depths.length === 0) return 0;
  return topologicalScore(Math.min(...depths));
}

function computeSemanticScore(signals: EnrichedSignal[]): number {
  // If embeddings are present, find the max pairwise cosine similarity
  const withEmbeddings = signals.filter(s => s.embedding && s.embedding.length > 0);
  if (withEmbeddings.length < 2) return 0;

  let maxSim = 0;
  for (let i = 0; i < withEmbeddings.length; i++) {
    for (let j = i + 1; j < withEmbeddings.length; j++) {
      const a = withEmbeddings[i]!.embedding!;
      const b = withEmbeddings[j]!.embedding!;
      let dot = 0, normA = 0, normB = 0;
      for (let k = 0; k < a.length; k++) {
        dot += a[k]! * b[k]!;
        normA += a[k]! * a[k]!;
        normB += b[k]! * b[k]!;
      }
      const denom = Math.sqrt(normA) * Math.sqrt(normB);
      const sim = denom === 0 ? 0 : dot / denom;
      if (sim > maxSim) maxSim = sim;
    }
  }
  return semanticScore(maxSim);
}

export class ConfidenceAggregationProcessor implements CorrelationProcessorI {
  readonly name = 'confidence-aggregation';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const confidenceAdjustments = new Map<string, number>();

    // Build a lookup for signals by internalId
    const signalIndex = new Map(ctx.signals.map(s => [s.internalId, s]));

    for (const group of ctx.existingGroups) {
      // We don't have signalIds on CorrelationGroup from @iivkis/shared, so we
      // match signals by rootCauseCiId to approximate the group's signal set.
      const groupSignals = ctx.signals.filter(
        s => group.rootCauseCiId && s.affectedCiId === group.rootCauseCiId,
      );

      // Fall back to all signals if no CI match
      const effectiveSignals = groupSignals.length > 0 ? groupSignals : ctx.signals;

      void signalIndex; // available for future richer matching

      const tScore = computeTemporalScore(effectiveSignals);
      const topoScore = computeTopologicalScore(effectiveSignals);
      const semScore = computeSemanticScore(effectiveSignals);

      // rule score derived from correlationMethods that reference rule-engine
      const ruleScore = group.correlationMethods.some(m => m.startsWith('rule-engine')) ? 15 : 0;

      const finalConfidence = aggregateConfidence(
        group.confidence,
        tScore,
        topoScore,
        semScore,
        ruleScore,
      );

      const delta = finalConfidence - group.confidence;
      if (delta !== 0) {
        confidenceAdjustments.set(group.id, delta);
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
