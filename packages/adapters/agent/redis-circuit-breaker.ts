/**
 * Redis Circuit Breaker — Fleet-Wide Shared State
 * Cycle 019 Sprint 3, Task 3.3: BB6 Finding #4
 *
 * Shares circuit breaker state across ECS containers via Redis.
 * State transitions are atomic (Lua script — no TOCTOU).
 * Falls back to process-local breaker if Redis is unavailable.
 *
 * States: closed → open → half-open → closed
 *
 * @see SDD §3.4.2 BYOK Manager (circuit breaker requirement)
 * @see Bridgebuilder Round 6, Finding #4 — Fleet Circuit Breaker
 */

import type { Logger } from 'pino';
import type { Redis } from 'ioredis';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface RedisCircuitBreakerConfig {
  /** Failure count threshold to trip the breaker (default: 3) */
  failureThreshold?: number;
  /** Time window for counting failures in ms (default: 30_000) */
  windowMs?: number;
  /** Time to wait before transitioning from open → half-open in ms (default: 60_000) */
  resetMs?: number;
}

// --------------------------------------------------------------------------
// Lua Scripts (atomic state transitions — AC-3.14)
// --------------------------------------------------------------------------

/**
 * CHECK_AND_TRANSITION Lua script:
 * - Reads current state + openedAt from Redis hash
 * - If closed → allow
 * - If open and resetMs elapsed → transition to half-open, allow
 * - If open and not elapsed → deny
 * - If half-open → allow (probe)
 * Returns: [allowed (0|1), state]
 */
const LUA_CHECK = `
local key = KEYS[1]
local resetMs = tonumber(ARGV[1])
local nowMs = tonumber(ARGV[2])

local state = redis.call('HGET', key, 'state')
if not state or state == 'closed' then
  return {1, 'closed'}
end

if state == 'open' then
  local openedAt = tonumber(redis.call('HGET', key, 'openedAt') or '0')
  if (nowMs - openedAt) >= resetMs then
    redis.call('HSET', key, 'state', 'half-open')
    return {1, 'half-open'}
  end
  return {0, 'open'}
end

-- half-open: allow probe
return {1, 'half-open'}
`;

/**
 * ON_SUCCESS Lua script:
 * - If half-open → transition to closed, clear failures
 * - If closed → clear failures
 */
const LUA_SUCCESS = `
local key = KEYS[1]
local state = redis.call('HGET', key, 'state')
if state == 'half-open' then
  redis.call('HSET', key, 'state', 'closed')
  redis.call('HDEL', key, 'openedAt', 'failures')
  return 'closed'
end
redis.call('HDEL', key, 'failures')
return state or 'closed'
`;

/**
 * ON_FAILURE Lua script:
 * - If half-open → re-open immediately
 * - If closed → increment failures; if >= threshold → open
 * Returns: new state
 */
const LUA_FAILURE = `
local key = KEYS[1]
local threshold = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local nowMs = tonumber(ARGV[3])

local state = redis.call('HGET', key, 'state')

if state == 'half-open' then
  redis.call('HSET', key, 'state', 'open', 'openedAt', nowMs)
  return 'open'
end

-- Closed (or nil): record failure
local failures = redis.call('HGET', key, 'failures')
local failList = {}
if failures then
  for ts in string.gmatch(failures, '([^,]+)') do
    local t = tonumber(ts)
    if (nowMs - t) < windowMs then
      table.insert(failList, ts)
    end
  end
end
table.insert(failList, tostring(nowMs))

local newFailures = table.concat(failList, ',')
redis.call('HSET', key, 'failures', newFailures)

if #failList >= threshold then
  redis.call('HSET', key, 'state', 'open', 'openedAt', nowMs)
  return 'open'
end

redis.call('HSET', key, 'state', 'closed')
return 'closed'
`;

// --------------------------------------------------------------------------
// RedisCircuitBreaker
// --------------------------------------------------------------------------

export class RedisCircuitBreaker {
  private readonly redis: Redis;
  private readonly key: string;
  private readonly log: Logger;
  private readonly failureThreshold: number;
  private readonly windowMs: number;
  private readonly resetMs: number;

