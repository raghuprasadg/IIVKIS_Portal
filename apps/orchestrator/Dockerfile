# ─── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Copy workspace manifests (layer-cache friendly)
COPY package.json tsconfig.json ./
COPY packages/shared/package.json         ./packages/shared/
COPY packages/agents/analysis/package.json     ./packages/agents/analysis/
COPY packages/agents/integration/package.json  ./packages/agents/integration/
COPY packages/agents/troubleshooting/package.json ./packages/agents/troubleshooting/
COPY packages/agents/vendor-knowledge/package.json ./packages/agents/vendor-knowledge/
COPY apps/orchestrator/package.json        ./apps/orchestrator/

# Install all workspace dependencies
RUN npm install \
      --workspace=packages/shared \
      --workspace=packages/agents/analysis \
      --workspace=packages/agents/integration \
      --workspace=packages/agents/troubleshooting \
      --workspace=packages/agents/vendor-knowledge \
      --workspace=apps/orchestrator

# Copy sources
COPY packages/shared/src                      ./packages/shared/src
COPY packages/shared/tsconfig.json            ./packages/shared/
COPY packages/agents/analysis/src             ./packages/agents/analysis/src
COPY packages/agents/analysis/tsconfig.json   ./packages/agents/analysis/
COPY packages/agents/integration/src          ./packages/agents/integration/src
COPY packages/agents/integration/tsconfig.json ./packages/agents/integration/
COPY packages/agents/troubleshooting/src      ./packages/agents/troubleshooting/src
COPY packages/agents/troubleshooting/tsconfig.json ./packages/agents/troubleshooting/
COPY packages/agents/vendor-knowledge/src     ./packages/agents/vendor-knowledge/src
COPY packages/agents/vendor-knowledge/tsconfig.json ./packages/agents/vendor-knowledge/
COPY apps/orchestrator/src                    ./apps/orchestrator/src
COPY apps/orchestrator/tsconfig.json          ./apps/orchestrator/

# Build in dependency order
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/agents/analysis
RUN npm run build --workspace=packages/agents/integration
RUN npm run build --workspace=packages/agents/troubleshooting
RUN npm run build --workspace=packages/agents/vendor-knowledge
RUN npm run build --workspace=apps/orchestrator

# ─── Stage 2: development (ts-node, with sources) ────────────────────────────
FROM node:18-alpine AS development

WORKDIR /app

COPY package.json tsconfig.json ./
COPY packages/shared/package.json         ./packages/shared/
COPY packages/agents/analysis/package.json     ./packages/agents/analysis/
COPY packages/agents/integration/package.json  ./packages/agents/integration/
COPY packages/agents/troubleshooting/package.json ./packages/agents/troubleshooting/
COPY packages/agents/vendor-knowledge/package.json ./packages/agents/vendor-knowledge/
COPY apps/orchestrator/package.json        ./apps/orchestrator/

RUN npm install \
      --workspace=packages/shared \
      --workspace=packages/agents/analysis \
      --workspace=packages/agents/integration \
      --workspace=packages/agents/troubleshooting \
      --workspace=packages/agents/vendor-knowledge \
      --workspace=apps/orchestrator

COPY packages/shared/src                      ./packages/shared/src
COPY packages/shared/tsconfig.json            ./packages/shared/
COPY packages/agents/analysis/src             ./packages/agents/analysis/src
COPY packages/agents/analysis/tsconfig.json   ./packages/agents/analysis/
COPY packages/agents/integration/src          ./packages/agents/integration/src
COPY packages/agents/integration/tsconfig.json ./packages/agents/integration/
COPY packages/agents/troubleshooting/src      ./packages/agents/troubleshooting/src
COPY packages/agents/troubleshooting/tsconfig.json ./packages/agents/troubleshooting/
COPY packages/agents/vendor-knowledge/src     ./packages/agents/vendor-knowledge/src
COPY packages/agents/vendor-knowledge/tsconfig.json ./packages/agents/vendor-knowledge/
COPY apps/orchestrator/src                    ./apps/orchestrator/src
COPY apps/orchestrator/tsconfig.json          ./apps/orchestrator/

WORKDIR /app/apps/orchestrator
EXPOSE 5000
ENV NODE_ENV=development

CMD ["npx", "ts-node", "--project", "tsconfig.json", "src/index.ts"]

# ─── Stage 3: production ──────────────────────────────────────────────────────
FROM node:18-alpine AS production

WORKDIR /app

COPY package.json tsconfig.json ./
COPY packages/shared/package.json         ./packages/shared/
COPY packages/agents/analysis/package.json     ./packages/agents/analysis/
COPY packages/agents/integration/package.json  ./packages/agents/integration/
COPY packages/agents/troubleshooting/package.json ./packages/agents/troubleshooting/
COPY packages/agents/vendor-knowledge/package.json ./packages/agents/vendor-knowledge/
COPY apps/orchestrator/package.json        ./apps/orchestrator/

RUN npm install \
      --workspace=packages/shared \
      --workspace=packages/agents/analysis \
      --workspace=packages/agents/integration \
      --workspace=packages/agents/troubleshooting \
      --workspace=packages/agents/vendor-knowledge \
      --workspace=apps/orchestrator \
      --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/packages/shared/dist                   ./packages/shared/dist
COPY --from=builder /app/packages/agents/analysis/dist          ./packages/agents/analysis/dist
COPY --from=builder /app/packages/agents/integration/dist       ./packages/agents/integration/dist
COPY --from=builder /app/packages/agents/troubleshooting/dist   ./packages/agents/troubleshooting/dist
COPY --from=builder /app/packages/agents/vendor-knowledge/dist  ./packages/agents/vendor-knowledge/dist
COPY --from=builder /app/apps/orchestrator/dist                 ./apps/orchestrator/dist

WORKDIR /app/apps/orchestrator
EXPOSE 5000
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
