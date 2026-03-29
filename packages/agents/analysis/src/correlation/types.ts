import type { Signal, CorrelationGroup, CorrelationRuleDsl } from '@iivkis/shared';

export interface EnrichedSignal extends Signal {
  /** SHA-256 fingerprint derived from sourceSystem + affectedCiId + title. */
  fingerprint: string;
  /** Number of hops from root CI in dependency graph. */
  topologyDepth?: number;
  /** 1536-dim embedding vector, if pre-computed. */
  embedding?: number[];
  /** Internal stable ID assigned at ingest time. */
  internalId: string;
}

export interface ProcessorContext {
  tenantId: string;
  signals: EnrichedSignal[];
  existingGroups: CorrelationGroup[];
  rules: CorrelationRuleDsl[];
  maintenanceWindows: MaintenanceWindow[];
  now: Date;
}

export interface ProcessorResult {
  processorName: string;
  proposedGroups: ProposedGroup[];
  suppressedSignalIds: string[];
  /** groupId → confidence delta */
  confidenceAdjustments: Map<string, number>;
}

export interface ProposedGroup {
  signalIds: string[];
  correlationMethod: string;
  baseConfidence: number;
  /** Explicitly undefined when root cause is unknown. */
  rootCauseCiId: string | undefined;
  narrative: string | undefined;
}

export interface MaintenanceWindow {
  id: string;
  tenantId: string;
  /** null means all CIs */
  ciId?: string;
  startsAt: Date;
  endsAt: Date;
  suppressAlerts: boolean;
}

export interface CorrelationProcessorI {
  readonly name: string;
  readonly version: string;
  process(ctx: ProcessorContext): Promise<ProcessorResult>;
}
