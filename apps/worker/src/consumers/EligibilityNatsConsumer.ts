/**
 * NATS Eligibility Consumer for Arrakis Workers
 * Sprint S-6: Worker Migration to NATS
 *
 * Dedicated consumer for eligibility checks (token balance verification)
 * Consumes from ELIGIBILITY stream per SDD §5.2 and §7.1.1
 */

import type { JsMsg } from 'nats';
import type { Logger } from 'pino';
import { BaseNatsConsumer, BaseConsumerConfig, ProcessResult } from './BaseNatsConsumer.js';
import type { DiscordRestService } from '../services/DiscordRest.js';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/**
 * Eligibility check request payload
 */
export interface EligibilityCheckPayload {
  event_id: string;
  event_type: 'eligibility.check' | 'eligibility.sync';
  timestamp: number;
  community_id: string;
  guild_id: string;
  user_id: string | null; // null for sync requests
  wallet_address: string | null;
  check_type: 'single' | 'batch' | 'community_sync';
  rule_ids?: string[]; // Specific rules to check (optional)
  data: Record<string, unknown>;
}

/**
 * Eligibility check result
 */
export interface EligibilityResult {
  user_id: string;
  wallet_address: string;
  eligible: boolean;
  tier: 'free' | 'fedaykin' | 'naib' | null;
  token_balance: string;
  rules_passed: string[];
  rules_failed: string[];
  checked_at: number;
}

/**
 * Eligibility handler signature
 */
export type EligibilityHandler = (
  payload: EligibilityCheckPayload,
  logger: Logger
) => Promise<EligibilityResult | EligibilityResult[]>;

// --------------------------------------------------------------------------
// Eligibility Consumer
// --------------------------------------------------------------------------

export class EligibilityNatsConsumer extends BaseNatsConsumer<EligibilityCheckPayload> {
  private readonly discordRest: DiscordRestService;
  private readonly handlers: Map<string, EligibilityHandler>;

  constructor(
    config: BaseConsumerConfig,
    discordRest: DiscordRestService,
    handlers: Map<string, EligibilityHandler>,
    logger: Logger
  ) {
    super(config, logger);
    this.discordRest = discordRest;
    this.handlers = handlers;
  }

