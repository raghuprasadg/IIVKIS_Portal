/**
 * CorrelationEngine — orchestrates all 16 processors in order.
 *
 * Each processor's ProposedGroups are converted to CorrelationGroup stubs and
 * folded into the context so later processors can reference them.
 */
import { randomUUID } from 'crypto';
import type { CorrelationGroup } from '@iivkis/shared';
import type { ProcessorContext, CorrelationProcessorI } from './types.js';
import {
  TimeWindowProcessor,
  TopologyProcessor,
  RuleEngineProcessor,
  SemanticSimilarityProcessor,
  DeduplicationProcessor,
  FlapDetectionProcessor,
  MaintenanceWindowProcessor,
  BlastRadiusProcessor,
  RootCauseIsolationProcessor,
  AnomalyPatternProcessor,
  ThresholdGroupingProcessor,
  CausalityChainProcessor,
  SuppressionProcessor,
  SLABreachPredictionProcessor,
  CrossServiceProcessor,
  ConfidenceAggregationProcessor,
} from './processors/index.js';

export class CorrelationEngine {
  private readonly processors: CorrelationProcessorI[];

  constructor() {
    this.processors = [
      new TimeWindowProcessor(),
      new TopologyProcessor(),
      new RuleEngineProcessor(),
      new SemanticSimilarityProcessor(),
      new DeduplicationProcessor(),
      new FlapDetectionProcessor(),
      new MaintenanceWindowProcessor(),
      new BlastRadiusProcessor(),
      new RootCauseIsolationProcessor(),
      new AnomalyPatternProcessor(),
      new ThresholdGroupingProcessor(),
      new CausalityChainProcessor(),
      new SuppressionProcessor(),
      new SLABreachPredictionProcessor(),
      new CrossServiceProcessor(),
      new ConfidenceAggregationProcessor(),
    ];
  }

  async process(ctx: ProcessorContext): Promise<{
    newGroups: CorrelationGroup[];
    /** Maps group.id → signal internalId[] for evidence building. */
    groupSignalMap: Map<string, string[]>;
    /** Maps group.id → ordered evidence narrative strings. */
    groupNarrativeMap: Map<string, string[]>;
    suppressedSignalIds: string[];
    processorLog: { name: string; groupsProposed: number; signalsSuppressed: number }[];
  }> {
    const newGroups: CorrelationGroup[] = [];
    const groupSignalMap = new Map<string, string[]>();
    const groupNarrativeMap = new Map<string, string[]>();
    const allSuppressed = new Set<string>();
    const processorLog: { name: string; groupsProposed: number; signalsSuppressed: number }[] = [];

    // Running context that is updated after each processor
    let runningCtx: ProcessorContext = { ...ctx, existingGroups: [...ctx.existingGroups] };

    for (const processor of this.processors) {
      const result = await processor.process(runningCtx);

      // Convert proposed groups to CorrelationGroup stubs
      const createdAt = runningCtx.now.toISOString();
      const freshGroups: CorrelationGroup[] = result.proposedGroups.map(pg => {
        const id = randomUUID();
        groupSignalMap.set(id, pg.signalIds);
        if (pg.narrative !== undefined) {
          groupNarrativeMap.set(id, [pg.narrative]);
        }
        return {
          id,
          tenantId: runningCtx.tenantId,
          status: 'proposed' as const,
          confidence: Math.min(100, Math.max(0, pg.baseConfidence)),
          ...(pg.rootCauseCiId !== undefined ? { rootCauseCiId: pg.rootCauseCiId } : {}),
          ...(pg.narrative !== undefined ? { rootCauseNarrative: pg.narrative } : {}),
          correlationMethods: [pg.correlationMethod],
          createdAt,
          updatedAt: createdAt,
        };
      });

      // Apply confidence adjustments to groups already in runningCtx
      for (const [groupId, delta] of result.confidenceAdjustments.entries()) {
        const target =
          runningCtx.existingGroups.find(g => g.id === groupId) ??
          newGroups.find(g => g.id === groupId);
        if (target) {
          target.confidence = Math.min(100, Math.max(0, target.confidence + delta));
          target.updatedAt = createdAt;
        }
      }

      // Accumulate suppressed IDs
      for (const id of result.suppressedSignalIds) allSuppressed.add(id);

      // Fold new groups into running context for subsequent processors
      newGroups.push(...freshGroups);
      runningCtx = {
        ...runningCtx,
        existingGroups: [...runningCtx.existingGroups, ...freshGroups],
      };

      processorLog.push({
        name: result.processorName,
        groupsProposed: result.proposedGroups.length,
        signalsSuppressed: result.suppressedSignalIds.length,
      });
    }

    return {
      newGroups,
      groupSignalMap,
      groupNarrativeMap,
      suppressedSignalIds: [...allSuppressed],
      processorLog,
    };
  }
}
