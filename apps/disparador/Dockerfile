# syntax=docker/dockerfile:1
# Disparador HAGAP. Build a partir da RAIZ do monorepo: docker build -f apps/disparador/Dockerfile .

FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
# Todos os package.json dos workspaces: o lockfile único precisa deles para o npm ci
COPY apps/pai/package.json ./apps/pai/
COPY apps/disparador/package.json ./apps/disparador/
COPY packages/core/package.json ./packages/core/
RUN npm ci --workspace apps/disparador --workspace packages/core --include-workspace-root --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/core ./packages/core
COPY apps/disparador ./apps/disparador
# NEXT_PUBLIC_* são embutidas no build (valores públicos; nunca a service role key)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build -w apps/disparador

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs

# standalone de monorepo: node_modules na raiz + server.js em apps/disparador/
COPY --from=builder --chown=nextjs:nodejs /repo/apps/disparador/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/disparador/.next/static ./apps/disparador/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/disparador/public ./apps/disparador/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "apps/disparador/server.js"]
