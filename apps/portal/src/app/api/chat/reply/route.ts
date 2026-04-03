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

async function callOrchestrator(messages: Array<{ role: string; content: string }>) {
  const tenantId = process.env['PORTAL_TENANT_ID'] ?? 'tenant-uat';
  const userId = process.env['PORTAL_USER_ID'] ?? 'portal-user';

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
          result?: { content?: string };
          error?: { message?: string };
        };

        if (!response.ok) {
          errors.push(`${baseUrl}${path} -> HTTP ${response.status}`);
          continue;
        }

        return payload.result?.content?.trim() || payload.error?.message || 'No response returned by orchestrator.';
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

  if (!content) {
    return NextResponse.json(
      { error: { message: 'content is required' } },
      { status: 400 },
    );
  }

  const messages = normalizeMessages(body.messages, content);

  try {
    const orchestratorReply = await callOrchestrator(messages);
    return NextResponse.json({ data: { role: 'assistant', content: orchestratorReply, status: 'success' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI backend is unavailable.';
    return NextResponse.json(
      { error: { message } },
      { status: 503 },
    );
  }
}
