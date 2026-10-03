# syntax=docker/dockerfile:1
# Build a partir da RAIZ do monorepo: docker build -f apps/pai/Dockerfile .

FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/pai/package.json ./apps/pai/
COPY packages/core/package.json ./packages/core/
RUN npm ci --workspace apps/pai --workspace packages/core --include-workspace-root --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/core ./packages/core
COPY apps/pai ./apps/pai
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w apps/pai

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs

# standalone de monorepo: node_modules na raiz + server.js em apps/pai/
COPY --from=builder --chown=nextjs:nodejs /repo/apps/pai/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/pai/.next/static ./apps/pai/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/pai/public ./apps/pai/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "apps/pai/server.js"]
