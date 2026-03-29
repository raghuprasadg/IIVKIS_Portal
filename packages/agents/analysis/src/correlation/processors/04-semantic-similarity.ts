/**
 * Processor 04 — SemanticSimilarityProcessor
 *
 * Groups signals whose pre-computed embeddings have cosine similarity > 0.7.
 * Assigns semantic score based on max cosine similarity in the group.
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult, ProposedGroup } from '../types.js';
import { semanticScore } from '../confidence.js';

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

const SIMILARITY_THRESHOLD = 0.7;

export class SemanticSimilarityProcessor implements CorrelationProcessorI {
  readonly name = 'semantic-similarity';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const proposedGroups: ProposedGroup[] = [];

    // Only process signals that have embeddings
    const withEmbeddings = ctx.signals.filter(s => s.embedding && s.embedding.length > 0);
    if (withEmbeddings.length < 2) {
      return { processorName: this.name, proposedGroups, suppressedSignalIds: [], confidenceAdjustments: new Map() };
    }

    const grouped = new Set<string>();

    for (let i = 0; i < withEmbeddings.length; i++) {
      const base = withEmbeddings[i]!;
      if (grouped.has(base.internalId)) continue;

      const group = [base];
      let maxSim = 0;

      for (let j = i + 1; j < withEmbeddings.length; j++) {
        const candidate = withEmbeddings[j]!;
        if (grouped.has(candidate.internalId)) continue;

        const sim = cosineSimilarity(base.embedding!, candidate.embedding!);
        if (sim > SIMILARITY_THRESHOLD) {
          group.push(candidate);
          if (sim > maxSim) maxSim = sim;
        }
      }

      if (group.length >= 2) {
        group.forEach(s => grouped.add(s.internalId));
        const sScore = semanticScore(maxSim);
        proposedGroups.push({
          signalIds: group.map(s => s.internalId),
          correlationMethod: this.name,
          baseConfidence: 25,
          rootCauseCiId: group[0]!.affectedCiId,
          narrative: `${group.length} signals grouped by semantic similarity (max cosine: ${maxSim.toFixed(3)}). Semantic score: ${sScore}.`,
        });
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
