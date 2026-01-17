# Build stage - Monorepo aware
# Build from repo root: docker build -f apps/worker/Dockerfile .
FROM node:20-alpine AS builder

WORKDIR /app

# ============================================
# Stage 1: Build @arrakis/core
# ============================================
WORKDIR /app/packages/core

# Copy package files
COPY packages/core/package.json packages/core/package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source (core uses domain/ and ports/, not src/)
COPY packages/core/domain ./domain
COPY packages/core/ports ./ports
COPY packages/core/tsconfig.json ./

# Build core package
RUN npm run build

# ============================================
# Stage 2: Build @arrakis/sandbox
# ============================================
WORKDIR /app/packages/sandbox

# Copy package files
COPY packages/sandbox/package.json packages/sandbox/package-lock.json* ./

# Install dependencies (excluding @arrakis/core which we'll link)
RUN npm ci --ignore-scripts || npm install --ignore-scripts

# Copy source
COPY packages/sandbox/src ./src
COPY packages/sandbox/tsconfig.json ./

# Link @arrakis/core
RUN mkdir -p node_modules/@arrakis && \
    ln -sf /app/packages/core node_modules/@arrakis/core

# Build sandbox package
RUN npm run build

# ============================================
# Stage 3: Build Worker
# ============================================
WORKDIR /app/apps/worker

# Copy package files
COPY apps/worker/package.json apps/worker/package-lock.json* ./

# Install dependencies (excluding workspace packages which we'll link)
RUN npm ci --ignore-scripts || npm install --ignore-scripts

# Link workspace packages
RUN mkdir -p node_modules/@arrakis && \
    ln -sf /app/packages/core node_modules/@arrakis/core && \
    ln -sf /app/packages/sandbox node_modules/@arrakis/sandbox

# Copy worker source
COPY apps/worker/src ./src
COPY apps/worker/tsconfig.json ./

# Build worker
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S worker && \
    adduser -u 1001 -S worker -G worker

WORKDIR /app

# Copy package files from worker
COPY apps/worker/package.json apps/worker/package-lock.json* ./

# Copy built workspace packages (with their node_modules for any transitive deps)
COPY --from=builder /app/packages/core/dist ./node_modules/@arrakis/core/dist
COPY --from=builder /app/packages/core/package.json ./node_modules/@arrakis/core/
COPY --from=builder /app/packages/sandbox/dist ./node_modules/@arrakis/sandbox/dist
COPY --from=builder /app/packages/sandbox/package.json ./node_modules/@arrakis/sandbox/

# Install production dependencies only (excluding workspace deps which we copied)
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev --ignore-scripts && \
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
