/**
 * Correlation Engine signal and group types (LLD §4.2, §6).
 */

export type SignalType =
  | 'monitoring_alert'
  | 'incident'
  | 'cmdb_change'
  | 'vendor_advisory'
  | 'log_anomaly'
  | 'user_observation';

export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** A single signal event ingested into the Correlation Engine. */
export interface Signal {
  externalId?: string;
  signalType: SignalType;
  sourceSystem: string;
  /** UUID of the affected CI node in the Knowledge Graph. */
  affectedCiId?: string;
  severity: SignalSeverity;
  title: string;
  description?: string;
  rawPayload?: Record<string, unknown>;
  /** ISO 8601 */
  occurredAt: string;
}

export interface SignalIngestionRequest {
  tenantId: string;
  signals: Signal[];
}

export type CorrelationGroupStatus = 'proposed' | 'confirmed' | 'rejected' | 'merged';

/** A group of correlated signals with a computed confidence score. */
export interface CorrelationGroup {
  id: string;
  tenantId: string;
  status: CorrelationGroupStatus;
  /** 0.00 – 100.00 */
  confidence: number;
  /** UUID of the most-likely root-cause CI node. */
  rootCauseCiId?: string;
  rootCauseNarrative?: string;
  correlationMethods: string[];
  ruleIds?: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

/**
 * A correlation group enriched with the signals that form it and human-readable
 * evidence narratives from each contributing processor.
 *
 * Returned by the CE pipeline for Phase 6 end-to-end validation.
 */
export interface CorrelatedGroupWithEvidence extends CorrelationGroup {
  /** Ordered list of signal `internalId`s that belong to this group. */
  signalIds: string[];
  /**
   * Per-processor narrative strings explaining why these signals were grouped.
   * Example: "3 signals from 'zabbix' within 10 min window. Temporal score: 25."
   */
  evidenceNarratives: string[];
  /**
   * The full `Signal` objects for every signal in `signalIds`.
   * Populated by the analysis agent when returning CE results to callers.
   */
  signals: Signal[];
}

/** Correlation rule DSL body (stored as JSONB in correlation_rules.dsl_body). */
export interface CorrelationRuleDsl {
  name: string;
  match: Record<string, unknown>;
  group_by: {
    topology?: { relation: string; hops: number };
    time_window_minutes: number;
  };
  require_signals: { min: number };
  output: {
    confidence_base: number;
    confidence_boost_per_additional_signal: number;
    max_confidence: number;
  };
}
