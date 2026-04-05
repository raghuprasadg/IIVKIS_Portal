/* eslint-env jest, node */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const path = require('path');

describe('vendor knowledge distillation flow', () => {
  let handle;
  let knowledgeBaseStore;

  beforeEach(() => {
    process.env['LLM_API_KEY'] = 'sk-test-key';
    jest.resetModules();

    ({ handle } = require(
      path.resolve(__dirname, '../../packages/agents/vendor-knowledge/dist/index'),
    ));
    ({ knowledgeBaseStore } = require(
      path.resolve(__dirname, '../../packages/agents/vendor-knowledge/dist/rag/store'),
    ));
    knowledgeBaseStore.clear();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ index: 0, embedding: [1, 0] }],
          usage: { total_tokens: 12 },
          model: 'text-embedding-3-small',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ index: 0, embedding: [1, 0] }],
          usage: { total_tokens: 4 },
          model: 'text-embedding-3-small',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Use the router firmware rollback article.' } }],
          usage: { prompt_tokens: 20, completion_tokens: 9 },
          model: 'gpt-4o-mini',
        }),
      });
  });

  afterEach(() => {
    delete process.env['LLM_API_KEY'];
    knowledgeBaseStore.clear();
    jest.restoreAllMocks();
    delete global.fetch;
  });

  it('ingests an article and retrieves it through search', async () => {
    const baseRequest = {
      tenantId: 'tenant-1',
      userId: 'user-1',
      traceId: 'trace-1',
      spanId: 'span-1',
      timeoutMs: 1000,
      createdAt: new Date().toISOString(),
    };

    const ingestResp = await handle({
      ...baseRequest,
      taskId: 'ingest-1',
      taskType: 'vk.ingest',
      payload: {
        articleId: 'article-1',
        title: 'Router firmware rollback',
        content: 'Rollback the router firmware to version 2.4 before reapplying the patch.',
        vendorId: 'cisco',
        tags: ['firmware', 'rollback'],
      },
    });

    expect(ingestResp.status).toBe('success');
    expect(ingestResp.result.ingested).toBe(true);
    expect(ingestResp.result.chunkCount).toBeGreaterThan(0);

    const articleResp = await handle({
      ...baseRequest,
      taskId: 'article-1',
      taskType: 'vk.article.get',
      payload: { articleId: 'article-1' },
    });

    expect(articleResp.status).toBe('success');
    expect(articleResp.result.found).toBe(true);
    expect(articleResp.result.title).toBe('Router firmware rollback');

    const searchResp = await handle({
      ...baseRequest,
      taskId: 'search-1',
      taskType: 'vk.search',
      payload: { query: 'How do I rollback router firmware?', topK: 3 },
    });

    expect(searchResp.status).toBe('success');
    expect(searchResp.result.answer).toBe('Use the router firmware rollback article.');
    expect(searchResp.result.sources.length).toBeGreaterThan(0);
    expect(searchResp.result.sources[0].articleId).toBe('article-1');
  });
});