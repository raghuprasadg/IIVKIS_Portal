# IIVKIS Dependency Map

This document describes the inter-package dependency relationships within the
IIVKIS monorepo.

## Workspace Packages

| Package | Path | Description |
|---|---|---|
| `@iivkis/shared` | `packages/shared` | Shared TypeScript types, constants, and utilities |
| `@iivkis/ui` | `packages/ui` | Shared React UI components |
| `@iivkis/agents-vendor-knowledge` | `packages/agents/vendor-knowledge` | Vendor Knowledge AI agent |
| `@iivkis/agents-troubleshooting` | `packages/agents/troubleshooting` | Troubleshooting AI agent |
| `@iivkis/agents-integration` | `packages/agents/integration` | Integration AI agent |
| `@iivkis/agents-analysis` | `packages/agents/analysis` | Analysis AI agent |
| `@iivkis/api` | `apps/api` | Backend REST API service |
| `@iivkis/orchestrator` | `apps/orchestrator` | Engineering Orchestrator service |
| `@iivkis/portal` | `apps/portal` | Web frontend (Next.js) |

---

## Dependency Graph

```
@iivkis/shared           (no internal deps — foundation layer)
        │
        ├──▶ @iivkis/ui
        │
        ├──▶ @iivkis/agents-vendor-knowledge
        ├──▶ @iivkis/agents-troubleshooting
        ├──▶ @iivkis/agents-integration
        ├──▶ @iivkis/agents-analysis
        │
        ├──▶ @iivkis/api
        │
        └──▶ @iivkis/orchestrator
                    │
                    ├──▶ @iivkis/agents-vendor-knowledge
                    ├──▶ @iivkis/agents-troubleshooting
                    ├──▶ @iivkis/agents-integration
                    └──▶ @iivkis/agents-analysis

@iivkis/portal
        ├──▶ @iivkis/shared
        └──▶ @iivkis/ui
```

---

## Dependency Details

### `@iivkis/shared`
- **Internal deps:** none
- **Role:** Foundation layer. All other packages depend on this.

### `@iivkis/ui`
- **Internal deps:** `@iivkis/shared`
- **Role:** Reusable React components consumed by the portal.

### `@iivkis/agents-vendor-knowledge`
- **Internal deps:** `@iivkis/shared`
- **Role:** Queries and enriches vendor/product knowledge.

### `@iivkis/agents-troubleshooting`
- **Internal deps:** `@iivkis/shared`
- **Role:** Generates resolution plans for IT incidents.

### `@iivkis/agents-integration`
- **Internal deps:** `@iivkis/shared`
- **Role:** Connects to external IT systems (CMDB, ITSM, monitoring).

### `@iivkis/agents-analysis`
- **Internal deps:** `@iivkis/shared`
- **Role:** Performs trend analysis and generates analytics reports.

### `@iivkis/api`
- **Internal deps:** `@iivkis/shared`
- **Role:** Exposes a REST API consumed by the portal and external clients.

### `@iivkis/orchestrator`
- **Internal deps:** `@iivkis/shared`, all four agent packages
- **Role:** Routes tasks to the appropriate agents and aggregates results.

### `@iivkis/portal`
- **Internal deps:** `@iivkis/shared`, `@iivkis/ui`
- **Role:** The user-facing web application.

---

## Build Order

Because packages reference each other as workspace dependencies, builds must
follow this topological order:

1. `@iivkis/shared`
2. `@iivkis/ui`
3. `@iivkis/agents-*` (all four can build in parallel)
4. `@iivkis/api`
5. `@iivkis/orchestrator`
6. `@iivkis/portal`
