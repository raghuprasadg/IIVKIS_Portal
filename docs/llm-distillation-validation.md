# LLM And Distillation Validation

Date: 2026-04-04

## Scope

This validation covers two areas:

1. Live LLM completion and embedding calls in the orchestrator gateway.
2. Vendor Knowledge ingestion and retrieval flow, referred to here as distillation:
   article ingestion, chunking, embedding, storage, lookup, and RAG search.

## Findings Before Fixes

- The orchestrator LLM gateway supported mock completions only for some paths. Live embeddings were not implemented.
- The Vendor Knowledge LLM gateway still returned mock completions in live mode and threw for embeddings.
- `vk.ingest` was a stub and did not chunk, embed, or store articles.
- `vk.article.get` was a stub and did not return stored content.
- Vendor Knowledge retrieval backends were placeholders, so search could not use ingested knowledge.

## Fixes Applied

### Live LLM support

- Implemented real OpenAI-compatible HTTP calls for chat completions in the orchestrator gateway.
- Implemented real OpenAI-compatible HTTP calls for embeddings in the orchestrator gateway.
- Implemented real OpenAI-compatible HTTP calls for chat completions in the Vendor Knowledge gateway.
- Implemented real OpenAI-compatible HTTP calls for embeddings in the Vendor Knowledge gateway.
- Added support for `LLM_MODEL_AUTO` and `LLM_EMBEDDING_MODEL` to the dev and UAT orchestrator environment configuration.
- Fixed model selection so explicit `fast`, `capable`, `auto`, and explicit model names are honored.

### Distillation flow

- Added an in-memory Vendor Knowledge store for development and test execution.
- Implemented `vk.ingest` to:
  - read article content,
  - chunk the article,
  - generate embeddings for chunks,
  - store the article and embedded chunks.
- Implemented `vk.article.get` to return stored article content and metadata.
- Replaced placeholder retrieval logic with working in-memory retrieval using:
  - vector similarity over embeddings,
  - lexical scoring over chunk text and metadata,
  - metadata/entity matching for a lightweight KG-style signal.

## Validation Performed

### Automated tests

Executed:

```bash
npx jest tests/unit/llm-gateways.test.js tests/unit/vendor-knowledge-distillation.test.js --runInBand
```

Result:

- 2 test suites passed
- 5 tests passed
- 0 failures

Coverage of those tests:

- Orchestrator live completion path
- Orchestrator live embedding path
- Vendor Knowledge live completion path
- Vendor Knowledge live embedding path
- Vendor Knowledge end-to-end distillation flow:
  `vk.ingest -> vk.article.get -> vk.search`

### Type safety

Executed:

```bash
npm run typecheck
```

Result:

- Passed with no TypeScript errors

## Current Status

The LLM integration is working for live OpenAI-compatible completion and embedding calls.

The Vendor Knowledge distillation flow is now working in the current development architecture:

- ingest an article,
- chunk it,
- embed it,
- store it,
- retrieve it,
- generate a grounded RAG response.

## Current Boundaries

The distillation implementation is currently in-memory. It is valid for development, local validation, and automated tests, but it is not yet durable infrastructure.

The following production-grade integrations are still future enhancements:

- persistent vector storage through pgvector,
- persistent document lookup through PostgreSQL,
- graph traversal through Neo4j-backed knowledge graph services.

## Files Updated

- `apps/orchestrator/src/llm-gateway/gateway.ts`
- `packages/agents/vendor-knowledge/src/index.ts`
- `packages/agents/vendor-knowledge/src/rag/llm-gateway.ts`
- `packages/agents/vendor-knowledge/src/rag/retrieval.ts`
- `packages/agents/vendor-knowledge/src/rag/store.ts`
- `packages/agents/vendor-knowledge/src/rag/index.ts`
- `infra/.env.example`
- `infra/docker-compose.yml`
- `infra/docker-compose.uat.yml`
- `tests/unit/llm-gateways.test.js`
- `tests/unit/vendor-knowledge-distillation.test.js`

## Configuration Notes

To use live providers in runtime environments, configure:

```env
LLM_API_KEY=...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL_FAST=gpt-4o-mini
LLM_MODEL_CAPABLE=gpt-4o
LLM_MODEL_AUTO=gpt-4o-mini
LLM_EMBEDDING_MODEL=text-embedding-3-small
```