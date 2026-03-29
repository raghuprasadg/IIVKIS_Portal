/**
 * Analysis Agent
 *
 * Responsibilities:
 *  - Correlation Engine: ingest signals and produce correlation groups
 *  - Perform trend analysis on incident and vendor data
 *  - Surface actionable insights to portal users
 *  - Generate analytics reports
 */
import { createHash } from 'crypto';
import type { AgentRequest, AgentResponse, Signal } from '@iivkis/shared';
import { CorrelationEngine } from './correlation/index.js';
import type { EnrichedSignal, ProcessorContext } from './correlation/index.js';

export * from './correlation/index.js';

export const AGENT_ID = 'agent-analysis' as const;

function fingerprintSignal(signal: Signal): string {
  const raw = `${signal.sourceSystem}|${signal.affectedCiId ?? ''}|${signal.title}`;
  return createHash('sha256').update(raw).digest('hex');
}

function enrichSignals(signals: Signal[]): EnrichedSignal[] {
  return signals.map((s, idx) => ({
    ...s,
    internalId: `sig-${idx}-${fingerprintSignal(s).slice(0, 8)}`,
    fingerprint: fingerprintSignal(s),
  }));
}

/**
 * Handle an analysis task request.
 */
export async function handle(request: AgentRequest): Promise<AgentResponse> {
  const start = Date.now();

  if (request.taskType === 'ce.signal.ingest') {
    const rawSignals = (request.payload['signals'] ?? []) as Signal[];
    const enriched = enrichSignals(rawSignals);

    const ctx: ProcessorContext = {
      tenantId: request.tenantId,
      signals: enriched,
      existingGroups: [],
      rules: [],
      maintenanceWindows: [],
      now: new Date(),
    };

    try {
      const engine = new CorrelationEngine();
      const { newGroups, suppressedSignalIds, processorLog } = await engine.process(ctx);
      return {
        taskId: request.taskId,
        status: 'success',
        tenantId: request.tenantId,
        result: {
          groups: newGroups,
          suppressedSignalIds,
          processorLog,
        },
        latencyMs: Date.now() - start,
        createdAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        taskId: request.taskId,
        status: 'failed',
        tenantId: request.tenantId,
        error: {
          code: 'CE_INGEST_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
          retryable: true,
        },
        latencyMs: Date.now() - start,
        createdAt: new Date().toISOString(),
      };
    }
  }

  if (request.taskType === 'ce.group.query') {
    return {
      taskId: request.taskId,
      status: 'degraded',
      tenantId: request.tenantId,
      result: { groups: [] },
      latencyMs: Date.now() - start,
      createdAt: new Date().toISOString(),
    };
  }

  return {
    taskId: request.taskId,
    status: 'degraded',
    tenantId: request.tenantId,
    result: {},
    latencyMs: Date.now() - start,
    createdAt: new Date().toISOString(),
  };
}
