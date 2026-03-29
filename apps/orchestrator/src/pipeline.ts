/**
 * IntegrationPipeline — Phase 6 end-to-end data flow (LLD §1.1, §4, §5).
 *
 * Chains four stages:
 *   1. Normalization  — raw records → canonical Signal[]  (NormalizationEngine)
 *   2. KG Enrichment  — attach topologyDepth per CI       (KGService, via analysis agent)
 *   3. CE Ingest      — Signals → CorrelatedGroupWithEvidence[]  (CorrelationEngine)
 *   4. RAG answer     — optional LLM answer over groups   (LLMGateway / vk.search)
 *
 * The pipeline is designed to work entirely without external infrastructure:
 * all data-store calls are handled by stubs when env vars are absent.
 */

import { randomUUID } from 'crypto';
import type { Signal, CorrelatedGroupWithEvidence, AgentRequest } from '@iivkis/shared';
import { NormalizationEngine } from '@iivkis/agents-integration';
import type { NormalizationTrace } from '@iivkis/agents-integration';
import type { IntegrationConfig } from '@iivkis/agents-integration';
import { orchestrate } from './orchestrator';

export interface PipelineInput {
  /** Tenant UUID. */
  tenantId: string;
  /** Requesting-user UUID. */
  userId: string;
  /**
   * Raw event records from the external source system
   * (e.g. ServiceNow incidents, Zabbix alerts, PagerDuty webhooks).
   */
  rawEvents: Record<string, unknown>[];
  /**
   * Integration config that specifies connectorType and field mappings.
   * When omitted, the engine normalizes with zero mappings (all defaults).
   */
  integrationConfig?: Pick<IntegrationConfig, 'connectorType' | 'fieldMappings'>;
  /**
   * Optional free-text query to answer via the RAG pipeline after correlation.
   * When provided the pipeline calls vk.search and attaches the answer to the result.
   */
  ragQuery?: string;
}

export interface PipelineResult {
  /** All canonical signals produced by the normalization stage. */
  normalizedSignals: Signal[];
  /** Per-signal normalization trace for debuggability. */
  normalizationTrace: NormalizationTrace[];
  /** Groups emitted by the Correlation Engine, each carrying full evidence. */
  correlatedGroups: CorrelatedGroupWithEvidence[];
  /** Signals that were suppressed by maintenance-window or dedup processors. */
  suppressedSignalIds: string[];
  /** Per-processor log entry for audit / observability. */
  processorLog: { name: string; groupsProposed: number; signalsSuppressed: number }[];
  /** RAG answer (only present when `ragQuery` was provided). */
  ragAnswer?: {
    answer: string;
    sources: Array<{ articleId: string; chunkText: string; score: number }>;
    model: string;
    tokensUsed: number;
  };
  /** Total wall-clock time for the entire pipeline in milliseconds. */
  totalLatencyMs: number;
}

const normEngine = new NormalizationEngine();

export class IntegrationPipeline {
  /**
   * Run the full Phase 6 pipeline and return structured correlated output.
   */
  async run(input: PipelineInput): Promise<PipelineResult> {
    const pipelineStart = Date.now();
    const traceId = randomUUID();
    const spanId = randomUUID();

    // ── Stage 1: Normalization ─────────────────────────────────────────────
    const normConfig = input.integrationConfig ?? {
      connectorType: 'custom' as const,
      fieldMappings: [],
    };
    const { signals: normalizedSignals, trace: normalizationTrace } =
      normEngine.normalize(input.rawEvents, normConfig);

    // ── Stage 2 + 3: KG enrichment + CE ingest ────────────────────────────
    // The analysis agent's handle() already calls KGService internally before
    // running the CE, so we just need to forward the normalized signals.
    const ceRequest: AgentRequest = {
      taskId: randomUUID(),
      taskType: 'ce.signal.ingest',
      tenantId: input.tenantId,
      userId: input.userId,
      traceId,
      spanId,
      payload: { signals: normalizedSignals },
      timeoutMs: 30_000,
      createdAt: new Date().toISOString(),
    };

    const ceResponse = await orchestrate(ceRequest);

    const ceResult = (ceResponse.result ?? {}) as {
      groups?: CorrelatedGroupWithEvidence[];
      suppressedSignalIds?: string[];
      processorLog?: { name: string; groupsProposed: number; signalsSuppressed: number }[];
    };

    const correlatedGroups = ceResult.groups ?? [];
    const suppressedSignalIds = ceResult.suppressedSignalIds ?? [];
    const processorLog = ceResult.processorLog ?? [];

    // ── Stage 4: Optional RAG answer ──────────────────────────────────────
    let ragAnswer: PipelineResult['ragAnswer'];
    if (input.ragQuery) {
      const ragRequest: AgentRequest = {
        taskId: randomUUID(),
        taskType: 'vk.search',
        tenantId: input.tenantId,
        userId: input.userId,
        traceId,
        spanId,
        payload: { query: input.ragQuery, topK: 5 },
        timeoutMs: 20_000,
        createdAt: new Date().toISOString(),
      };
      const ragResponse = await orchestrate(ragRequest);
      const r = ragResponse.result as {
        answer?: string;
        sources?: Array<{ articleId: string; chunkText: string; score: number }>;
        model?: string;
        tokensUsed?: number;
      } | undefined;
      if (r?.answer !== undefined) {
        ragAnswer = {
          answer: r.answer,
          sources: r.sources ?? [],
          model: r.model ?? ragResponse.modelUsed ?? 'unknown',
          tokensUsed: r.tokensUsed ?? ragResponse.tokensUsed ?? 0,
        };
      }
    }

    return {
      normalizedSignals,
      normalizationTrace,
      correlatedGroups,
      suppressedSignalIds,
      processorLog,
      totalLatencyMs: Date.now() - pipelineStart,
      ...(ragAnswer !== undefined && { ragAnswer }),
    };
  }
}
