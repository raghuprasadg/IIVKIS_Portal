/**
 * Agent contract — all agents implement this interface (LLD §1.1, NFR-MAINT-003).
 *
 * This is the canonical contract used by the Orchestrator and all agent packages.
 */

/** All supported agent task types (LLD §1.1). */
export type AgentTaskType =
  | 'vk.search'            // Vendor Knowledge semantic search
  | 'vk.ingest'            // Vendor Knowledge feed ingestion
  | 'vk.article.get'       // Get specific article
  | 'ts.plan.generate'     // Troubleshooting resolution plan
  | 'ts.chat.turn'         // Conversational chat turn
  | 'int.sync'             // Integration sync trigger
  | 'int.webhook.process'  // Inbound webhook processing
  | 'anlys.report'         // Analytics report generation
  | 'anlys.anomaly'        // Anomaly detection run
  | 'ce.signal.ingest'     // Signal ingestion into CE
  | 'ce.group.query'       // Query correlation groups
  | 'llm.complete'         // Direct LLM completion (internal)
  | 'llm.embed';           // Embedding generation (internal)

/** Legacy high-level agent category kept for backwards compatibility. */
export type AgentType =
  | 'vendor-knowledge'
  | 'troubleshooting'
  | 'integration'
  | 'analysis';

/** Unique agent identifiers. */
export type AgentId =
  | 'agent-vendor-knowledge'
  | 'agent-troubleshooting'
  | 'agent-integration'
  | 'agent-analysis'
  | 'orchestrator';

/** Task-level status values for the canonical LLD §1.1 response. */
export type AgentTaskStatus = 'success' | 'partial' | 'failed' | 'degraded';

/** Legacy status alias kept for backwards compatibility with existing stubs. */
export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed';

/** A request routed to an agent via the orchestrator (LLD §1.1 canonical form). */
export interface AgentRequest {
  /** UUID — idempotency key (NFR-RES-022). */
  taskId: string;
  /** Routes to the correct agent. */
  taskType: AgentTaskType;
  /** UUID — extracted from JWT claim only. */
  tenantId: string;
  /** UUID — requesting user. */
  userId: string;
  /** OpenTelemetry trace ID. */
  traceId: string;
  /** OpenTelemetry span ID. */
  spanId: string;
  /** Task-specific input. */
  payload: Record<string, unknown>;
  /** Caller-specified timeout in milliseconds. */
  timeoutMs: number;
  /** ISO 8601 UTC creation timestamp. */
  createdAt: string;
}

/** A response returned by an agent (LLD §1.1). */
export interface AgentResponse {
  taskId: string;
  status: AgentTaskStatus;
  tenantId: string;
  result?: Record<string, unknown>;
  error?: AgentError;
  /** Wall-clock latency measured by the agent. */
  latencyMs: number;
  /** For LLM tasks: model name + version used. */
  modelUsed?: string;
  /** For LLM tasks: total tokens consumed. */
  tokensUsed?: number;
  createdAt: string;
}

/** Structured error payload — no stack traces in production. */
export interface AgentError {
  /** Machine-readable error code. */
  code: string;
  /** Human-readable message. */
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}
