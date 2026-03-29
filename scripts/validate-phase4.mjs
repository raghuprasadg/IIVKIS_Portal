#!/usr/bin/env node
/**
 * IIVKIS Phase 4 Validation Script
 *
 * Checks that all 8 services defined in infra/docker-compose.yml are
 * reachable and returning healthy responses.
 *
 * Usage (requires services started with `cd infra && docker compose up -d`):
 *   node scripts/validate-phase4.mjs
 *
 * Exit codes:
 *   0 — all services healthy   (PASS)
 *   1 — one or more unhealthy  (FAIL)
 */

import { createConnection } from 'net';

// ── Service definitions ──────────────────────────────────────────────────────

const SERVICES = [
  {
    name: 'PostgreSQL',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    check: 'tcp',
  },
  {
    name: 'Redis',
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    check: 'tcp',
  },
  {
    name: 'Neo4j HTTP',
    host: process.env.NEO4J_HOST ?? 'localhost',
    port: Number(process.env.NEO4J_HTTP_PORT ?? 7474),
    check: 'http',
    path: '/',
  },
  {
    name: 'Keycloak',
    host: process.env.KEYCLOAK_HOST ?? 'localhost',
    port: Number(process.env.KEYCLOAK_PORT ?? 8080),
    check: 'http',
    path: '/health/ready',
    // Keycloak health endpoint returns 200 when ready
  },
  {
    name: 'Vault',
    host: process.env.VAULT_HOST ?? 'localhost',
    port: Number(process.env.VAULT_PORT ?? 8200),
    check: 'http',
    path: '/v1/sys/health',
    // Vault returns 200 (initialized+unsealed) or 429/472/473 (other states)
    // All non-connection-refused responses mean the service is up.
    acceptAnyCodes: true,
  },
  {
    name: 'Prometheus',
    host: process.env.PROMETHEUS_HOST ?? 'localhost',
    port: Number(process.env.PROMETHEUS_PORT ?? 9090),
    check: 'http',
    path: '/-/healthy',
  },
  {
    name: 'Grafana',
    host: process.env.GRAFANA_HOST ?? 'localhost',
    port: Number(process.env.GRAFANA_PORT ?? 3001),
    check: 'http',
    path: '/api/health',
  },
  {
    name: 'IIVKIS API',
    host: process.env.API_HOST ?? 'localhost',
    port: Number(process.env.API_PORT ?? 4000),
    check: 'http',
    path: '/health',
  },
];

const TIMEOUT_MS = 5_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function tcpProbe(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, detail: `TCP connect timeout after ${TIMEOUT_MS}ms` });
    }, TIMEOUT_MS);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ ok: true, detail: `TCP connected to ${host}:${port}` });
    });
    socket.once('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, detail: err.message || err.code || String(err) });
    });
  });
}

function httpProbe(host, port, path, acceptAnyCodes = false) {
  return new Promise((resolve) => {
    const url = `http://${host}:${port}${path}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      ctrl.abort();
      resolve({ ok: false, detail: `HTTP timeout after ${TIMEOUT_MS}ms` });
    }, TIMEOUT_MS);

    fetch(url, { signal: ctrl.signal })
      .then((res) => {
        clearTimeout(timer);
        const ok = acceptAnyCodes ? true : res.status < 500;
        resolve({ ok, detail: `HTTP ${res.status} ${res.statusText}` });
      })
      .catch((err) => {
        clearTimeout(timer);
        resolve({ ok: false, detail: String(err) });
      });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function validate() {
  console.log('IIVKIS Phase 4 — Service Health Validation');
  console.log('='.repeat(55));

  const results = await Promise.all(
    SERVICES.map(async (svc) => {
      const probe =
        svc.check === 'tcp'
          ? tcpProbe(svc.host, svc.port)
          : httpProbe(svc.host, svc.port, svc.path, svc.acceptAnyCodes);
      const { ok, detail } = await probe;
      const icon = ok ? '✅' : '❌';
      console.log(`${icon}  ${svc.name.padEnd(18)} ${svc.host}:${svc.port}  ${detail}`);
      return ok;
    }),
  );

  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log('='.repeat(55));

  if (passed === total) {
    console.log(`\nRESULT: PASS — ${passed}/${total} services healthy`);
    console.log(`\nNext Step 5\n`);
    process.exit(0);
  } else {
    console.log(`\nRESULT: FAIL — ${passed}/${total} services healthy\n`);
    process.exit(1);
  }
}

validate();
