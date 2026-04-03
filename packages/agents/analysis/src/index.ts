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
import type { AgentRequest, AgentResponse, Signal, CorrelatedGroupWithEvidence, RCAResult } from '@iivkis/shared';
import { CorrelationEngine } from './correlation/index.js';
import type { EnrichedSignal, ProcessorContext } from './correlation/index.js';
import { KGService } from './kg/service.js';
import { CIResolutionService } from './services/ci-resolution.js';
import { RCAEngine } from './services/rca.js';

export * from './correlation/index.js';
export { KGService } from './kg/service.js';

export const AGENT_ID = 'agent-analysis' as const;

const kgService = new KGService();
const ciResolver = new CIResolutionService();
const rcaEngine = new RCAEngine();

function fingerprintSignal(signal: Signal): string {
  const raw = `${signal.sourceSystem}|${signal.affectedCiId ?? ''}|${signal.title}`;
  return createHash('sha256').update(raw).digest('hex');
}

async function enrichSignals(signals: Signal[]): Promise<EnrichedSignal[]> {
  const ciResolvedSignals = signals.map((signal) => {
    const raw = signal.rawPayload ?? {};
    const resolvedCi = ciResolver.resolve({
      ciId: signal.affectedCiId,
      host: typeof raw['host'] === 'string' ? raw['host'] : undefined,
      hostname: typeof raw['hostname'] === 'string' ? raw['hostname'] : undefined,
      ip: typeof raw['ip'] === 'string' ? raw['ip'] : undefined,
      cloudId: typeof raw['cloud_id'] === 'string' ? raw['cloud_id'] : undefined,
    });
    return {
      ...signal,
      ...(resolvedCi !== undefined && { affectedCiId: resolvedCi }),
    };
  });

  // Collect unique CI IDs so we can batch-fetch topology in one call
  const ciIds = ciResolvedSignals
    .map(s => s.affectedCiId)
    .filter((id): id is string => id !== undefined);
  const topoMap = await kgService.batchGetTopologyInfo(ciIds);

  return ciResolvedSignals.map((s, idx) => {
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

      const rca: RCAResult = rcaEngine.derive(groupsWithEvidence);

      for (const signal of enriched) {
        if (!signal.affectedCiId) continue;
        void kgService.addEvent(signal.internalId, signal.affectedCiId, {
          source: signal.sourceSystem,
          signalType: signal.signalType,
          severity: signal.severity,
          occurredAt: signal.occurredAt,
        });
      }

      return {
        taskId: request.taskId,
        status: 'success',
        tenantId: request.tenantId,
        result: {
          groups: groupsWithEvidence,
          rca,
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
