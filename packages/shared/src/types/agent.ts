/**
 * Agent types — defines the request/response contract shared by all agents
 * and the Engineering Orchestrator.
 */

/** Supported agent task types. */
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

/** Status of an agent task. */
export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed';

/** A request routed to an agent via the orchestrator. */
export interface AgentRequest {
  /** Unique request identifier (UUID). */
  id: string;
  /** Type of task to perform. */
  type: AgentType;
  /** Arbitrary task-specific input payload. */
  payload: unknown;
  /** ISO-8601 timestamp when the request was created. */
  timestamp: string;
}

/** A response returned by an agent. */
export interface AgentResponse {
  /** The originating request ID. */
  requestId: string;
  /** The agent that produced this response. */
  agentId: AgentId | 'orchestrator';
  /** Task output — null while pending. */
  result: unknown;
  /** Current status of the task. */
  status: AgentStatus;
  /** ISO-8601 timestamp when the response was produced. */
  timestamp: string;
}