  /**
   * Process an eligibility check request
   */
  async processMessage(
    payload: EligibilityCheckPayload,
    _msg: JsMsg
  ): Promise<ProcessResult> {
    const { event_id, event_type, community_id, user_id, check_type } = payload;

    this.log.info(
      {
        eventId: event_id,
        eventType: event_type,
        communityId: community_id,
        userId: user_id,
        checkType: check_type,
      },
      'Processing eligibility check'
    );

    const handler = this.handlers.get(check_type);

    if (!handler) {
      this.log.warn({ checkType: check_type }, 'Unknown eligibility check type');
      return { success: true }; // Acknowledge to prevent queue blocking
    }

    try {
      const results = await handler(payload, this.log);

      this.log.info(
        {
          eventId: event_id,
          resultCount: Array.isArray(results) ? results.length : 1,
        },
        'Eligibility check completed'
      );

      // Update roles based on eligibility results if we have Discord access
      if (payload.guild_id && !Array.isArray(results) && results.eligible !== undefined) {
        await this.updateMemberRoles(payload.guild_id, results);
      }

      return { success: true };
    } catch (error) {
      this.log.error(
        { eventId: event_id, checkType: check_type, error },
        'Eligibility handler error'
      );

      // RPC errors are often transient - retry
      return {
        success: false,
        retryable: true,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Update member roles based on eligibility result
   */
  private async updateMemberRoles(
    guildId: string,
    result: EligibilityResult
  ): Promise<void> {
    // This is a placeholder for role management
    // Full implementation will be in S-7 with tier-based role mapping
    this.log.debug(
      {
        guildId,
        userId: result.user_id,
        eligible: result.eligible,
        tier: result.tier,
      },
      'Role update pending (S-7 implementation)'
    );
  }
}

// --------------------------------------------------------------------------
// Default Handlers
// --------------------------------------------------------------------------

/**
 * Default single user eligibility check
 * Uses RPC pool for token balance verification
 */
async function handleSingleCheck(
  payload: EligibilityCheckPayload,
  log: Logger
): Promise<EligibilityResult> {
  const { user_id, wallet_address, community_id } = payload;

  if (!user_id || !wallet_address) {
    log.warn({ eventId: payload.event_id }, 'Missing user_id or wallet_address for single check');
    return {
      user_id: user_id ?? 'unknown',
      wallet_address: wallet_address ?? 'unknown',
      eligible: false,
      tier: null,
      token_balance: '0',
      rules_passed: [],
      rules_failed: ['missing_data'],
      checked_at: Date.now(),
    };
  }

  log.debug(
    { userId: user_id, walletAddress: wallet_address, communityId: community_id },
    'Checking single user eligibility'
  );

  // TODO: Implement actual RPC call via RPCPool (S-2)
  // TODO: Check against community eligibility rules
  // For now, return placeholder result
  return {
    user_id,
    wallet_address,
    eligible: false,
    tier: null,
    token_balance: '0',
    rules_passed: [],
    rules_failed: ['not_implemented'],
    checked_at: Date.now(),
  };
}

/**
 * Batch eligibility check for multiple users
 */
async function handleBatchCheck(
  payload: EligibilityCheckPayload,
  log: Logger
): Promise<EligibilityResult[]> {
  const { community_id, data } = payload;
  const users = data['users'] as Array<{ user_id: string; wallet_address: string }> | undefined;

  if (!users || users.length === 0) {
    log.warn({ eventId: payload.event_id }, 'No users provided for batch check');
    return [];
  }

  log.info(
    { communityId: community_id, userCount: users.length },
    'Processing batch eligibility check'
  );

  // TODO: Implement batch RPC calls
  // For now, return placeholder results
  return users.map((user) => ({
    user_id: user.user_id,
    wallet_address: user.wallet_address,
    eligible: false,
    tier: null,
    token_balance: '0',
    rules_passed: [],
    rules_failed: ['not_implemented'],
    checked_at: Date.now(),
  }));
}

/**
 * Community-wide sync for all members
 */
async function handleCommunitySync(
  payload: EligibilityCheckPayload,
  log: Logger
): Promise<EligibilityResult[]> {
  const { community_id, guild_id } = payload;

  log.info(
    { communityId: community_id, guildId: guild_id },
    'Starting community-wide eligibility sync'
  );

  // TODO: Implement community sync
  // 1. Load all profiles for community from PostgreSQL
  // 2. Batch check eligibility for all with wallets
  // 3. Update roles for changed eligibility
  // 4. Store results in ScyllaDB for audit

  return [];
}

// --------------------------------------------------------------------------
// Factory
// --------------------------------------------------------------------------

/**
 * Create default eligibility handlers map
 */
export function createDefaultEligibilityHandlers(): Map<string, EligibilityHandler> {
  const handlers = new Map<string, EligibilityHandler>();

  handlers.set('single', handleSingleCheck);
  handlers.set('batch', handleBatchCheck);
  handlers.set('community_sync', handleCommunitySync);

  return handlers;
}

/**
 * Create eligibility consumer with default config
 * Uses longer ack wait due to RPC call latency
 */
export function createEligibilityNatsConsumer(
  discordRest: DiscordRestService,
  handlers: Map<string, EligibilityHandler> | undefined,
  logger: Logger
): EligibilityNatsConsumer {
  return new EligibilityNatsConsumer(
    {
      streamName: 'ELIGIBILITY',
      consumerName: 'eligibility-worker',
      filterSubjects: ['eligibility.check.*'],
      maxAckPending: 200, // Higher for batch operations
      ackWait: 60_000, // 60s for RPC calls
      maxDeliver: 3,
      batchSize: 5, // Lower batch size due to expensive operations
    },
    discordRest,
    handlers ?? createDefaultEligibilityHandlers(),
    logger
  );
}

/**
 * Create sync consumer with longer timeout
 * For community-wide eligibility syncs
 */
export function createSyncNatsConsumer(
  discordRest: DiscordRestService,
  handlers: Map<string, EligibilityHandler> | undefined,
  logger: Logger
): EligibilityNatsConsumer {
  return new EligibilityNatsConsumer(
    {
      streamName: 'ELIGIBILITY',
      consumerName: 'sync-worker',
      filterSubjects: ['eligibility.sync.*'],
      maxAckPending: 10, // Low concurrency for heavy syncs
      ackWait: 300_000, // 5 minutes for full community sync
      maxDeliver: 2,
      batchSize: 1, // One sync at a time
    },
    discordRest,
    handlers ?? createDefaultEligibilityHandlers(),
    logger
  );
}
