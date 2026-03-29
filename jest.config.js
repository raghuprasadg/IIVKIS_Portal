/**
 * Jest root configuration for IIVKIS Phase 8 testing.
 *
 * Tests are written in plain JS (importing compiled dist/ outputs) so they
 * don't require any per-package tsconfig gymnastics. This keeps the config
 * simple and mirrors how the existing validate-phase*.mjs scripts work.
 *
 * Run all tests:  node_modules/.bin/jest
 * Run with coverage: node_modules/.bin/jest --coverage
 */

/** @type {import('jest').Config} */
const config = {
  // Use the default Node.js environment (no browser DOM needed)
  testEnvironment: 'node',

  // Match only our hand-written test files
  testMatch: ['<rootDir>/tests/**/*.test.js'],

  // Collect coverage from dist outputs of the modules we care about
  collectCoverageFrom: [
    'packages/shared/dist/**/*.js',
    'apps/api/dist/security/**/*.js',
    'apps/api/dist/middleware/waf.js',
    'apps/orchestrator/dist/resiliency/**/*.js',
    '!**/*.d.ts',
    '!**/*.d.js',
  ],

  coverageThresholds: {
    global: {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80,
    },
  },

  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageDirectory: 'coverage',

  // Don't transform node_modules; our dist/*.js files are already compiled CJS
  transform: {},

  // Verbose output so CI logs show individual test names
  verbose: true,
};

module.exports = config;
