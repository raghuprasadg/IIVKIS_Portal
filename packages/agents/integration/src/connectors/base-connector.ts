import { randomUUID } from 'crypto';
import type { Signal, SignalSeverity } from '@iivkis/shared';
import type {
  ConnectorI,
  ConnectorType,
  FieldMapping,
  IntegrationConfig,
  SyncResult,
  WebhookPayload,
} from './types';

const VALID_SEVERITIES: ReadonlySet<string> = new Set([
  'critical',
  'high',
  'medium',
  'low',
  'info',
]);

/** Abstract base providing common connector utilities. */
export abstract class BaseConnector implements ConnectorI {
  abstract readonly type: ConnectorType;
  abstract readonly version: string;

  abstract testConnection(config: IntegrationConfig): Promise<boolean>;
  abstract sync(config: IntegrationConfig, since?: Date): Promise<SyncResult>;
  abstract processWebhook(
    payload: WebhookPayload,
    config: IntegrationConfig,
  ): Promise<Signal[]>;

  /**
   * Apply configured field mappings from a raw source record to a partial Signal.
   * Supports dot-notation source paths and optional value transforms.
   */
  protected applyFieldMappings(
    source: Record<string, unknown>,
    mappings: FieldMapping[],
  ): Partial<Signal> {
    const result: Partial<Signal> = {};
    for (const mapping of mappings) {
      const value = this.getNestedValue(source, mapping.sourceField);
      if (value === undefined) continue;

      let transformed: unknown = value;
      switch (mapping.transform) {
        case 'lowercase':
          transformed = typeof value === 'string' ? value.toLowerCase() : value;
          break;
        case 'uppercase':
          transformed = typeof value === 'string' ? value.toUpperCase() : value;
          break;
        case 'trim':
          transformed = typeof value === 'string' ? value.trim() : value;
          break;
        case 'severity_map':
          if (typeof value === 'string' && mapping.severityMap) {
            transformed = this.mapSeverity(value, mapping.severityMap);
          }
          break;
        default:
          break;
      }
      // We intentionally use a dynamic key write here for mapping flexibility.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as Record<string, unknown>)[mapping.targetField as string] = transformed;
    }
    return result;
  }

  /** Build a complete Signal from a partial, filling in required defaults. */
  protected createSignal(partial: Partial<Signal>): Signal {
    const now = new Date().toISOString();
    // Build required fields first, then conditionally spread optional ones to
    // satisfy `exactOptionalPropertyTypes` (no explicit `undefined` values).
    return {
      externalId: partial.externalId ?? randomUUID(),
      signalType: partial.signalType ?? 'incident',
      sourceSystem: partial.sourceSystem ?? this.type,
      severity: partial.severity ?? 'medium',
      title: partial.title ?? '(no title)',
      occurredAt: partial.occurredAt ?? now,
      ...(partial.description !== undefined && { description: partial.description }),
      ...(partial.affectedCiId !== undefined && { affectedCiId: partial.affectedCiId }),
      ...(partial.rawPayload !== undefined && { rawPayload: partial.rawPayload }),
    };
  }

  /**
   * Map a source severity string to a canonical SignalSeverity.
   * Falls back to 'medium' when the mapped value is unknown.
   */
  protected mapSeverity(
    sourceSeverity: string,
    map: Record<string, string>,
  ): SignalSeverity {
    const candidate = map[sourceSeverity] ?? map[sourceSeverity.toLowerCase()];
    if (candidate && VALID_SEVERITIES.has(candidate)) {
      return candidate as SignalSeverity;
    }
    if (VALID_SEVERITIES.has(sourceSeverity.toLowerCase())) {
      return sourceSeverity.toLowerCase() as SignalSeverity;
    }
    return 'medium';
  }

  /** Build HTTP auth headers from connector auth configuration. */
  protected getHeader(config: IntegrationConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const { auth } = config;
    switch (auth.type) {
      case 'basic':
        if (auth.username !== undefined && auth.password !== undefined) {
          const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          headers['Authorization'] = `Basic ${encoded}`;
        }
        break;
      case 'api_key':
        if (auth.apiKey !== undefined) {
          headers[auth.apiKeyHeader ?? 'X-Api-Key'] = auth.apiKey;
        }
        break;
      case 'oauth2':
        if (auth.accessToken !== undefined) {
          headers['Authorization'] = `Bearer ${auth.accessToken}`;
        }
        break;
      case 'token':
        if (auth.token !== undefined) {
          headers['Authorization'] = `Token token=${auth.token}`;
        }
        break;
    }
    return headers;
  }

  protected logSync(message: string, data?: unknown): void {
    const ts = new Date().toISOString();
    if (data !== undefined) {
      console.log(`[${ts}] [${this.type}] ${message}`, data);
    } else {
      console.log(`[${ts}] [${this.type}] ${message}`);
    }
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

  /** Return true when the baseUrl signals a stub environment. */
  protected isStub(config: IntegrationConfig): boolean {
    return (
      config.baseUrl.includes('localhost') ||
      config.baseUrl.includes('example.com') ||
      config.baseUrl === ''
    );
  }

  /** Build an empty SyncResult for stub / no-op responses. */
  protected emptyResult(
    config: IntegrationConfig,
    startedAt: string,
    note?: string,
  ): SyncResult {
    const completedAt = new Date().toISOString();
    const durationMs =
      new Date(completedAt).getTime() - new Date(startedAt).getTime();
    return {
      integrationId: config.id,
      connectorType: config.connectorType,
      mode: config.syncMode,
      recordsTotal: 0,
      recordsNew: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      signalsEmitted: [],
      errors: note
        ? [{ message: note, retryable: false }]
        : [],
      startedAt,
      completedAt,
      durationMs,
    };
  }
}
