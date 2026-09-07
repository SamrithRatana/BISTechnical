# ==========================================
# Next.js 16 Production Multi-Stage Dockerfile
# Optimized for Standalone Output & DigitalOcean
# ==========================================

# ── Stage 1: Dependencies ──
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# ── Stage 2: Builder ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# The R2 public host is baked in at BUILD time: next.config.ts derives
# images.remotePatterns and NEXT_PUBLIC_R2_PUBLIC_HOST from it, and both are
# frozen into the standalone output. Without this ARG a clean-checkout build
# (where .env.local is gitignored) silently ships with remote image
# optimization disabled — every uploaded logo falls back to a raw <img> at
# its original size. Pass it: docker build --build-arg R2_PUBLIC_BASE_URL=...
ARG R2_PUBLIC_BASE_URL
ENV R2_PUBLIC_BASE_URL=$R2_PUBLIC_BASE_URL

RUN npm run build

# ── Stage 3: Runner (Minimal Production Image) ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create unprivileged system user for container security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Leverage standalone output to minimize image footprint (<150MB)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
