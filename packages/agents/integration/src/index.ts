/**
 * Integration Agent
 *
 * Responsibilities:
 *  - Connect to external IT systems (CMDB, ITSM, monitoring tools)
 *  - Ingest data feeds and normalise them into shared types
 *  - Publish enriched data to internal services
 */
import type { AgentRequest, AgentResponse } from '@iivkis/shared';
import { ConnectorRegistry } from './connectors/registry';
import type { IntegrationConfig, WebhookPayload } from './connectors/types';
import { handleInboundWebhook } from './webhook/handler';
import { runSync } from './sync/runner';

// ── Register all built-in connectors on module load ──────────────────────────
import { ServiceNowConnector } from './connectors/servicenow/index';
import { PagerDutyConnector } from './connectors/pagerduty/index';
import { JiraConnector } from './connectors/jira/index';
import { ZabbixConnector } from './connectors/zabbix/index';

ConnectorRegistry.register(new ServiceNowConnector());
ConnectorRegistry.register(new PagerDutyConnector());
ConnectorRegistry.register(new JiraConnector());
ConnectorRegistry.register(new ZabbixConnector());

// ── Public API surface ────────────────────────────────────────────────────────
export { ConnectorRegistry } from './connectors/registry';
export { handleInboundWebhook } from './webhook/handler';
export { validateHmacSignature } from './webhook/validator';
export { runSync } from './sync/runner';
export { scheduleSync, unscheduleSync, listScheduledJobs } from './sync/scheduler';
export type {
  ConnectorI,
  ConnectorType,
  IntegrationConfig,
  ConnectorAuth,
  FieldMapping,
  SyncResult,
  SyncError,
  SyncMode,
  AuthType,
  WebhookPayload,
} from './connectors/types';

export const AGENT_ID = 'agent-integration' as const;

/**
 * Handle an integration task request.
 *
 * Supported task types:
 *  - `int.sync`             — Trigger a connector sync
 *  - `int.webhook.process`  — Process an inbound webhook payload
 */
export async function handle(request: AgentRequest): Promise<AgentResponse> {
  const start = Date.now();

  try {
    switch (request.taskType) {
      case 'int.sync': {
        const config = request.payload['config'] as IntegrationConfig;
        const sinceRaw = request.payload['since'] as string | undefined;
        const since = sinceRaw ? new Date(sinceRaw) : undefined;

        const result = await runSync(config, since);

        return {
          taskId: request.taskId,
          status: result.errors.length === 0 ? 'success' : 'partial',
          tenantId: request.tenantId,
          result: result as unknown as Record<string, unknown>,
          latencyMs: Date.now() - start,
          createdAt: new Date().toISOString(),
        };
      }

      case 'int.webhook.process': {
        const payload = request.payload['webhookPayload'] as WebhookPayload;
        const config = request.payload['config'] as IntegrationConfig;

        const signals = await handleInboundWebhook(payload, config);

        return {
          taskId: request.taskId,
          status: 'success',
          tenantId: request.tenantId,
          result: { signals } as unknown as Record<string, unknown>,
          latencyMs: Date.now() - start,
          createdAt: new Date().toISOString(),
        };
      }

      default:
        return {
          taskId: request.taskId,
          status: 'failed',
          tenantId: request.tenantId,
          error: {
            code: 'UNSUPPORTED_TASK_TYPE',
            message: `Integration agent does not handle task type: ${request.taskType}`,
            retryable: false,
          },
          latencyMs: Date.now() - start,
          createdAt: new Date().toISOString(),
        };
    }
  } catch (err) {
    return {
      taskId: request.taskId,
      status: 'failed',
      tenantId: request.tenantId,
      error: {
        code: 'INTEGRATION_ERROR',
        message: err instanceof Error ? err.message : String(err),
        retryable: true,
      },
      latencyMs: Date.now() - start,
      createdAt: new Date().toISOString(),
    };
  }
}
