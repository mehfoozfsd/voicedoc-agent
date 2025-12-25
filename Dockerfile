# Production Dockerfile for VoiceDoc Agent
# Optimized for Cloud Run

FROM node:20-alpine3.22 AS base

# 1. Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Accept build arguments for environment variables needed during build
ARG VERTEX_PROJECT_ID
ARG GOOGLE_CLOUD_LOCATION=us-central1

# Set them as environment variables for the build
ENV VERTEX_PROJECT_ID=$VERTEX_PROJECT_ID
ENV GOOGLE_CLOUD_LOCATION=$GOOGLE_CLOUD_LOCATION

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]