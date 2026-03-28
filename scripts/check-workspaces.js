#!/usr/bin/env node
/**
 * check-workspaces.js
 *
 * Verifies that all expected workspace packages are present and have a
 * valid package.json. Run via: node scripts/check-workspaces.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const EXPECTED_WORKSPACES = [
  'packages/shared',
  'packages/ui',
  'packages/agents/vendor-knowledge',
  'packages/agents/troubleshooting',
  'packages/agents/integration',
  'packages/agents/analysis',
  'apps/portal',
  'apps/api',
  'apps/orchestrator',
];

let allOk = true;

for (const ws of EXPECTED_WORKSPACES) {
  const pkgPath = path.join(ROOT, ws, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log(`  ✅  ${pkg.name}  (${ws})`);
  } else {
    console.error(`  ❌  Missing package.json: ${ws}`);
    allOk = false;
  }
}

if (!allOk) {
  process.exit(1);
}

console.log('\nAll workspace packages verified.');