  // Process-local fallback state (used when Redis is unavailable — AC-3.15)
  private localState: CircuitState = 'closed';
  private localFailures: number[] = [];
  private localOpenedAt = 0;

  constructor(
    redis: Redis,
    component: string,
    logger: Logger,
    config?: RedisCircuitBreakerConfig,
  ) {
    this.redis = redis;
    this.key = `circuit:${component}`;
    this.log = logger.child({ component: 'RedisCircuitBreaker', circuit: component });
    this.failureThreshold = config?.failureThreshold ?? 3;
    this.windowMs = config?.windowMs ?? 30_000;
    this.resetMs = config?.resetMs ?? 60_000;
  }

  /** Check if circuit allows requests + transition half-open if needed (AC-3.13) */
  async isAllowed(): Promise<boolean> {
    try {
      const result = await this.redis.eval(
        LUA_CHECK,
        1,
        this.key,
        this.resetMs,
        Date.now(),
      ) as [number, string];

      const allowed = result[0] === 1;
      const state = result[1] as CircuitState;

      // Sync local state for fallback consistency
      this.localState = state;

      return allowed;
    } catch {
      // Redis unavailable → fall back to local state (AC-3.15)
      this.log.warn('Redis unavailable for circuit check — using local fallback');
      return this.localIsAllowed();
    }
  }

  /** Record successful call — transition half-open → closed (AC-3.14) */
  async onSuccess(): Promise<void> {
    try {
      const newState = await this.redis.eval(
        LUA_SUCCESS,
        1,
        this.key,
      ) as string;

      const prev = this.localState;
      this.localState = (newState as CircuitState) || 'closed';
      this.localFailures = [];

      if (prev !== this.localState) {
        this.log.info(
          { from: prev, to: this.localState },
          'circuit_breaker_state_change',
        );
      }
    } catch {
      this.log.warn('Redis unavailable for circuit success — using local fallback');
      this.localOnSuccess();
    }
  }

  /** Record failed call — may trip breaker open (AC-3.14) */
  async onFailure(): Promise<void> {
    try {
      const newState = await this.redis.eval(
        LUA_FAILURE,
        1,
        this.key,
        this.failureThreshold,
        this.windowMs,
        Date.now(),
      ) as string;

      const prev = this.localState;
      this.localState = (newState as CircuitState) || 'closed';

      if (prev !== this.localState) {
        this.log.info(
          { from: prev, to: this.localState },
          'circuit_breaker_state_change',
        );
      }
    } catch {
      this.log.warn('Redis unavailable for circuit failure — using local fallback');
      this.localOnFailure();
    }
  }

  /** Get current state (from Redis, with local fallback) */
  async getState(): Promise<CircuitState> {
    try {
      const state = await this.redis.hget(this.key, 'state');
      return (state as CircuitState) || 'closed';
    } catch {
      return this.localState;
    }
  }

  // --------------------------------------------------------------------------
  // Process-Local Fallback (AC-3.15)
  // --------------------------------------------------------------------------

  private localIsAllowed(): boolean {
    if (this.localState === 'closed') return true;

    if (this.localState === 'open') {
      if (Date.now() - this.localOpenedAt >= this.resetMs) {
        this.localState = 'half-open';
        return true;
      }
      return false;
    }

    // half-open: allow probe
    return true;
  }

  private localOnSuccess(): void {
    const prev = this.localState;
    if (this.localState === 'half-open') {
      this.localState = 'closed';
    }
    this.localFailures = [];
    if (prev !== this.localState) {
      this.log.info({ from: prev, to: this.localState }, 'circuit_breaker_state_change');
    }
  }

  private localOnFailure(): void {
    const now = Date.now();
    const prev = this.localState;

    if (this.localState === 'half-open') {
      this.localState = 'open';
      this.localOpenedAt = now;
      this.log.info({ from: prev, to: this.localState }, 'circuit_breaker_state_change');
      return;
    }

    this.localFailures = this.localFailures.filter((t) => now - t < this.windowMs);
    this.localFailures.push(now);

    if (this.localFailures.length >= this.failureThreshold) {
      this.localState = 'open';
      this.localOpenedAt = now;
      if (prev !== this.localState) {
        this.log.info({ from: prev, to: this.localState }, 'circuit_breaker_state_change');
      }
    }
  }
}
