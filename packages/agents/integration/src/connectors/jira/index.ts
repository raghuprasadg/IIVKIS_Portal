import type { Signal, SignalSeverity } from '@iivkis/shared';
import { BaseConnector } from '../base-connector';
import type { IntegrationConfig, SyncResult, WebhookPayload } from '../types';
import type { JiraIssue, JiraSearchResponse, JiraWebhookBody } from './types';

const JIRA_PRIORITY_MAP: Record<string, SignalSeverity> = {
  highest: 'critical',
  high: 'critical',
  medium: 'medium',
  low: 'low',
  lowest: 'low',
};

export class JiraConnector extends BaseConnector {
  readonly type = 'jira' as const;
  readonly version = '1.0.0';

  async testConnection(config: IntegrationConfig): Promise<boolean> {
    if (this.isStub(config)) return true;
    try {
      const url = `${config.baseUrl}/rest/api/3/myself`;
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
      return this.emptyResult(config, startedAt, 'Stub mode — no real Jira endpoint');
    }

    const signals: Signal[] = [];
    const errors: SyncResult['errors'] = [];

    try {
      const project = (config.metadata?.['jiraProject'] as string | undefined) ?? 'OPS';
      const sinceClause = since
        ? ` AND created>="${since.toISOString().split('T')[0]}"`
        : '';
      const jql = `project=${project}${sinceClause} ORDER BY created ASC`;
      const fields = 'summary,description,priority,status,created,assignee,labels';

      const params = new URLSearchParams({
        jql,
        fields,
        maxResults: '100',
      });

      const url = `${config.baseUrl}/rest/api/3/search?${params.toString()}`;
      this.logSync('Fetching Jira issues', { url, mode: config.syncMode });

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
              message: `Jira API error ${resp.status}: ${text}`,
              retryable: resp.status >= 500,
            },
          ],
        };
      }

      const data = (await resp.json()) as JiraSearchResponse;
      const issues: JiraIssue[] = data.issues ?? [];

      for (const issue of issues) {
        try {
          const mapped = config.fieldMappings.length
            ? this.applyFieldMappings(issue as unknown as Record<string, unknown>, config.fieldMappings)
            : {};

          const priorityName = (issue.fields.priority?.name ?? 'medium').toLowerCase();
          const severity =
            (mapped.severity as SignalSeverity | undefined) ??
            JIRA_PRIORITY_MAP[priorityName] ??
            'medium';

          const signal = this.createSignal({
            externalId: `jira-${issue.id}`,
            signalType: 'incident',
            sourceSystem: 'jira',
            title: issue.fields.summary,
            severity,
            occurredAt: new Date(issue.fields.created).toISOString(),
            rawPayload: issue as unknown as Record<string, unknown>,
            ...mapped,
          });
          signals.push(signal);
        } catch (err) {
          errors.push({
            recordId: issue.id,
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
    const body = payload.rawBody as JiraWebhookBody;
    const issue = body.issue;
    if (!issue) return [];

    const mapped = config.fieldMappings.length
      ? this.applyFieldMappings(payload.rawBody, config.fieldMappings)
      : {};

    const priorityName = (issue.fields?.priority?.name ?? 'medium').toLowerCase();
    const severity =
      (mapped.severity as SignalSeverity | undefined) ??
      JIRA_PRIORITY_MAP[priorityName] ??
      'medium';

    const signal = this.createSignal({
      externalId: `jira-${issue.id}`,
      signalType: 'incident',
      sourceSystem: 'jira',
      title: issue.fields?.summary ?? '(no summary)',
      severity,
      occurredAt: issue.fields?.created
        ? new Date(issue.fields.created).toISOString()
        : payload.receivedAt,
      rawPayload: payload.rawBody,
      ...mapped,
    });

    return [signal];
  }
}
