# ══════════════════════════════════════════════════════════════════════
# Multi-stage Dockerfile for Next.js 14 (standalone output) on Alpine
#
# 3 stages so the final image contains ONLY what's needed to run:
#   deps    → install node_modules (cached unless package.json changes)
#   builder → compile the Next.js app
#   runner  → tiny Alpine image with just the standalone server (~150 MB)
# ══════════════════════════════════════════════════════════════════════

# ── Stage 1: dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy ONLY the manifests first — Docker caches this layer, so deps are
# re-installed only when package.json / package-lock.json change.
COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects anonymous usage telemetry — off in CI/containers
ENV NEXT_TELEMETRY_DISABLED=1

# `output: "standalone"` in next.config.mjs makes this produce
# .next/standalone — a self-contained server with its own pruned
# node_modules (only runtime deps, no dev tooling).
RUN npm run build

# ── Stage 3: runtime ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Never run as root inside a container
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy the three pieces the standalone server needs:
#   1. the server + pruned node_modules
#   2. static assets (JS/CSS chunks)
#   3. the public folder (if you add images later)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

# Render injects PORT at runtime; 3000 is the local-run default.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "server.js"]
