# Build stage - Monorepo aware
# Build from repo root: docker build -f apps/worker/Dockerfile .
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json* ./

# Copy workspace packages that worker depends on
COPY packages/core/package.json ./packages/core/
COPY packages/sandbox/package.json ./packages/sandbox/

# Copy worker package
COPY apps/worker/package.json ./apps/worker/

# Install all dependencies (including workspace links)
RUN npm ci --workspace=apps/worker --include-workspace-root

# Copy source code for packages
COPY packages/core/src ./packages/core/src
COPY packages/core/tsconfig.json ./packages/core/
COPY packages/sandbox/src ./packages/sandbox/src
COPY packages/sandbox/tsconfig.json ./packages/sandbox/

# Copy worker source
COPY apps/worker/src ./apps/worker/src
COPY apps/worker/tsconfig.json ./apps/worker/

# Build packages first, then worker
WORKDIR /app/packages/core
RUN npm run build || true

WORKDIR /app/packages/sandbox
RUN npm run build

WORKDIR /app/apps/worker
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S worker && \
    adduser -u 1001 -S worker -G worker

WORKDIR /app

# Copy package files
COPY apps/worker/package.json ./
COPY package-lock.json* ./

# Copy built workspace packages
COPY --from=builder /app/packages/core/dist ./node_modules/@arrakis/core/dist
COPY --from=builder /app/packages/core/package.json ./node_modules/@arrakis/core/
COPY --from=builder /app/packages/sandbox/dist ./node_modules/@arrakis/sandbox/dist
COPY --from=builder /app/packages/sandbox/package.json ./node_modules/@arrakis/sandbox/

# Install production dependencies only (excluding workspace deps which we copied)
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy built worker files from builder stage
COPY --from=builder /app/apps/worker/dist ./dist

# Set ownership
RUN chown -R worker:worker /app

# Switch to non-root user
USER worker

# Environment variables (defaults, overridden at runtime)
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV PORT=8080

# Expose health check port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start the worker
CMD ["node", "dist/index.js"]
