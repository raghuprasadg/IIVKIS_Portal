import { NextResponse } from 'next/server';

interface ChatRequestBody {
  content?: string;
  messages?: Array<{ role?: string; content?: string }>;
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

async function callGeminiOpenAICompatible(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env['GEMINI_API_KEY'] ?? process.env['LLM_API_KEY'] ?? '';
  if (!apiKey) {
    return null;
  }

  const baseUrl = process.env['GEMINI_BASE_URL'] ?? 'https://generativelanguage.googleapis.com/v1beta/openai';
  const model = process.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content:
            'You are the IIVKIS troubleshooting copilot. Reply concisely with relevant analysis, likely causes, and next actions.',
        },
        ...messages,
      ].slice(-24),
    }),
    signal: AbortSignal.timeout(30000),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    const message = payload.error?.message ?? `Provider returned HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload.choices?.[0]?.message?.content?.trim() ?? 'No content returned by provider.';
}

async function callOrchestrator(messages: Array<{ role: string; content: string }>) {
  const orchestratorUrl = process.env['ORCHESTRATOR_URL'] ?? 'http://127.0.0.1:5000';

  const response = await fetch(`${orchestratorUrl}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId: crypto.randomUUID(),
      taskType: 'ts.chat.turn',
      tenantId: 'tenant-uat',
      userId: 'portal-user',
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
    throw new Error(payload.error?.message ?? `Orchestrator returned HTTP ${response.status}`);
  }

  return payload.result?.content?.trim() || payload.error?.message || 'No response returned by orchestrator.';
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
    const directProviderReply = await callGeminiOpenAICompatible(messages);
    if (directProviderReply) {
      return NextResponse.json({ data: { role: 'assistant', content: directProviderReply, status: 'success' } });
    }

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
