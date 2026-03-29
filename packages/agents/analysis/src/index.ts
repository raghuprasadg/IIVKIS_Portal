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
import type { AgentRequest, AgentResponse, Signal, CorrelatedGroupWithEvidence } from '@iivkis/shared';
import { CorrelationEngine } from './correlation/index.js';
import type { EnrichedSignal, ProcessorContext } from './correlation/index.js';
import { KGService } from './kg/service.js';

export * from './correlation/index.js';
export { KGService } from './kg/service.js';

export const AGENT_ID = 'agent-analysis' as const;

const kgService = new KGService();

function fingerprintSignal(signal: Signal): string {
  const raw = `${signal.sourceSystem}|${signal.affectedCiId ?? ''}|${signal.title}`;
  return createHash('sha256').update(raw).digest('hex');
}

async function enrichSignals(signals: Signal[]): Promise<EnrichedSignal[]> {
  // Collect unique CI IDs so we can batch-fetch topology in one call
  const ciIds = signals
    .map(s => s.affectedCiId)
    .filter((id): id is string => id !== undefined);
  const topoMap = await kgService.batchGetTopologyInfo(ciIds);

  return signals.map((s, idx) => {
    const topo = s.affectedCiId ? topoMap.get(s.affectedCiId) : undefined;
    return {
      ...s,
      internalId: `sig-${idx}-${fingerprintSignal(s).slice(0, 8)}`,
      fingerprint: fingerprintSignal(s),
      ...(topo !== undefined && { topologyDepth: topo.topologyDepth }),
    };
  });
}

/**
 * Handle an analysis task request.
 */
export async function handle(request: AgentRequest): Promise<AgentResponse> {
  const start = Date.now();

  if (request.taskType === 'ce.signal.ingest') {
    const rawSignals = (request.payload['signals'] ?? []) as Signal[];
    const enriched = await enrichSignals(rawSignals);

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
      const { newGroups, groupSignalMap, groupNarrativeMap, suppressedSignalIds, processorLog } =
        await engine.process(ctx);

      // Build evidence-rich groups for the response
      const signalIndex = new Map(enriched.map(s => [s.internalId, s]));
      const groupsWithEvidence: CorrelatedGroupWithEvidence[] = newGroups.map(group => ({
        ...group,
        signalIds: groupSignalMap.get(group.id) ?? [],
        evidenceNarratives: groupNarrativeMap.get(group.id) ?? [],
        // Attach the actual Signal objects for caller convenience
        signals: (groupSignalMap.get(group.id) ?? [])
          .map(sid => signalIndex.get(sid))
          .filter((s): s is EnrichedSignal => s !== undefined),
      }));

      return {
        taskId: request.taskId,
        status: 'success',
        tenantId: request.tenantId,
        result: {
          groups: groupsWithEvidence,
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
