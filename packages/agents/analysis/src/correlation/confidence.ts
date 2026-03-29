/**
 * Confidence scoring pure functions — LLD §6 formula.
 *
 * confidence = base_confidence
 *            + temporal_score   (0–25)
 *            + topological_score (0–30)
 *            + semantic_score   (0–25)
 *            + rule_score       (0–20)
 *            clamped to [0, 100]
 */

/** Returns 0–25 based on the span between earliest and latest signal timestamps. */
export function temporalScore(earliestMs: number, latestMs: number): number {
  const spanMs = latestMs - earliestMs;
  if (spanMs <= 60_000) return 25;          // within 1 minute
  if (spanMs <= 5 * 60_000) return 10;      // within 5 minutes
  return 0;
}

/** Returns 0–30 based on minimum hop distance between correlated CIs. */
export function topologicalScore(minHops: number): number {
  if (minHops <= 0) return 30;              // direct parent CI
  if (minHops === 1) return 30;
  if (minHops === 2) return 15;
  if (minHops === 3) return 5;
  return 0;
}

/** Returns 0–25 based on maximum cosine similarity among signal embeddings. */
export function semanticScore(maxCosineSim: number): number {
  if (maxCosineSim > 0.9) return 25;
  if (maxCosineSim > 0.7) return 15;
  return 0;
}

/** Aggregates all component scores and clamps result to [0, 100]. */
export function aggregateConfidence(
  base: number,
  temporal: number,
  topological: number,
  semantic: number,
  rule: number,
): number {
  return Math.min(100, Math.max(0, base + temporal + topological + semantic + rule));
}
