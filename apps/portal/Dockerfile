# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:18-alpine AS deps

WORKDIR /app

# Copy workspace manifests (cache-layer friendly)
COPY package.json tsconfig.json ./
COPY packages/shared/package.json  ./packages/shared/
COPY packages/ui/package.json      ./packages/ui/
COPY apps/portal/package.json      ./apps/portal/

# Install all workspace dependencies (including devDeps for build)
RUN npm install \
      --workspace=packages/shared \
      --workspace=packages/ui \
      --workspace=apps/portal

# ─── Stage 2: builder ────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules          ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/ui/node_modules     ./packages/ui/node_modules     2>/dev/null || true
COPY --from=deps /app/apps/portal/node_modules     ./apps/portal/node_modules     2>/dev/null || true

COPY package.json tsconfig.json ./
COPY packages/shared/package.json  ./packages/shared/
COPY packages/ui/package.json      ./packages/ui/
COPY apps/portal/package.json      ./apps/portal/

# Copy sources
COPY packages/shared/src           ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/ui/src               ./packages/ui/src
COPY packages/ui/tsconfig.json     ./packages/ui/
COPY apps/portal/src               ./apps/portal/src
COPY apps/portal/next.config.js    ./apps/portal/
COPY apps/portal/next-env.d.ts     ./apps/portal/
COPY apps/portal/tsconfig.json     ./apps/portal/

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
WORKDIR /app/apps/portal
RUN npx next build

# ─── Stage 3: development (next dev, hot reload) ──────────────────────────────
FROM node:18-alpine AS development

WORKDIR /app

COPY package.json tsconfig.json ./
COPY packages/shared/package.json  ./packages/shared/
COPY packages/ui/package.json      ./packages/ui/
COPY apps/portal/package.json      ./apps/portal/

RUN npm install \
      --workspace=packages/shared \
      --workspace=packages/ui \
      --workspace=apps/portal

COPY packages/shared/src           ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/ui/src               ./packages/ui/src
COPY packages/ui/tsconfig.json     ./packages/ui/
COPY apps/portal/src               ./apps/portal/src
COPY apps/portal/next.config.js    ./apps/portal/
COPY apps/portal/next-env.d.ts     ./apps/portal/
COPY apps/portal/tsconfig.json     ./apps/portal/

WORKDIR /app/apps/portal
EXPOSE 3000
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["npx", "next", "dev", "-p", "3000"]

# ─── Stage 4: production ──────────────────────────────────────────────────────
FROM node:18-alpine AS production

WORKDIR /app

COPY package.json ./
COPY packages/shared/package.json  ./packages/shared/
COPY packages/ui/package.json      ./packages/ui/
COPY apps/portal/package.json      ./apps/portal/

RUN npm install \
      --workspace=packages/shared \
      --workspace=packages/ui \
      --workspace=apps/portal \
      --omit=dev

# Copy Next.js standalone output
COPY --from=builder /app/apps/portal/.next           ./apps/portal/.next
COPY --from=builder /app/apps/portal/next.config.js  ./apps/portal/
COPY --from=builder /app/apps/portal/next-env.d.ts   ./apps/portal/

WORKDIR /app/apps/portal
EXPOSE 3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["npx", "next", "start", "-p", "3000"]
