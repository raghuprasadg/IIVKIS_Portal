/**
 * NormalizationEngine — Phase 6 core component.
 *
 * Converts raw events from any external system into canonical `Signal` objects
 * using the field mappings defined in `IntegrationConfig`.
 *
 * The engine applies a three-stage pipeline per raw event:
 *   1. Field extraction  — dot-notation path resolution against the raw record
 *   2. Value transform   — lowercase / severity_map / trim / uppercase
 *   3. Defaults fill-in  — required fields receive sensible fallbacks when absent
 *
 * It is connector-agnostic: the caller supplies the raw records and the config;
 * the engine does not make any network calls.
 */

import { randomUUID } from 'crypto';
import type { Signal, SignalSeverity, SignalType } from '@iivkis/shared';
import type { FieldMapping, IntegrationConfig } from '../connectors/types';

const VALID_SEVERITIES: ReadonlySet<string> = new Set([
  'critical', 'high', 'medium', 'low', 'info',
]);

const VALID_SIGNAL_TYPES: ReadonlySet<string> = new Set([
  'monitoring_alert', 'incident', 'cmdb_change',
  'vendor_advisory', 'log_anomaly', 'user_observation',
]);

export interface NormalizationResult {
  signals: Signal[];
  /** Per-signal diagnostics for Phase 6 tracing. */
  trace: NormalizationTrace[];
}

export interface NormalizationTrace {
  rawIndex: number;
  signalExternalId: string;
  fieldsResolved: string[];
  fieldsDefaulted: string[];
}

export class NormalizationEngine {
  /**
   * Normalize an array of raw records from an external system into `Signal[]`.
   *
   * @param rawRecords  Plain objects received from a connector sync or webhook.
   * @param config      Integration config that provides field mappings and metadata.
   */
  normalize(
    rawRecords: Record<string, unknown>[],
    config: Pick<IntegrationConfig, 'connectorType' | 'fieldMappings'>,
  ): NormalizationResult {
    const signals: Signal[] = [];
    const trace: NormalizationTrace[] = [];

    for (let idx = 0; idx < rawRecords.length; idx++) {
      const raw = rawRecords[idx]!;
      const { partial, resolved } = this.applyMappings(raw, config.fieldMappings);
      const { signal, defaulted } = this.fillDefaults(partial, config.connectorType, raw);
      signals.push(signal);
      trace.push({
        rawIndex: idx,
        signalExternalId: signal.externalId ?? '(none)',
        fieldsResolved: resolved,
        fieldsDefaulted: defaulted,
      });
    }

    return { signals, trace };
  }

  /* ── private helpers ───────────────────────────────────────────────────── */

  private applyMappings(
    raw: Record<string, unknown>,
    mappings: FieldMapping[],
  ): { partial: Partial<Signal>; resolved: string[] } {
    const partial: Partial<Signal> = {};
    const resolved: string[] = [];

    for (const mapping of mappings) {
      const value = this.getNestedValue(raw, mapping.sourceField);
      if (value === undefined) continue;

      const transformed = this.applyTransform(value, mapping);
      // Dynamic write is intentional for generic field-mapping support.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (partial as Record<string, unknown>)[mapping.targetField as string] = transformed;
      resolved.push(`${mapping.sourceField} → ${mapping.targetField}`);
    }

    return { partial, resolved };
  }

  private applyTransform(
    value: unknown,
    mapping: FieldMapping,
  ): unknown {
    switch (mapping.transform) {
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'trim':
        return typeof value === 'string' ? value.trim() : value;
      case 'severity_map':
        if (typeof value === 'string' && mapping.severityMap) {
          return this.mapSeverity(value, mapping.severityMap);
        }
        return value;
      default:
        return value;
    }
  }

  private fillDefaults(
    partial: Partial<Signal>,
    sourceSystem: string,
    raw: Record<string, unknown>,
  ): { signal: Signal; defaulted: string[] } {
    const defaulted: string[] = [];
    const now = new Date().toISOString();

    // Track which required fields were absent and needed a default
    if (!partial.signalType) defaulted.push('signalType');
    if (!partial.sourceSystem) defaulted.push('sourceSystem');
    if (!partial.severity) defaulted.push('severity');
    if (!partial.title) defaulted.push('title');
    if (!partial.occurredAt) defaulted.push('occurredAt');
    if (!partial.externalId) defaulted.push('externalId');

    // Build the required-fields skeleton (all non-undefined strings)
    const signal: Signal = {
      externalId: partial.externalId ?? randomUUID(),
      signalType: this.coerceSignalType(partial.signalType ?? 'monitoring_alert'),
      sourceSystem: partial.sourceSystem ?? sourceSystem,
      severity: this.coerceSeverity(partial.severity ?? 'medium'),
      title: partial.title ?? this.inferTitle(raw),
      occurredAt: partial.occurredAt ?? now,
    };

    // Optional fields — only set when present to satisfy exactOptionalPropertyTypes
    const desc = partial.description;
    if (desc !== undefined) signal.description = desc;

    const ciId = partial.affectedCiId;
    if (ciId !== undefined) signal.affectedCiId = ciId;

    if (partial.rawPayload !== undefined) {
      signal.rawPayload = partial.rawPayload;
    } else {
      signal.rawPayload = raw as Record<string, unknown>;
    }

    return { signal, defaulted };
  }

  /** Coerce an arbitrary string to a valid SignalSeverity, defaulting to 'medium'. */
  private coerceSeverity(raw: unknown): SignalSeverity {
    const s = String(raw).toLowerCase();
    return VALID_SEVERITIES.has(s) ? (s as SignalSeverity) : 'medium';
  }

  /** Coerce an arbitrary string to a valid SignalType, defaulting to 'monitoring_alert'. */
  private coerceSignalType(raw: unknown): SignalType {
    const s = String(raw).toLowerCase();
    return VALID_SIGNAL_TYPES.has(s) ? (s as SignalType) : 'monitoring_alert';
  }

  private mapSeverity(
    sourceSeverity: string,
    map: Record<string, string>,
  ): SignalSeverity {
    const candidate = map[sourceSeverity] ?? map[sourceSeverity.toLowerCase()];
    if (candidate && VALID_SEVERITIES.has(candidate)) return candidate as SignalSeverity;
    if (VALID_SEVERITIES.has(sourceSeverity.toLowerCase()))
      return sourceSeverity.toLowerCase() as SignalSeverity;
    return 'medium';
  }

  /** Best-effort title from common raw-event field names when no mapping exists. */
  private inferTitle(raw: Record<string, unknown>): string {
    for (const key of ['title', 'short_description', 'name', 'summary', 'message', 'description']) {
      const v = raw[key];
      if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 255);
    }
    return '(no title)';
  }

  /** Resolve a dot-notation path against a plain object. */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, key) => {
      if (acc !== null && typeof acc === 'object' && !Array.isArray(acc)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}
