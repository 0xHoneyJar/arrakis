/**
 * Agent Gateway Factory
 * Sprint S4-T2: Wires all adapters together, mirrors createChainProvider() pattern
 *
 * @see SDD §4.8 Agent Gateway Factory
 */

import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { Queue } from 'bullmq';
import type { AgentGatewayResult } from './types.js';
import type { StreamReconciliationJob } from './stream-reconciliation-worker.js';
import { JwtService } from './jwt-service.js';
import { TierAccessMapper } from './tier-access-mapper.js';
import { AgentRateLimiter } from './agent-rate-limiter.js';
import { BudgetManager } from './budget-manager.js';
import { LoaFinnClient } from './loa-finn-client.js';
import { AgentGateway } from './agent-gateway.js';
import { loadAgentGatewayConfig } from './config.js';
import type { TierOverrideProvider } from './tier-access-mapper.js';

// --------------------------------------------------------------------------
// Factory Options
// --------------------------------------------------------------------------

export interface CreateAgentGatewayOptions {
  redis: Redis;
  logger: Logger;
  reconciliationQueue?: Queue<StreamReconciliationJob>;
  overrideProvider?: TierOverrideProvider;
  enqueueAuditLog?: (entry: import('./budget-manager.js').AuditLogEntry) => void;
  configOverrides?: Partial<import('./config.js').AgentGatewayConfig>;
}

// --------------------------------------------------------------------------
// Factory Function
// --------------------------------------------------------------------------

/**
 * Create and initialize all agent gateway components.
 * Mirrors the createChainProvider() pattern from chain adapters.
 *
 * @returns { gateway, health, jwks } matching AgentGatewayResult interface
 */
export async function createAgentGateway(
  options: CreateAgentGatewayOptions,
): Promise<AgentGatewayResult> {
  const { redis, logger, reconciliationQueue, overrideProvider, enqueueAuditLog, configOverrides } = options;
  const config = loadAgentGatewayConfig(configOverrides);

  // 1. JWT Service — load signing key
  const jwtService = new JwtService(
    {
      secretId: config.jwt.secretId,
      keyId: config.jwt.keyId,
      expirySec: config.jwt.expirySec,
    },
    logger,
  );
  await jwtService.initialize();

  // 2. Tier→Access Mapper (with optional DB overrides)
  const tierMapper = new TierAccessMapper(undefined, {
    redis,
    overrideProvider,
    logger,
  });

  // 3. Rate Limiter
  const rateLimiter = new AgentRateLimiter(redis, logger);

  // 4. Budget Manager
  const budgetManager = new BudgetManager(redis, logger, enqueueAuditLog);

  // 5. loa-finn Client
  const loaFinnClient = new LoaFinnClient({
    mintJwt: async (request) => jwtService.sign(request.context),
    logger,
    config: {
      baseUrl: config.loaFinn.baseUrl,
      timeoutMs: config.loaFinn.timeoutMs,
    },
  });

  // 6. Gateway Facade
  const gateway = new AgentGateway({
    budgetManager,
    rateLimiter,
    loaFinnClient,
    tierMapper,
    redis,
    logger,
    reconciliationQueue,
  });

  return {
    gateway,
    health: () => gateway.getHealth(),
    jwks: () => jwtService.getJwks(),
  };
}
