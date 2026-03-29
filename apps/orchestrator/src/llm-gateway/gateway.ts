/**
 * LLM Gateway — main class implementing the 9-step pipeline (LLD §7.1).
 *
 * When LLM_API_KEY is not set the gateway runs in MOCK_MODE:
 * all dispatch calls return a canned response rather than hitting a provider.
 */

import { createHash } from 'crypto';
import type {
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMMessage,
  EmbeddingRequest,
  EmbeddingResponse,
} from '@iivkis/shared';
import { CircuitBreaker } from './circuit-breaker';
import { containsPii, redact } from './pii-redactor';
import { classify } from './complexity-classifier';
import type { LLMGatewayConfig, CacheEntry, TaskComplexity } from './types';

/* ── injection patterns (guardrails) ─────────────────────────────────────── */

const INJECTION_PATTERNS = [
  /ignore (all )?previous instructions/i,
  /disregard (your|all) (prior |previous )?instructions/i,
  /you are now (a|an) /i,
  /jailbreak/i,
  /act as (if you are|a) /i,
];

/* ── in-memory budget counters (Redis fallback) ───────────────────────────── */

interface BudgetEntry {
  tokens: number;
  windowStart: number; // Unix ms of the day window start
}

const DAY_MS = 86_400_000;

export class LLMGateway {
  private readonly mockMode: boolean;
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();
  private readonly budgetCounters = new Map<string, BudgetEntry>();
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly config: LLMGatewayConfig) {
    this.mockMode = !process.env['LLM_API_KEY'];
  }

  /* ── public API ──────────────────────────────────────────────────────────── */

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const start = Date.now();
    const estimatedTokens = this.estimateTokens(req.messages);

    // 1. Budget check
    await this.checkBudget(req.tenantId, estimatedTokens);

    // 2. Guardrails — input scan
    this.scanGuardrails(req.messages);

    // 3. Semantic cache lookup
    const cached = await this.lookupCache(req.tenantId, req.messages);
    if (cached) return cached;

    // 4. Model-tier routing
    const complexity: TaskComplexity = classify(req.messages);
    const model = this.routeModel(complexity, req.tenantId);

    // 5. Provider dispatch (with circuit breaker)
    let response: LLMCompletionResponse;
    try {
      response = await this.dispatch(model, req);
    } catch {
      response = await this.dispatchFallback(req, start);
    }

    // 7. PII redaction before audit log
    const { redacted: redactedContent } = redact(response.content);
    const auditResponse = { ...response, content: redactedContent };
    this.emitAuditLog(req, auditResponse);

    // 8. Cache write
    if (req.cacheable) {
      await this.writeCache(req.tenantId, req.messages, response);
    }

    // 9. Token metering
    const totalTokens = response.tokensPrompt + response.tokensCompletion;
    await this.meterUsage(req.tenantId, totalTokens);

    return { ...response, latencyMs: Date.now() - start };
  }

  async embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (this.mockMode) {
      return {
        taskId: req.taskId,
        embeddings: req.texts.map(() => Array.from({ length: 1536 }, () => Math.random() * 2 - 1)),
        model: req.model ?? 'mock-embedding-model',
        tokensUsed: req.texts.reduce((s, t) => s + Math.ceil(t.length / 4), 0),
      };
    }

    // Real embedding call would go here
    throw new Error('Embedding provider not configured.');
  }

  /* ── private pipeline steps ──────────────────────────────────────────────── */

  private async checkBudget(tenantId: string, estimatedTokens: number): Promise<void> {
    const now = Date.now();
    const dayStart = now - (now % DAY_MS);
    const entry = this.budgetCounters.get(tenantId);

    let current = 0;
    if (entry) {
      current = entry.windowStart === dayStart ? entry.tokens : 0;
    }

    if (current + estimatedTokens > this.config.maxBudgetTokensPerDay) {
      throw new Error(
        `Tenant ${tenantId} daily token budget exhausted (${current}/${this.config.maxBudgetTokensPerDay}).`,
      );
    }
  }

  /** Throws on guardrail violation. */
  private scanGuardrails(messages: LLMMessage[]): void {
    for (const msg of messages) {
      // Block prompt injection in any message
      for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(msg.content)) {
          throw new Error(`Guardrail violation: prompt injection detected in ${msg.role} message.`);
        }
      }

      // Block PII in system prompts
      if (msg.role === 'system' && containsPii(msg.content)) {
        throw new Error('Guardrail violation: PII detected in system prompt.');
      }
    }
  }

  private async lookupCache(
    tenantId: string,
    messages: LLMMessage[],
  ): Promise<LLMCompletionResponse | null> {
    const hash = this.hashMessages(tenantId, messages);
    const entry = this.cache.get(hash);
    if (!entry) return null;

    // Simple TTL: 1 hour
    if (Date.now() - entry.createdAt > 3_600_000) {
      this.cache.delete(hash);
      return null;
    }

    return { ...entry.response, cached: true };
  }

  private routeModel(complexity: TaskComplexity, _tenantId: string): string {
    if (complexity === 'simple') return this.config.modelTierMap.fast;
    if (complexity === 'complex') return this.config.modelTierMap.capable;
    return this.config.modelTierMap.auto;
  }

  private async dispatch(
    model: string,
    req: LLMCompletionRequest,
  ): Promise<LLMCompletionResponse> {
    const providerName = this.config.defaultProvider.name;
    const cb = this.getCircuitBreaker(providerName);

    if (cb.isOpen()) {
      throw new Error(`Circuit breaker OPEN for provider ${providerName}.`);
    }

    if (this.mockMode) {
      cb.recordSuccess();
      return this.mockResponse(req.taskId, model, req.messages, providerName);
    }

    // Real HTTP dispatch would go here
    try {
      const resp = await this.callProvider(
        this.config.defaultProvider,
        model,
        req,
      );
      cb.recordSuccess();
      return resp;
    } catch (err) {
      cb.recordFailure();
      throw err;
    }
  }

  private async dispatchFallback(
    req: LLMCompletionRequest,
    start: number,
  ): Promise<LLMCompletionResponse> {
    if (!this.config.fallbackProvider) {
      return {
        taskId: req.taskId,
        content: '',
        model: 'unavailable',
        tokensPrompt: 0,
        tokensCompletion: 0,
        cached: false,
        provider: 'none',
        latencyMs: Date.now() - start,
      };
    }

    const fb = this.config.fallbackProvider;
    const cb = this.getCircuitBreaker(fb.name);
    if (cb.isOpen()) {
      return {
        taskId: req.taskId,
        content: '',
        model: 'unavailable',
        tokensPrompt: 0,
        tokensCompletion: 0,
        cached: false,
        provider: 'none',
        latencyMs: Date.now() - start,
      };
    }

    try {
      const resp = await this.callProvider(fb, this.config.modelTierMap.auto, req);
      cb.recordSuccess();
      return resp;
    } catch {
      cb.recordFailure();
      return {
        taskId: req.taskId,
        content: '',
        model: 'unavailable',
        tokensPrompt: 0,
        tokensCompletion: 0,
        cached: false,
        provider: fb.name,
        latencyMs: Date.now() - start,
      };
    }
  }

  private async writeCache(
    tenantId: string,
    messages: LLMMessage[],
    resp: LLMCompletionResponse,
  ): Promise<void> {
    const hash = this.hashMessages(tenantId, messages);
    this.cache.set(hash, {
      messagesHash: hash,
      response: resp,
      createdAt: Date.now(),
    });
  }

  private async meterUsage(tenantId: string, tokens: number): Promise<void> {
    const now = Date.now();
    const dayStart = now - (now % DAY_MS);
    const entry = this.budgetCounters.get(tenantId);

    if (entry && entry.windowStart === dayStart) {
      entry.tokens += tokens;
    } else {
      this.budgetCounters.set(tenantId, { tokens, windowStart: dayStart });
    }
  }

  /* ── helpers ─────────────────────────────────────────────────────────────── */

  private getCircuitBreaker(providerName: string): CircuitBreaker {
    let cb = this.circuitBreakers.get(providerName);
    if (!cb) {
      cb = new CircuitBreaker();
      this.circuitBreakers.set(providerName, cb);
    }
    return cb;
  }

  private hashMessages(tenantId: string, messages: LLMMessage[]): string {
    const payload = JSON.stringify({ tenantId, messages });
    return createHash('sha256').update(payload).digest('hex');
  }

  private estimateTokens(messages: LLMMessage[]): number {
    return Math.ceil(messages.reduce((s, m) => s + m.content.length, 0) / 4);
  }

  private mockResponse(
    taskId: string,
    model: string,
    messages: LLMMessage[],
    provider: string,
  ): LLMCompletionResponse {
    const promptTokens = this.estimateTokens(messages);
    return {
      taskId,
      content: '[MOCK] This is a stub response. Set LLM_API_KEY to enable live completions.',
      model,
      tokensPrompt: promptTokens,
      tokensCompletion: 16,
      cached: false,
      provider: `${provider}/mock`,
      latencyMs: 0,
    };
  }

  /** Placeholder for real HTTP call to an OpenAI-compatible provider. */
  private async callProvider(
    _provider: import('./types').LLMProvider,
    _model: string,
    _req: LLMCompletionRequest,
  ): Promise<LLMCompletionResponse> {
    // TODO: implement real HTTP call using fetch/https
    throw new Error('Real provider dispatch not implemented.');
  }

  private emitAuditLog(
    req: LLMCompletionRequest,
    _resp: LLMCompletionResponse,
  ): void {
    // TODO: emit structured audit log to audit sink
    void req;
  }
}
