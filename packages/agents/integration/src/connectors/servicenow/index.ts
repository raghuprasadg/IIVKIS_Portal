import type { Signal, SignalSeverity } from '@iivkis/shared';
import { BaseConnector } from '../base-connector';
import type { IntegrationConfig, SyncResult, WebhookPayload } from '../types';
import type { SNowIncident, SNowTableResponse, SNowWebhookBody } from './types';

const SNOW_SEVERITY_MAP: Record<string, SignalSeverity> = {
  '1': 'critical',
  '2': 'high',
  '3': 'medium',
  '4': 'low',
  '5': 'info',
};

/** Comma-separated incident fields requested from the Table API. */
const INCIDENT_FIELDS = [
  'sys_id',
  'number',
  'short_description',
  'description',
  'severity',
  'state',
  'opened_at',
  'cmdb_ci',
  'assigned_to',
].join(',');

export class ServiceNowConnector extends BaseConnector {
  readonly type = 'servicenow' as const;
  readonly version = '1.0.0';

  async testConnection(config: IntegrationConfig): Promise<boolean> {
    if (this.isStub(config)) return true;
    try {
      const url = `${config.baseUrl}/api/now/table/incident?sysparm_limit=1`;
      const resp = await fetch(url, {
        headers: this.getHeader(config),
        signal: AbortSignal.timeout(10_000),
      });
      return resp.ok;
    } catch (err) {
      this.logSync('testConnection failed', err);
      return false;
    }
  }

  async sync(config: IntegrationConfig, since?: Date): Promise<SyncResult> {
    const startedAt = new Date().toISOString();

    if (this.isStub(config)) {
      return this.emptyResult(config, startedAt, 'Stub mode — no real ServiceNow endpoint');
    }

    const signals: Signal[] = [];
    const errors: SyncResult['errors'] = [];

    try {
      const sinceTs = since
        ? since.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')
        : '';

      const query = sinceTs
        ? `sysparm_query=sys_created_on>=${sinceTs}`
        : 'sysparm_query=active=true';

      const url =
        `${config.baseUrl}/api/now/table/incident` +
        `?sysparm_limit=100` +
        `&sysparm_fields=${encodeURIComponent(INCIDENT_FIELDS)}` +
        `&${query}`;

      this.logSync('Fetching incidents', { url, mode: config.syncMode });

      const resp = await fetch(url, {
        headers: this.getHeader(config),
        signal: AbortSignal.timeout(30_000),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        return {
          ...this.emptyResult(config, startedAt),
          errors: [
            {
              message: `ServiceNow API error ${resp.status}: ${text}`,
              retryable: resp.status >= 500,
            },
          ],
        };
      }

      const data = (await resp.json()) as SNowTableResponse<SNowIncident>;
      const incidents = data.result ?? [];

      for (const inc of incidents) {
        try {
          const mapped = config.fieldMappings.length
            ? this.applyFieldMappings(inc as unknown as Record<string, unknown>, config.fieldMappings)
            : {};

          const severity =
            (mapped.severity as SignalSeverity | undefined) ??
            SNOW_SEVERITY_MAP[inc.severity] ??
            'medium';

          const signal = this.createSignal({
            externalId: `snow-${inc.sys_id}`,
            signalType: 'incident',
            sourceSystem: 'servicenow',
            title: inc.short_description,
            severity,
            occurredAt: new Date(inc.opened_at).toISOString(),
            rawPayload: inc as unknown as Record<string, unknown>,
            ...(inc.description !== undefined && { description: inc.description }),
            ...(inc.cmdb_ci?.value !== undefined && { affectedCiId: inc.cmdb_ci.value }),
            ...mapped,
          });
          signals.push(signal);
        } catch (err) {
          errors.push({
            recordId: inc.sys_id,
            message: err instanceof Error ? err.message : String(err),
            retryable: false,
          });
        }
      }
    } catch (err) {
      errors.push({
        message: err instanceof Error ? err.message : String(err),
        retryable: true,
      });
    }

    const completedAt = new Date().toISOString();
    return {
      integrationId: config.id,
      connectorType: this.type,
      mode: config.syncMode,
      recordsTotal: signals.length + errors.length,
      recordsNew: signals.length,
      recordsUpdated: 0,
      recordsSkipped: 0,
      signalsEmitted: signals,
      errors,
      startedAt,
      completedAt,
      durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
    };
  }

  async processWebhook(
    payload: WebhookPayload,
    config: IntegrationConfig,
  ): Promise<Signal[]> {
    const body = payload.rawBody as SNowWebhookBody;

    // Accept either a nested incident object or flat fields at root.
    const inc = body.incident ?? (body as Partial<SNowIncident>);
    const sysId = (inc.sys_id ?? body['table_sys_id'] ?? 'unknown') as string;
    const shortDesc =
      (inc.short_description ?? body['short_description'] ?? '(no description)') as string;
    const rawSeverity = (inc.severity ?? body['severity'] ?? '3') as string;

    const mapped = config.fieldMappings.length
      ? this.applyFieldMappings(body as Record<string, unknown>, config.fieldMappings)
      : {};

    const severity =
      (mapped.severity as SignalSeverity | undefined) ??
      SNOW_SEVERITY_MAP[rawSeverity] ??
      'medium';

    const signal = this.createSignal({
      externalId: `snow-${sysId}`,
      signalType: 'incident',
      sourceSystem: 'servicenow',
      title: shortDesc,
      severity,
      occurredAt: inc.opened_at
        ? new Date(inc.opened_at as string).toISOString()
        : payload.receivedAt,
      rawPayload: body as Record<string, unknown>,
      ...(inc.description ? { description: inc.description as string } : {}),
      ...mapped,
    });

    return [signal];
  }
}
