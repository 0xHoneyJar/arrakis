# =============================================================================
# SIETCH UNIFIED - TELEGRAM BOT DOCKERFILE
# =============================================================================
# Production deployment for Telegram bot on Google Cloud Run
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.14.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/telegram-bot/package.json ./packages/telegram-bot/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile --prod=false

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.14.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/telegram-bot/node_modules ./packages/telegram-bot/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

COPY . .

RUN pnpm --filter @sietch/shared build
RUN pnpm --filter @sietch/telegram-bot build

# -----------------------------------------------------------------------------
# Stage 3: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 sietch

RUN corepack enable && corepack prepare pnpm@8.14.0 --activate

COPY package.json pnpm-workspace.yaml ./
COPY packages/telegram-bot/package.json ./packages/telegram-bot/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/telegram-bot/dist ./packages/telegram-bot/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

RUN chown -R sietch:nodejs /app

USER sietch

ENV NODE_ENV=production

CMD ["node", "packages/telegram-bot/dist/index.js"]
