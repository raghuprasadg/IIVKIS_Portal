/**
 * Task complexity classifier (LLD §7.1 step 4).
 *
 * Uses a two-pass approach:
 *  1. Keyword override — high-confidence signal words trump token count.
 *  2. Token estimate   — total chars / 4, bucketed into simple/moderate/complex.
 */

import type { LLMMessage } from '@iivkis/shared';
import type { TaskComplexity } from './types';

/* ── keyword tables ───────────────────────────────────────────────────────── */

const SIMPLE_KEYWORDS = [
  'what is', 'what are', 'define', 'explain', 'summarise', 'summarize',
  'describe', 'list', 'show me', 'tell me',
];

const MODERATE_KEYWORDS = [
  'compare', 'contrast', 'analyse', 'analyze', 'troubleshoot',
  'difference between', 'how does', 'why does', 'steps to',
];

const COMPLEX_KEYWORDS = [
  'generate plan', 'root cause', 'correlate', 'design', 'architect',
  'optimise', 'optimize', 'refactor', 'multi-step', 'end-to-end',
  'investigate', 'deep dive',
];

/* ── helpers ──────────────────────────────────────────────────────────────── */

function estimateTokens(messages: LLMMessage[]): number {
  return Math.ceil(
    messages.reduce((sum, m) => sum + m.content.length, 0) / 4,
  );
}

function matchesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/* ── public API ───────────────────────────────────────────────────────────── */

export function classify(messages: LLMMessage[]): TaskComplexity {
  const combinedText = messages.map((m) => m.content).join(' ');

  // Keyword override — most specific wins
  if (matchesAny(combinedText, COMPLEX_KEYWORDS)) return 'complex';
  if (matchesAny(combinedText, MODERATE_KEYWORDS)) return 'moderate';
  if (matchesAny(combinedText, SIMPLE_KEYWORDS)) return 'simple';

  // Token-based fallback
  const tokens = estimateTokens(messages);
  if (tokens < 100) return 'simple';
  if (tokens < 500) return 'moderate';
  return 'complex';
}
