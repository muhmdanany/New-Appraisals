# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────
# Multi-stage production image for the Competency Platform.
# Uses Next.js standalone output for a small final image.
# Base: Debian bookworm-slim (OpenSSL 3 → Prisma debian-openssl-3.0.x).
# ─────────────────────────────────────────────────────────────

FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1) Install dependencies (cached on lockfile)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 2) Build the app (generates Prisma client + Next standalone bundle)
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# 3) Migrator image — runs `prisma migrate deploy` (has the Prisma CLI + migrations).
#    Used by docker-compose / CI to apply migrations before the app starts.
FROM builder AS migrator
CMD ["npx", "prisma", "migrate", "deploy"]

# 4) Runner — minimal standalone server, non-root.
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    AUTH_TRUST_HOST=true
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Ensure the generated Prisma client + query engine are present (standalone tracing
# can miss the engine binary).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
