/* eslint-env jest, node */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const path = require('path');

const { LLMGateway: OrchestratorLLMGateway } = require(
  path.resolve(__dirname, '../../apps/orchestrator/dist/llm-gateway/gateway'),
);
const { LLMGateway: VendorKnowledgeLLMGateway } = require(
  path.resolve(__dirname, '../../packages/agents/vendor-knowledge/dist/rag/llm-gateway'),
);

describe('LLM gateways live provider paths', () => {
  beforeEach(() => {
    process.env['LLM_API_KEY'] = 'sk-test-key';
    process.env['LLM_EMBEDDING_MODEL'] = 'text-embedding-3-small';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete process.env['LLM_API_KEY'];
    delete process.env['LLM_EMBEDDING_MODEL'];
    jest.restoreAllMocks();
    delete global.fetch;
  });

  it('orchestrator gateway performs live chat completions', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'live orchestration response' } }],
        usage: { prompt_tokens: 11, completion_tokens: 7 },
        model: 'gpt-4o-live',
      }),
    });

    const gateway = new OrchestratorLLMGateway({
      defaultProvider: {
        name: 'openai',
        baseUrl: 'https://example.test/v1',
        apiKey: 'sk-test-key',
      },
      modelTierMap: {
        fast: 'gpt-fast',
        capable: 'gpt-capable',
        auto: 'gpt-auto',
      },
      maxBudgetTokensPerDay: 100000,
      cacheSimilarityThreshold: 0.97,
    });

    const response = await gateway.complete({
      taskId: 'task-1',
      tenantId: 'tenant-1',
      model: 'capable',
      messages: [{ role: 'user', content: 'Explain the incident.' }],
    });

    expect(response.content).toBe('live orchestration response');
    expect(response.model).toBe('gpt-4o-live');
    expect(response.provider).toBe('openai');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.test/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test-key' }),
      }),
    );
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-capable');
  });

  it('orchestrator gateway performs live embeddings', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { index: 1, embedding: [0.3, 0.4] },
          { index: 0, embedding: [0.1, 0.2] },
        ],
        usage: { total_tokens: 9 },
        model: 'text-embedding-live',
      }),
    });

    const gateway = new OrchestratorLLMGateway({
      defaultProvider: {
        name: 'openai',
        baseUrl: 'https://example.test/v1/',
        apiKey: 'sk-test-key',
      },
      modelTierMap: {
        fast: 'gpt-fast',
        capable: 'gpt-capable',
        auto: 'gpt-auto',
      },
      maxBudgetTokensPerDay: 100000,
      cacheSimilarityThreshold: 0.97,
    });

    const response = await gateway.embed({
      taskId: 'task-2',
      tenantId: 'tenant-1',
      texts: ['alpha', 'beta'],
    });

    expect(response.embeddings).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(response.model).toBe('text-embedding-live');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.test/v1/embeddings',
      expect.any(Object),
    );
  });

  it('vendor knowledge gateway performs live chat completions', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'live VK response' } }],
        usage: { prompt_tokens: 14, completion_tokens: 5 },
        model: 'gpt-vk-live',
      }),
    });

    const gateway = new VendorKnowledgeLLMGateway({
      baseUrl: 'https://vk.example.test/v1',
      apiKey: 'sk-test-key',
      model: 'gpt-vk-default',
      embeddingModel: 'text-embedding-vk',
    });

    const response = await gateway.complete({
      taskId: 'task-3',
      tenantId: 'tenant-1',
      messages: [{ role: 'user', content: 'What KB article applies?' }],
      cacheable: true,
    });

    expect(response.content).toBe('live VK response');
    expect(response.model).toBe('gpt-vk-live');
    expect(response.provider).toBe('openai-compatible');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://vk.example.test/v1/chat/completions',
      expect.any(Object),
    );
  });

  it('vendor knowledge gateway performs live embeddings', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ index: 0, embedding: [0.9, 0.1] }],
        usage: { total_tokens: 4 },
        model: 'text-embedding-vk-live',
      }),
    });

    const gateway = new VendorKnowledgeLLMGateway({
      baseUrl: 'https://vk.example.test/v1',
      apiKey: 'sk-test-key',
      model: 'gpt-vk-default',
      embeddingModel: 'text-embedding-vk',
    });

    const response = await gateway.embed({
      taskId: 'task-4',
      tenantId: 'tenant-1',
      texts: ['router firmware advisory'],
    });

    expect(response.embeddings).toEqual([[0.9, 0.1]]);
    expect(response.model).toBe('text-embedding-vk-live');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://vk.example.test/v1/embeddings',
      expect.any(Object),
    );
  });
});