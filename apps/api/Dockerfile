# ─── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Copy workspace manifests first (layer-cache friendly)
COPY package.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install all workspace dependencies
RUN npm install --workspace=packages/shared --workspace=apps/api

# Copy sources
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/

# Compile shared package first, then the API
RUN npm run build --workspace=packages/shared 2>/dev/null || true
RUN npm run build --workspace=apps/api

# ─── Stage 2: development (ts-node, with sources) ────────────────────────────
FROM node:18-alpine AS development

WORKDIR /app

COPY package.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install all deps (including devDependencies for ts-node)
RUN npm install

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/

WORKDIR /app/apps/api
EXPOSE 4000
ENV NODE_ENV=development

CMD ["npx", "ts-node", "--transpile-only", "--project", "tsconfig.json", "src/index.ts"]

# ─── Stage 3: production ──────────────────────────────────────────────────────
FROM node:18-alpine AS production

WORKDIR /app

COPY package.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Production-only dependencies
RUN npm install --workspace=packages/shared --workspace=apps/api --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api
EXPOSE 4000
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
