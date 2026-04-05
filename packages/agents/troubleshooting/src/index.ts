/**
 * Troubleshooting Agent
 *
 * Responsibilities:
 *  - Receive incident reports from the orchestrator
 *  - Analyse symptoms against the vendor knowledge base
 *  - Generate step-by-step resolution plans
 *
 * Supports live chat turns via an OpenAI-compatible endpoint.
 */
import type { AgentRequest, AgentResponse } from '@iivkis/shared';

export const AGENT_ID = 'agent-troubleshooting' as const;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatPayload {
  messages?: Array<{ role?: string; content?: string }>;
}

interface IncidentHint {
  id: string;
  title: string;
  source: string;
  status: string;
  tags: string[];
  summary: string;
  nextActions: string[];
  correlationId?: string;
  correlationSummary?: string;
}

interface KnowledgeHint {
  id: string;
  title: string;
  tags: string[];
  summary: string;
  nextActions: string[];
}

const KNOWLEDGE_HINTS: KnowledgeHint[] = [
  {
    id: 'KA-0821',
    title: 'ServiceNow MID Server Connection Pool Exhaustion',
    tags: ['servicenow', 'timeout', 'mid', 'connection', 'pool', 'inc-2401'],
    summary: 'ServiceNow API timeouts are commonly caused by MID thread starvation and exhausted HTTP pools.',
    nextActions: [
      'Validate MID Server health and active thread counts.',
      'Review recent integration worker changes and retry settings.',
      'Check whether connection-pool saturation lines up with the incident start time.',
    ],
  },
  {
    id: 'KA-0634',
    title: 'Vault PKI Certificate Renewal Runbook',
    tags: ['vault', 'certificate', 'pki', 'tls', 'renewal', 'inc-2398'],
    summary: 'Expiring certificates usually map to failed PKI renewal jobs or RBAC drift in renewal namespaces.',
    nextActions: [
      'Confirm current certificate expiry and issuer chain.',
      'Run the PKI renewal workflow and inspect RBAC failures.',
      'Plan a controlled restart after propagation succeeds.',
    ],
  },
  {
    id: 'KA-1102',
    title: 'Neo4j Latency After Unbounded Traversal Queries',
    tags: ['neo4j', 'latency', 'cypher', 'index'],
    summary: 'P95 query spikes often follow unbounded traversals and index fragmentation after imports.',
    nextActions: [
      'Run query profiles for top offenders.',
      'Inspect index health and stalled populations.',
      'Throttle ingestion while rebuilding impacted indexes.',
    ],
  },
  {
    id: 'KA-1320',
    title: 'Network Edge Incident Correlation',
    tags: ['cisco', 'palo alto', 'fortinet', 'f5', 'network', 'firewall', 'router', 'bgp', 'inc-2351', 'inc-2350', 'inc-2348', 'inc-2347'],
    summary: 'Edge incidents correlate best when config-change windows and traffic anomalies overlap on shared CIs.',
    nextActions: [
      'Cross-check change records +/- 15 minutes around the first alert.',
      'Confirm CI overlap across routers, firewalls, and ADC nodes.',
      'Use grouped escalation only after confidence stays above 70%.',
    ],
  },
];

const INCIDENT_HINTS: IncidentHint[] = [
  {
    id: 'INC-2401',
    title: 'ServiceNow API timeout cascade',
    source: 'ServiceNow',
    status: 'In Progress',
    tags: ['servicenow', 'timeout', 'integration'],
    summary: 'Timeouts suggest connector worker saturation and upstream pool exhaustion.',
    nextActions: [
      'Validate MID Server thread pressure and connection pool exhaustion.',
      'Compare retry storms with the latest integration change window.',
      'Confirm whether the snow-conn-pool backlog is still growing.',
    ],
    correlationId: 'CG-041',
    correlationSummary: 'API Timeout + DB Slow Query Cluster at 87% confidence.',
  },
  {
    id: 'INC-2351',
    title: 'Cisco core router BGP flap storm',
    source: 'Cisco',
    status: 'Investigating',
    tags: ['cisco', 'router', 'bgp', 'network'],
    summary: 'Repeated route flaps point to edge instability or config drift across the network boundary.',
    nextActions: [
      'Check recent route-policy or neighbor changes before the first flap.',
      'Validate whether packet loss and control-plane CPU spikes overlap on the same edge nodes.',
      'Confirm if related firewall or load-balancer alerts belong to the same network event.',
    ],
    correlationId: 'CG-052',
    correlationSummary: 'Network Edge Config Drift cluster at 79% confidence.',
  },
  {
    id: 'INC-2350',
    title: 'Palo Alto policy push rollback',
    source: 'Palo Alto',
    status: 'In Progress',
    tags: ['palo alto', 'firewall', 'policy'],
    summary: 'Rollback patterns usually indicate deny-rule drift or invalid dependency ordering during policy push.',
    nextActions: [
      'Compare the failed policy set against the last known good commit.',
      'Validate whether a deny-all drift triggered the rollback protection.',
      'Check whether Cisco or F5 edge alerts started in the same window.',
    ],
    correlationId: 'CG-052',
    correlationSummary: 'Network Edge Config Drift cluster at 79% confidence.',
  },
  {
    id: 'INC-2348',
    title: 'Fortinet HA failover jitter',
    source: 'Fortinet',
    status: 'Monitoring',
    tags: ['fortinet', 'ha', 'firewall'],
    summary: 'Failover jitter usually reflects heartbeat instability or state-sync lag across HA peers.',
    nextActions: [
      'Inspect HA heartbeat loss and state-sync latency.',
      'Confirm whether failover frequency increased after a config push.',
      'Verify downstream traffic recovery before declaring the event stable.',
    ],
    correlationId: 'CG-052',
    correlationSummary: 'Network Edge Config Drift cluster at 79% confidence.',
  },
  {
    id: 'INC-2347',
    title: 'F5 BIG-IP iRule regression',
    source: 'F5',
    status: 'Open',
    tags: ['f5', 'bigip', 'irule', 'load balancer'],
    summary: 'iRule regressions commonly surface as selective traffic failures after policy or template changes.',
    nextActions: [
      'Diff the active iRule against the last stable deployment.',
      'Check whether the regression aligns with upstream network policy changes.',
      'Validate recovery using live traffic and pool-member health.',
    ],
    correlationId: 'CG-052',
    correlationSummary: 'Network Edge Config Drift cluster at 79% confidence.',
  },
];

function buildProviderHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const referer = process.env['LLM_HTTP_REFERER']?.trim();
  const title = process.env['LLM_APP_TITLE']?.trim();

  if (referer) headers['HTTP-Referer'] = referer;
  if (title) headers['X-Title'] = title;

  return headers;
}

function normalizeMessages(input: ChatPayload['messages']): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m): m is { role: string; content: string } => !!m?.role && !!m?.content)
    .map((m) => ({
      role: m.role === 'assistant' || m.role === 'system' ? m.role : 'user',
      content: String(m.content),
    }));
}

function getLatestUserMessage(messages: ChatMessage[]): string {
  return [...messages].reverse().find((message) => message.role === 'user')?.content?.trim() ?? '';
}

function findIncidentHint(text: string): IncidentHint | undefined {
  const normalized = text.toLowerCase();
  return INCIDENT_HINTS.find((candidate) => normalized.includes(candidate.id.toLowerCase()))
    ?? INCIDENT_HINTS.find((candidate) => candidate.tags.some((tag) => normalized.includes(tag)));
}

function findKnowledgeHints(text: string, limit = 2): KnowledgeHint[] {
  const normalized = text.toLowerCase();
  return KNOWLEDGE_HINTS
    .map((hint) => ({
      hint,
      score: hint.tags.reduce((count, tag) => count + (normalized.includes(tag) ? 1 : 0), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.hint);
}

function buildGuidanceContext(messages: ChatMessage[]): string {
  const latestUserMessage = getLatestUserMessage(messages);
  const incident = findIncidentHint(latestUserMessage);
  const knowledge = findKnowledgeHints(latestUserMessage);

  const lines = [
    'You are the IIVKIS troubleshooting copilot.',
    'Give incident-specific triage guidance, not a generic checklist.',
    'If an incident ID or vendor is known, use that exact context in the answer.',
    'Do not output tables.',
    'Keep the answer under 220 words.',
    'Use this structure exactly:',
    'Summary: ...',
    'Likely cause: ...',
    'Correlation: ...',
    'Next actions:',
    '1. ...',
    '2. ...',
    '3. ...',
    'Confidence: ...',
  ];

  if (incident) {
    lines.push('');
    lines.push('Known incident context:');
    lines.push(`- Incident ID: ${incident.id}`);
    lines.push(`- Title: ${incident.title}`);
    lines.push(`- Source: ${incident.source}`);
    lines.push(`- Status: ${incident.status}`);
    lines.push(`- Assessment: ${incident.summary}`);
    if (incident.correlationId && incident.correlationSummary) {
      lines.push(`- Correlation: ${incident.correlationId} — ${incident.correlationSummary}`);
    }
    lines.push(`- Priority actions: ${incident.nextActions.join(' | ')}`);
  }

  if (knowledge.length > 0) {
    lines.push('');
    lines.push('Relevant knowledge:');
    for (const hint of knowledge) {
      lines.push(`- ${hint.id} — ${hint.title}: ${hint.summary}`);
      lines.push(`- Suggested actions from ${hint.id}: ${hint.nextActions.join(' | ')}`);
    }
  }

  if (!incident && knowledge.length === 0) {
    lines.push('');
    lines.push('If the user did not provide enough context, ask one precise follow-up question.');
  }

  return lines.join('\n');
}

function buildLocalChatResponse(messages: ChatMessage[]): string {
  const latestUserMessage = getLatestUserMessage(messages);

  if (!latestUserMessage) {
    return [
      'IIVKIS local troubleshooting guidance is active.',
      'Summary: no user question was provided.',
      'Next steps: share the incident ID, current symptoms, recent changes, and affected services to generate a guided triage plan.',
      'Confidence: medium.',
    ].join(' ');
  }

  const incident = findIncidentHint(latestUserMessage);
  const rankedKnowledge = findKnowledgeHints(latestUserMessage);

  const primaryKnowledge = rankedKnowledge[0];

  const lines: string[] = [];
  lines.push('IIVKIS local troubleshooting guidance is active.');

  if (incident) {
    lines.push('');
    lines.push(`Incident: ${incident.id} — ${incident.title} [${incident.status}] from ${incident.source}.`);
    lines.push(`Assessment: ${incident.summary}`);
    if (incident.correlationId && incident.correlationSummary) {
      lines.push(`Correlation: ${incident.correlationId} — ${incident.correlationSummary}`);
    }
  } else {
    lines.push('');
    lines.push(`Observed request: ${latestUserMessage}`);
  }

  if (rankedKnowledge.length > 0) {
    lines.push('');
    lines.push('Relevant knowledge:');
    for (const hint of rankedKnowledge) {
      lines.push(`- ${hint.id} — ${hint.title}: ${hint.summary}`);
    }
  }

  const actionSource = incident?.nextActions ?? primaryKnowledge?.nextActions;
  if (actionSource && actionSource.length > 0) {
    lines.push('');
    lines.push('Recommended next actions:');
    actionSource.forEach((step, index) => {
      lines.push(`${index + 1}. ${step}`);
    });
  } else {
    lines.push('');
    lines.push('Recommended next actions:');
    lines.push('1. Confirm blast radius and affected services.');
    lines.push('2. Compare recent alerts, changes, and correlated incidents in the same time window.');
    lines.push('3. Validate recovery evidence before closing the incident.');
  }

  lines.push('');
  lines.push('Confidence: medium because this response is generated from local incident and knowledge context rather than a live provider.');

  return lines.join('\n');
}

async function handleChatTurn(request: AgentRequest, start: number): Promise<AgentResponse> {
  const apiKey = process.env['LLM_API_KEY'];
  const baseUrl = process.env['LLM_BASE_URL'] ?? 'https://api.openai.com/v1';
  const model = process.env['LLM_MODEL_FAST'] ?? 'gpt-4o-mini';
  const payload = request.payload as ChatPayload;
  const history = normalizeMessages(payload.messages);

  if (!apiKey) {
    return {
      taskId: request.taskId,
      status: 'success',
      tenantId: request.tenantId,
      result: {
        content: buildLocalChatResponse(history),
      },
      modelUsed: 'local-troubleshooting',
      latencyMs: Date.now() - start,
      createdAt: new Date().toISOString(),
    };
  }

  const systemPrompt: ChatMessage = {
    role: 'system',
    content: buildGuidanceContext(history),
  };

  const messages = [systemPrompt, ...history].slice(-24);

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildProviderHeaders(apiKey),
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 320,
        messages,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      return {
        taskId: request.taskId,
        status: 'failed',
        tenantId: request.tenantId,
        error: {
          code: 'LLM_HTTP_ERROR',
          message: `LLM provider returned HTTP ${resp.status}${detail ? `: ${detail}` : ''}`,
          retryable: resp.status >= 500,
        },
        latencyMs: Date.now() - start,
        createdAt: new Date().toISOString(),
      };
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
      model?: string;
    };

    const content = data.choices?.[0]?.message?.content?.trim() ??
      'No content returned by provider.';

    return {
      taskId: request.taskId,
      status: 'success',
      tenantId: request.tenantId,
      result: { content },
      modelUsed: data.model ?? model,
      ...(data.usage?.total_tokens !== undefined && { tokensUsed: data.usage.total_tokens }),
      latencyMs: Date.now() - start,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      taskId: request.taskId,
      status: 'failed',
      tenantId: request.tenantId,
      error: {
        code: 'LLM_UNAVAILABLE',
        message: err instanceof Error ? err.message : String(err),
        retryable: true,
      },
      latencyMs: Date.now() - start,
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Handle a troubleshooting task request.
 */
export async function handle(request: AgentRequest): Promise<AgentResponse> {
  const start = Date.now();

  if (request.taskType === 'ts.chat.turn') {
    return handleChatTurn(request, start);
  }

  return {
    taskId: request.taskId,
    status: 'degraded',
    tenantId: request.tenantId,
    result: {
      content: 'Troubleshooting plan generation is not fully implemented for this task type yet.',
    },
    latencyMs: Date.now() - start,
    createdAt: new Date().toISOString(),
  };
}
