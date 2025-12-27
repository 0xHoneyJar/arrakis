# =============================================================================
# SIETCH UNIFIED - DISCORD BOT DOCKERFILE
# =============================================================================
# Production deployment for Discord bot on Google Cloud Run
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.14.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/discord-bot/package.json ./packages/discord-bot/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile --prod=false

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.14.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/discord-bot/node_modules ./packages/discord-bot/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

COPY . .

RUN pnpm --filter @sietch/shared build
RUN pnpm --filter @sietch/discord-bot build

# -----------------------------------------------------------------------------
# Stage 3: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 sietch

RUN corepack enable && corepack prepare pnpm@8.14.0 --activate

COPY package.json pnpm-workspace.yaml ./
COPY packages/discord-bot/package.json ./packages/discord-bot/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/discord-bot/dist ./packages/discord-bot/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

RUN chown -R sietch:nodejs /app

USER sietch

ENV NODE_ENV=production

CMD ["node", "packages/discord-bot/dist/index.js"]
