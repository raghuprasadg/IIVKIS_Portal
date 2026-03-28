/**
 * Integration Agent
 *
 * Responsibilities:
 *  - Connect to external IT systems (CMDB, ITSM, monitoring tools)
 *  - Ingest data feeds and normalise them into shared types
 *  - Publish enriched data to internal services
 *
 * Full implementation is deferred to subsequent development steps.
 */
import type { AgentRequest, AgentResponse } from '@iivkis/shared';

export const AGENT_ID = 'agent-integration' as const;

/**
 * Handle an integration task request.
 */
export async function handle(request: AgentRequest): Promise<AgentResponse> {
  // TODO: Implement external system integration
  void request;
  return {
    requestId: request.id,
    agentId: AGENT_ID,
    result: null,
    status: 'pending',
    timestamp: new Date().toISOString(),
  };
}
