# IIVKIS Portal

**Intelligent IT Vendor Knowledge Integration System (IIVKIS)**

An AI-driven platform designed to simplify IT troubleshooting and vendor data analysis.

---

## Monorepo Structure

```
IIVKIS_Portal/
├── apps/
│   ├── portal/          # Web frontend — React / Next.js
│   ├── api/             # Backend REST API — Node.js / Express
│   └── orchestrator/    # Engineering Orchestrator service
├── packages/
│   ├── shared/          # Shared TypeScript types & utilities
│   ├── ui/              # Shared React UI components
│   └── agents/
│       ├── vendor-knowledge/   # Vendor Knowledge AI Agent
│       ├── troubleshooting/    # Troubleshooting AI Agent
│       ├── integration/        # Integration AI Agent
│       └── analysis/           # Analysis AI Agent
├── docs/
│   ├── architecture.md         # System design & component overview
│   └── dependency-map.md       # Inter-package dependency graph
└── scripts/
    └── check-workspaces.js     # Verify all workspace packages exist
```

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

## Quick Start

```bash
# Install all workspace dependencies
npm install

# Verify workspace structure
node scripts/check-workspaces.js

# Build all packages (in dependency order)
npm run build

# Lint all packages
npm run lint

# Type-check all packages
npm run typecheck
```

## Documentation

- [Requirements Specification](docs/requirements.md)
- [Architecture Overview](docs/architecture.md)
- [Dependency Map](docs/dependency-map.md)

## Development Phases

| Phase | Description | Status |
|---|---|---|
| **STEP 0** | System init — monorepo, base configs, agent stubs | ✅ Done |
| **STEP 1** | Requirements — functional, NFRs, multi-tenancy, LLM, billing, security, resiliency | ✅ Done |
| **STEP 2+** | Design & implementation | 🔜 Pending |
