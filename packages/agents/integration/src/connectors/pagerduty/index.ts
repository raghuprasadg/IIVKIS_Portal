import type { Signal, SignalSeverity } from '@iivkis/shared';
import { BaseConnector } from '../base-connector';
import type { IntegrationConfig, SyncResult, WebhookPayload } from '../types';
import type { PDIncident, PDIncidentsResponse, PDWebhookPayload } from './types';

const PD_URGENCY_MAP: Record<string, SignalSeverity> = {
  high: 'critical',
  low: 'medium',
};

const PD_API_BASE = 'https://api.pagerduty.com';

export class PagerDutyConnector extends BaseConnector {
  readonly type = 'pagerduty' as const;
  readonly version = '1.0.0';

  async testConnection(config: IntegrationConfig): Promise<boolean> {
    if (this.isStub(config)) return true;
    try {
      const resp = await fetch(`${PD_API_BASE}/abilities`, {
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
      return this.emptyResult(config, startedAt, 'Stub mode — no real PagerDuty endpoint');
    }

    const signals: Signal[] = [];
    const errors: SyncResult['errors'] = [];

    try {
      const params = new URLSearchParams({
        limit: '100',
        'statuses[]': 'triggered',
        'sort_by': 'created_at',
      });
      if (since) {
        params.set('since', since.toISOString());
      }

      const url = `${PD_API_BASE}/incidents?${params.toString()}`;
      this.logSync('Fetching PagerDuty incidents', { url, mode: config.syncMode });

      const resp = await fetch(url, {
        headers: {
          ...this.getHeader(config),
          'Accept': 'application/vnd.pagerduty+json;version=2',
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        return {
          ...this.emptyResult(config, startedAt),
          errors: [
            {
              message: `PagerDuty API error ${resp.status}: ${text}`,
              retryable: resp.status >= 500,
            },
          ],
        };
      }

      const data = (await resp.json()) as PDIncidentsResponse;
      const incidents: PDIncident[] = data.incidents ?? [];

      for (const inc of incidents) {
        try {
          const mapped = config.fieldMappings.length
            ? this.applyFieldMappings(inc as unknown as Record<string, unknown>, config.fieldMappings)
            : {};

          const severity =
            (mapped.severity as SignalSeverity | undefined) ??
            PD_URGENCY_MAP[inc.urgency] ??
            'medium';

          const signal = this.createSignal({
            externalId: `pd-${inc.id}`,
            signalType: 'incident',
            sourceSystem: 'pagerduty',
            title: inc.title,
            severity,
            occurredAt: new Date(inc.created_at).toISOString(),
            rawPayload: inc as unknown as Record<string, unknown>,
            ...mapped,
          });
          signals.push(signal);
        } catch (err) {
          errors.push({
            recordId: inc.id,
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
    const body = payload.rawBody as Partial<PDWebhookPayload>;
    const event = body.event;
    if (!event) return [];

    const eventType = event.event_type ?? '';
    const incData = event.data;

    // Only process incident lifecycle events.
    if (
      !eventType.startsWith('incident.triggered') &&
      !eventType.startsWith('incident.acknowledged') &&
      !eventType.startsWith('incident.resolved')
    ) {
      return [];
    }

    const mapped = config.fieldMappings.length
      ? this.applyFieldMappings(payload.rawBody, config.fieldMappings)
      : {};

    const rawUrgency = (incData?.urgency ?? 'low') as string;
    const severity =
      (mapped.severity as SignalSeverity | undefined) ??
      PD_URGENCY_MAP[rawUrgency] ??
      'medium';

    const signal = this.createSignal({
      ...(incData?.id ? { externalId: `pd-${incData.id}` } : {}),
      signalType: 'incident',
      sourceSystem: 'pagerduty',
      title: incData?.title ?? incData?.description ?? eventType,
      severity,
      occurredAt: event.occurred_at
        ? new Date(event.occurred_at).toISOString()
        : payload.receivedAt,
      rawPayload: payload.rawBody,
      ...mapped,
    });

    return [signal];
  }
}
