/**
 * Connector SDK — shared contract for all integration connectors.
 */
import type { Signal } from '@iivkis/shared';

export type ConnectorType = 'servicenow' | 'pagerduty' | 'jira' | 'zabbix' | 'custom';
export type SyncMode = 'full' | 'incremental';
export type AuthType = 'basic' | 'oauth2' | 'api_key' | 'token';

/** Integration configuration stored in the DB. */
export interface IntegrationConfig {
  id: string;
  tenantId: string;
  connectorType: ConnectorType;
  displayName: string;
  baseUrl: string;
  auth: ConnectorAuth;
  syncMode: SyncMode;
  syncIntervalMinutes: number;
  fieldMappings: FieldMapping[];
  /** HMAC secret for inbound webhooks. */
  webhookSecret?: string;
  enabled: boolean;
  lastSyncAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectorAuth {
  type: AuthType;
  // basic
  username?: string;
  password?: string;
  // api_key
  apiKey?: string;
  /** Default: 'X-Api-Key' */
  apiKeyHeader?: string;
  // oauth2
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  // bearer token
  token?: string;
}

export interface FieldMapping {
  /** Field path in source system — dot-notation supported. */
  sourceField: string;
  targetField: keyof Signal | string;
  transform?: 'lowercase' | 'uppercase' | 'trim' | 'severity_map';
  /** Used with transform 'severity_map': source value → SignalSeverity. */
  severityMap?: Record<string, string>;
}

export interface SyncResult {
  integrationId: string;
  connectorType: ConnectorType;
  mode: SyncMode;
  recordsTotal: number;
  recordsNew: number;
  recordsUpdated: number;
  recordsSkipped: number;
  signalsEmitted: Signal[];
  errors: SyncError[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface SyncError {
  recordId?: string;
  message: string;
  retryable: boolean;
}

export interface WebhookPayload {
  integrationId: string;
  connectorType: ConnectorType;
  rawBody: Record<string, unknown>;
  signature?: string;
  receivedAt: string;
}

/** The Connector SDK contract every connector must satisfy. */
export interface ConnectorI {
  readonly type: ConnectorType;
  readonly version: string;
  /** Test connectivity and auth. Returns true if healthy. */
  testConnection(config: IntegrationConfig): Promise<boolean>;
  /** Fetch and normalise records, emit Signal[]. */
  sync(config: IntegrationConfig, since?: Date): Promise<SyncResult>;
  /** Process inbound webhook payload → Signal[]. */
  processWebhook(payload: WebhookPayload, config: IntegrationConfig): Promise<Signal[]>;
}
