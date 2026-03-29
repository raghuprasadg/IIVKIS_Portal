/**
 * LLM response validation (LLD §7.1).
 */

import type { LLMCompletionResponse } from '@iivkis/shared';
import type { ValidationResult } from './types';

/** Phrases that commonly indicate LLM hallucination or refusal. */
const HALLUCINATION_MARKERS = [
  'as an ai language model',
  'i cannot provide',
  'i am unable to',
  'i don\'t have access to real-time',
  'my knowledge cutoff',
];

export function validateCompletion(
  response: LLMCompletionResponse,
  context: { maxTokens?: number },
): ValidationResult {
  const issues: string[] = [];

  if (!response.content || response.content.trim().length === 0) {
    issues.push('Response content is empty.');
  }

  const totalTokens = response.tokensPrompt + response.tokensCompletion;
  if (context.maxTokens !== undefined && totalTokens > context.maxTokens) {
    issues.push(
      `Token usage ${totalTokens} exceeds limit ${context.maxTokens}.`,
    );
  }

  const lower = response.content.toLowerCase();
  for (const marker of HALLUCINATION_MARKERS) {
    if (lower.includes(marker)) {
      issues.push(`Possible hallucination marker detected: "${marker}".`);
      break;
    }
  }

  return { valid: issues.length === 0, issues };
}
