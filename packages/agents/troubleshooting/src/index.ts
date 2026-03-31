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

function normalizeMessages(input: ChatPayload['messages']): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m): m is { role: string; content: string } => !!m?.role && !!m?.content)
    .map((m) => ({
      role: m.role === 'assistant' || m.role === 'system' ? m.role : 'user',
      content: String(m.content),
    }));
}

async function handleChatTurn(request: AgentRequest, start: number): Promise<AgentResponse> {
  const apiKey = process.env['LLM_API_KEY'];
  const baseUrl = process.env['LLM_BASE_URL'] ?? 'https://api.openai.com/v1';
  const model = process.env['LLM_MODEL_FAST'] ?? 'gpt-4o-mini';

  if (!apiKey) {
    return {
      taskId: request.taskId,
      status: 'degraded',
      tenantId: request.tenantId,
      result: {
        content:
          'Live AI is not configured yet: LLM_API_KEY is missing in the orchestrator environment.',
      },
      latencyMs: Date.now() - start,
      createdAt: new Date().toISOString(),
    };
  }

  const payload = request.payload as ChatPayload;
  const history = normalizeMessages(payload.messages);
  const systemPrompt: ChatMessage = {
    role: 'system',
    content:
      'You are the IIVKIS troubleshooting copilot. Provide concise, actionable incident triage guidance with clear next steps and mention confidence when correlating signals.',
  };

  const messages = [systemPrompt, ...history].slice(-24);

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
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
      tokensUsed: data.usage?.total_tokens,
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
