-- IIVKIS PostgreSQL initialisation
-- Runs once when the Docker volume is first created.
-- Executed as the POSTGRES_USER (iivkis) against POSTGRES_DB (iivkis).

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- gen_random_uuid() fallback
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS "vector";      -- pgvector — tenant-namespaced embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- trigram full-text search
CREATE EXTENSION IF NOT EXISTS "btree_gin";   -- GIN index on composite types

-- ── Schemas ──────────────────────────────────────────────────────────────────
-- Keep platform objects in a dedicated schema to separate from app tables.
CREATE SCHEMA IF NOT EXISTS iivkis;
SET search_path = iivkis, public;

-- ── Initial audit marker ─────────────────────────────────────────────────────
-- A lightweight table to confirm init ran successfully.
CREATE TABLE IF NOT EXISTS iivkis.schema_migrations (
  id          SERIAL PRIMARY KEY,
  version     TEXT NOT NULL UNIQUE,
  description TEXT,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO iivkis.schema_migrations (version, description)
VALUES ('0001', 'Initial extensions and schema bootstrap')
ON CONFLICT (version) DO NOTHING;
