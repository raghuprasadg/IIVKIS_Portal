/**
 * Lightweight LLM Gateway client for use within the Vendor Knowledge agent.
 *
 * Mirrors the interface of the orchestrator's LLMGateway but is self-contained
 * to avoid a circular dependency (orchestrator → @iivkis/agents-vendor-knowledge).
 *
 * When LLM_API_KEY is not set, runs in MOCK_MODE and returns canned responses.
 */

import { createHash } from 'crypto';
import type {
  LLMCompletionRequest,
  LLMCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
} from '@iivkis/shared';

export interface LLMGatewayClientConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  embeddingModel?: string;
}

export class LLMGateway {
  private readonly mockMode: boolean;
  private readonly config: Required<LLMGatewayClientConfig>;
  private readonly cache = new Map<
    string,
    { response: LLMCompletionResponse; createdAt: number }
  >();

  constructor(config: LLMGatewayClientConfig = {}) {
    this.mockMode = !process.env['LLM_API_KEY'] && !config.apiKey;
    this.config = {
      baseUrl: config.baseUrl ?? process.env['LLM_BASE_URL'] ?? 'https://api.openai.com/v1',
      apiKey: config.apiKey ?? process.env['LLM_API_KEY'] ?? '',
      model: config.model ?? process.env['LLM_MODEL_AUTO'] ?? 'gpt-4o-mini',
      embeddingModel:
        config.embeddingModel ??
        process.env['LLM_EMBEDDING_MODEL'] ??
        'text-embedding-3-small',
    };
  }

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    // Check in-memory cache (1-hour TTL)
    if (req.cacheable) {
      const hit = this.cacheGet(req.tenantId, req);
      if (hit) return hit;
    }

    const start = Date.now();
    let resp: LLMCompletionResponse;

    if (this.mockMode) {
      resp = this.mockCompletion(req, start);
    } else {
      // TODO: implement real HTTP call to LLM provider
      resp = this.mockCompletion(req, start);
    }

    if (req.cacheable) {
      this.cachePut(req.tenantId, req, resp);
    }

    return resp;
  }

  async embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (this.mockMode) {
      return {
        taskId: req.taskId,
        embeddings: req.texts.map(() =>
          Array.from({ length: 1536 }, () => Math.random() * 2 - 1),
        ),
        model: this.config.embeddingModel,
        tokensUsed: req.texts.reduce((s, t) => s + Math.ceil(t.length / 4), 0),
      };
    }

    // TODO: implement real embedding call
    throw new Error('Embedding provider not configured in VK agent gateway.');
  }

  /* ── cache helpers ──────────────────────────────────────────────────────── */

  private cacheKey(tenantId: string, req: LLMCompletionRequest): string {
    return createHash('sha256')
      .update(JSON.stringify({ tenantId, messages: req.messages }))
      .digest('hex');
  }

  private cacheGet(
    tenantId: string,
    req: LLMCompletionRequest,
  ): LLMCompletionResponse | null {
    const key = this.cacheKey(tenantId, req);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > 3_600_000) {
      this.cache.delete(key);
      return null;
    }
    return { ...entry.response, cached: true };
  }

  private cachePut(
    tenantId: string,
    req: LLMCompletionRequest,
    resp: LLMCompletionResponse,
  ): void {
    const key = this.cacheKey(tenantId, req);
    this.cache.set(key, { response: resp, createdAt: Date.now() });
  }

  /* ── mock ───────────────────────────────────────────────────────────────── */

  private mockCompletion(req: LLMCompletionRequest, start: number): LLMCompletionResponse {
    const promptTokens = Math.ceil(
      req.messages.reduce((s, m) => s + m.content.length, 0) / 4,
    );
    return {
      taskId: req.taskId,
      content:
        '[MOCK] Vendor Knowledge Agent LLM response. Set LLM_API_KEY to enable live completions.',
      model: req.model ?? this.config.model,
      tokensPrompt: promptTokens,
      tokensCompletion: 18,
      cached: false,
      provider: 'mock',
      latencyMs: Date.now() - start,
    };
  }
}
