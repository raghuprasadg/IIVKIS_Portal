import { NextResponse } from 'next/server';

interface ChatRequestBody {
  content?: string;
  messages?: Array<{ role?: string; content?: string }>;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function buildOrchestratorCandidates(): string[] {
  const configured = [
    process.env['ORCHESTRATOR_URL'],
    process.env['NEXT_PUBLIC_ORCHESTRATOR_URL'],
  ].filter((v): v is string => Boolean(v && v.trim()));

  const expanded: string[] = [];
  for (const raw of configured) {
    const trimmed = raw.trim();
    expanded.push(trimmed);

    // In containerized runtime, localhost usually points to the portal container,
    // so also try the internal service DNS name.
    if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
      expanded.push(trimmed.replace('localhost', 'orchestrator').replace('127.0.0.1', 'orchestrator'));
    }
  }

  expanded.push('http://orchestrator:5000');
  expanded.push('http://127.0.0.1:5000');

  return [...new Set(expanded.map(normalizeBaseUrl))];
}

function normalizeMessages(input: ChatRequestBody['messages'], content: string) {
  if (!Array.isArray(input) || input.length === 0) {
    return [{ role: 'user', content }];
  }

  return input
    .filter((message): message is { role: string; content: string } => !!message?.role && !!message?.content)
    .map((message) => ({
      role: message.role === 'assistant' || message.role === 'system' ? message.role : 'user',
      content: String(message.content),
    }));
}

async function callOrchestrator(
  messages: Array<{ role: string; content: string }>,
  tenantId: string,
  userId: string,
) {

  const candidates = buildOrchestratorCandidates();
  const paths = ['/tasks', '/orchestrate'];
  const errors: string[] = [];

  for (const baseUrl of candidates) {
    for (const path of paths) {
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: crypto.randomUUID(),
            taskType: 'ts.chat.turn',
            tenantId,
            userId,
            traceId: crypto.randomUUID(),
            spanId: crypto.randomUUID(),
            payload: { sessionId: 'portal-route', messages },
            timeoutMs: 25000,
            createdAt: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(30000),
        });

        const payload = (await response.json().catch(() => ({}))) as {
          status?: string;
          result?: { content?: string };
          error?: { code?: string; message?: string };
        };

        if (!response.ok) {
          errors.push(`${baseUrl}${path} -> HTTP ${response.status}`);
          continue;
        }

        if (payload.status === 'failed') {
          const errCode = payload.error?.code ?? 'ORCHESTRATOR_FAILED';
          const errMsg = payload.error?.message ?? 'Orchestrator task failed.';
          throw new Error(`${errCode}: ${errMsg}`);
        }

        const content = payload.result?.content?.trim();
        if (content && content.length > 0) {
          return content;
        }

        // If orchestrator returned degraded/failed semantics without content,
        // surface it as an explicit error so the caller can render guidance.
        if (payload.error?.message) {
          throw new Error(payload.error.message);
        }

        throw new Error('No response returned by orchestrator.');
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        errors.push(`${baseUrl}${path} -> ${detail}`);
      }
    }
  }

  const checked = candidates.join(', ');
  const lastError = errors.length > 0 ? errors[errors.length - 1] : 'No endpoint attempted';
  throw new Error(`Could not reach orchestrator. Checked: ${checked}. Last error: ${lastError}`);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ChatRequestBody;
  const content = body.content?.trim();
  const tenantId = request.headers.get('x-dev-tenant-id') ?? process.env['PORTAL_TENANT_ID'] ?? 'tenant-uat';
  const userId = request.headers.get('x-dev-user-id') ?? process.env['PORTAL_USER_ID'] ?? 'portal-user';

  if (!content) {
    return NextResponse.json(
      { error: { message: 'content is required' } },
      { status: 400 },
    );
  }

  const messages = normalizeMessages(body.messages, content);

  try {
    const orchestratorReply = await callOrchestrator(messages, tenantId, userId);
    return NextResponse.json({ data: { role: 'assistant', content: orchestratorReply, status: 'success' } });
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'AI backend is unavailable.';
    const lowered = raw.toLowerCase();
    const message = lowered.includes('llm_unavailable') || lowered.includes('fetch failed')
      ? 'The orchestration service is reachable, but the configured LLM provider is unavailable. Check LLM_BASE_URL, LLM_API_KEY, and outbound network access from the orchestrator.'
      : raw;

    return NextResponse.json(
      { error: { message } },
      { status: 503 },
    );
  }
}
