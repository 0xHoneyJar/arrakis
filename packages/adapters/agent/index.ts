/**
 * Agent Gateway Adapter
 * Hounfour Phase 4 — Spice Gate
 *
 * Exports all agent adapter components for the gateway system.
 */

// JWT Service
export { JwtService, type JwtServiceConfig, type PreviousKeyConfig, type KeyLoader } from './jwt-service.js';

// Tier→Access Mapper
export { TierAccessMapper, DEFAULT_TIER_MAP, type TierMappingConfig, type TierMapping } from './tier-access-mapper.js';

// Configuration
export {
  loadAgentGatewayConfig,
  agentInvokeRequestSchema,
  RESERVATION_TTL_MS,
  FINALIZED_MARKER_TTL_S,
  BUDGET_WARNING_THRESHOLD,
  type AgentGatewayConfig,
  type AgentInvokeRequestBody,
  type LoaFinnConfig,
  type BudgetConfig,
  type RateLimitConfig,
} from './config.js';

// Types
export { type AgentGatewayResult, type AgentErrorCode, type AgentErrorResponse } from './types.js';

// Error Messages
export { AGENT_ERROR_MESSAGES, formatErrorMessage, type ErrorMessageEntry } from './error-messages.js';
