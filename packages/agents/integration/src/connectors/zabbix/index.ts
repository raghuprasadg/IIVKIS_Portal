import type { Signal, SignalSeverity } from '@iivkis/shared';
import { BaseConnector } from '../base-connector';
import type { IntegrationConfig, SyncResult, WebhookPayload } from '../types';
import type {
  ZabbixApiResponse,
  ZabbixProblem,
  ZabbixWebhookBody,
} from './types';

const ZABBIX_SEVERITY_MAP: Record<string, SignalSeverity> = {
  '0': 'info',       // Not classified
  '1': 'info',       // Information
  '2': 'low',        // Warning
  '3': 'medium',     // Average
  '4': 'high',       // High
  '5': 'critical',   // Disaster
};

export class ZabbixConnector extends BaseConnector {
  readonly type = 'zabbix' as const;
  readonly version = '1.0.0';

  /** Perform a Zabbix JSON-RPC call. */
  private async rpc<T>(
    config: IntegrationConfig,
    method: string,
    params: Record<string, unknown>,
    authToken?: string,
  ): Promise<ZabbixApiResponse<T>> {
    const url = `${config.baseUrl}/api_jsonrpc.php`;
    const body = {
      jsonrpc: '2.0',
      method,
      params,
      auth: authToken ?? null,
      id: 1,
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      throw new Error(`Zabbix HTTP error ${resp.status}`);
    }
    return (await resp.json()) as ZabbixApiResponse<T>;
  }

  /** Obtain a session token via user.login. */
  private async login(config: IntegrationConfig): Promise<string> {
    const { auth } = config;
    const result = await this.rpc<string>(config, 'user.login', {
      user: auth.username ?? '',
      password: auth.password ?? '',
    });
    return result.result;
  }

  async testConnection(config: IntegrationConfig): Promise<boolean> {
    if (this.isStub(config)) return true;
    try {
      const token = await this.login(config);
      return typeof token === 'string' && token.length > 0;
    } catch (err) {
      this.logSync('testConnection failed', err);
      return false;
    }
  }

  async sync(config: IntegrationConfig, since?: Date): Promise<SyncResult> {
    const startedAt = new Date().toISOString();

    if (this.isStub(config)) {
      return this.emptyResult(config, startedAt, 'Stub mode — no real Zabbix endpoint');
    }

    const signals: Signal[] = [];
    const errors: SyncResult['errors'] = [];

    try {
      const token = await this.login(config);

      const problemParams: Record<string, unknown> = {
        output: 'extend',
        sortfield: ['eventid'],
        sortorder: 'ASC',
        limit: 100,
      };

      if (since) {
        problemParams['time_from'] = Math.floor(since.getTime() / 1000);
      }

      this.logSync('Fetching Zabbix problems', { mode: config.syncMode });

      const problemsResp = await this.rpc<ZabbixProblem[]>(
        config,
        'problem.get',
        problemParams,
        token,
      );

      const problems: ZabbixProblem[] = problemsResp.result ?? [];

      for (const problem of problems) {
        try {
          const mapped = config.fieldMappings.length
            ? this.applyFieldMappings(
                problem as unknown as Record<string, unknown>,
                config.fieldMappings,
              )
            : {};

          const severity =
            (mapped.severity as SignalSeverity | undefined) ??
            ZABBIX_SEVERITY_MAP[problem.severity] ??
            'medium';

          const signal = this.createSignal({
            externalId: `zabbix-${problem.eventid}`,
            signalType: 'monitoring_alert',
            sourceSystem: 'zabbix',
            title: problem.name,
            severity,
            occurredAt: new Date(parseInt(problem.clock, 10) * 1000).toISOString(),
            rawPayload: problem as unknown as Record<string, unknown>,
            ...mapped,
          });
          signals.push(signal);
        } catch (err) {
          errors.push({
            recordId: problem.eventid,
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
    const body = payload.rawBody as ZabbixWebhookBody;

    const mapped = config.fieldMappings.length
      ? this.applyFieldMappings(payload.rawBody, config.fieldMappings)
      : {};

    const rawSeverity = (body.severity ?? '0') as string;
    const severity =
      (mapped.severity as SignalSeverity | undefined) ??
      ZABBIX_SEVERITY_MAP[rawSeverity] ??
      'medium';

    const clockMs = body.clock
      ? parseInt(body.clock as string, 10) * 1000
      : Date.now();

    const signal = this.createSignal({
      ...(body.eventid ? { externalId: `zabbix-${body.eventid as string}` } : {}),
      signalType: 'monitoring_alert',
      sourceSystem: 'zabbix',
      title: (body.name ?? '(no name)') as string,
      severity,
      occurredAt: new Date(clockMs).toISOString(),
      rawPayload: payload.rawBody,
      ...mapped,
    });

    return [signal];
  }
}
