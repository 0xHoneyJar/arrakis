/**
 * =============================================================================
 * SIETCH UNIFIED - CIRCUIT BREAKER SERVICE
 * =============================================================================
 * 
 * Implements the Circuit Breaker pattern for external API resilience.
 * Prevents cascading failures when external services (Collab.Land, Dune, Stripe)
 * experience latency or outages.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered
 * 
 * ENTERPRISE STANDARD: Netflix Hystrix / AWS patterns for fault tolerance.
 * 
 * @module services/resilience/circuit-breaker.service
 */

import Redis from 'ioredis';
import { getObservability } from '../observability/observability.service';

// =============================================================================
// TYPES
// =============================================================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitConfig {
  name: string;
  failureThreshold: number;      // Failures before opening
  successThreshold: number;      // Successes in half-open before closing
  timeout: number;               // Request timeout in ms
  resetTimeout: number;          // Time before trying again (ms)
  volumeThreshold: number;       // Min requests before circuit can open
  errorPercentageThreshold: number;  // Error % to open circuit
  gracePeriodHours: number;      // Grace period for members during outage
}

export interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  openedAt?: Date;
  nextRetryAt?: Date;
}

export interface CircuitBreakerResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  circuitOpen: boolean;
  executionTime: number;
}

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

export const DEFAULT_CIRCUIT_CONFIGS: Record<string, CircuitConfig> = {
  collabland: {
    name: 'collabland',
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 10000,        // 10s
    resetTimeout: 60000,   // 1 minute
    volumeThreshold: 10,
    errorPercentageThreshold: 50,
    gracePeriodHours: 24,
  },
  stripe: {
    name: 'stripe',
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 15000,        // 15s
    resetTimeout: 30000,   // 30 seconds
    volumeThreshold: 5,
    errorPercentageThreshold: 40,
    gracePeriodHours: 48,  // Longer for billing
  },
  dune: {
    name: 'dune',
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 30000,        // 30s (queries can be slow)
    resetTimeout: 120000,  // 2 minutes
    volumeThreshold: 20,
    errorPercentageThreshold: 60,
    gracePeriodHours: 24,
  },
  rpc: {
    name: 'rpc',
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 5000,         // 5s
    resetTimeout: 60000,   // 1 minute
    volumeThreshold: 10,
    errorPercentageThreshold: 50,
    gracePeriodHours: 24,
  },
};

// =============================================================================
// CIRCUIT BREAKER
// =============================================================================

export class CircuitBreaker {
  private config: CircuitConfig;
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailure?: Date;
  private lastSuccess?: Date;
  private openedAt?: Date;
  private requestCount: number = 0;
  private obs = getObservability();

  constructor(config: CircuitConfig) {
    this.config = config;
  }

  /**
   * Execute a function with circuit breaker protection.
   */
  async execute<T>(fn: () => Promise<T>): Promise<CircuitBreakerResult<T>> {
    const startTime = performance.now();

    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        this.obs.warn('circuit_open_rejected', { 
          circuit: this.config.name,
          nextRetryAt: this.getNextRetryTime(),
        });
        return {
          success: false,
          circuitOpen: true,
          executionTime: performance.now() - startTime,
          error: new Error(`Circuit ${this.config.name} is open`),
        };
      }
    }

    this.requestCount++;

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      
      return {
        success: true,
        data: result,
        circuitOpen: false,
        executionTime: performance.now() - startTime,
      };
    } catch (error) {
      this.onFailure(error as Error);
      
      return {
        success: false,
        error: error as Error,
        circuitOpen: this.state === 'OPEN',
        executionTime: performance.now() - startTime,
      };
    }
  }

  /**
   * Execute function with timeout.
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout after ${this.config.timeout}ms`));
        }, this.config.timeout);
      }),
    ]);
  }

  /**
   * Handle successful execution.
   */
  private onSuccess(): void {
    this.lastSuccess = new Date();
    this.successes++;
    this.failures = 0;

    if (this.state === 'HALF_OPEN') {
      if (this.successes >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    }

    this.obs.counter('circuit_breaker_success', 1, { circuit: this.config.name });
  }

  /**
   * Handle failed execution.
   */
  private onFailure(error: Error): void {
    this.lastFailure = new Date();
    this.failures++;
    this.successes = 0;

    this.obs.warn('circuit_breaker_failure', {
      circuit: this.config.name,
      failures: this.failures,
      error: error.message,
    });

    if (this.state === 'HALF_OPEN') {
      this.transitionToOpen();
    } else if (this.state === 'CLOSED') {
      // Check if we should open the circuit
      if (this.shouldOpen()) {
        this.transitionToOpen();
      }
    }

    this.obs.counter('circuit_breaker_failure', 1, { circuit: this.config.name });
  }

  /**
   * Check if circuit should open.
   */
  private shouldOpen(): boolean {
    // Need minimum volume before opening
    if (this.requestCount < this.config.volumeThreshold) {
      return false;
    }

    // Check failure threshold
    if (this.failures >= this.config.failureThreshold) {
      return true;
    }

    // Check error percentage
    const errorRate = (this.failures / this.requestCount) * 100;
    return errorRate >= this.config.errorPercentageThreshold;
  }

  /**
   * Check if we should attempt reset.
   */
  private shouldAttemptReset(): boolean {
    if (!this.openedAt) return true;
    const elapsed = Date.now() - this.openedAt.getTime();
    return elapsed >= this.config.resetTimeout;
  }

  /**
   * Get next retry time.
   */
  private getNextRetryTime(): Date | null {
    if (!this.openedAt) return null;
    return new Date(this.openedAt.getTime() + this.config.resetTimeout);
  }

  // ===========================================================================
  // STATE TRANSITIONS
  // ===========================================================================

  private transitionToOpen(): void {
    this.state = 'OPEN';
    this.openedAt = new Date();
    this.obs.warn('circuit_opened', {
      circuit: this.config.name,
      failures: this.failures,
      gracePeriodHours: this.config.gracePeriodHours,
    });
    this.obs.counter('circuit_breaker_state_change', 1, { 
      circuit: this.config.name, 
      state: 'OPEN' 
    });
  }

  private transitionToHalfOpen(): void {
    this.state = 'HALF_OPEN';
    this.successes = 0;
    this.obs.info('circuit_half_open', { circuit: this.config.name });
    this.obs.counter('circuit_breaker_state_change', 1, { 
      circuit: this.config.name, 
      state: 'HALF_OPEN' 
    });
  }

  private transitionToClosed(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.openedAt = undefined;
    this.requestCount = 0;
    this.obs.info('circuit_closed', { circuit: this.config.name });
    this.obs.counter('circuit_breaker_state_change', 1, { 
      circuit: this.config.name, 
      state: 'CLOSED' 
    });
  }

  // ===========================================================================
  // STATE ACCESSORS
  // ===========================================================================

  getState(): CircuitState {
    return this.state;
  }

  getStats(): CircuitStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      openedAt: this.openedAt,
      nextRetryAt: this.getNextRetryTime() || undefined,
    };
  }

  getConfig(): CircuitConfig {
    return { ...this.config };
  }

  /**
   * Check if in grace period (for member protection during outages).
   */
  isInGracePeriod(): boolean {
    if (this.state !== 'OPEN' || !this.openedAt) {
      return false;
    }
    const gracePeriodMs = this.config.gracePeriodHours * 60 * 60 * 1000;
    const elapsed = Date.now() - this.openedAt.getTime();
    return elapsed < gracePeriodMs;
  }

  /**
   * Check if stale cache should be used (24hr grace period active).
   * During grace period, return cached verification data instead of failing.
   */
  shouldUseStaleCache(): boolean {
    return this.state === 'OPEN' && this.isInGracePeriod();
  }

  /**
   * Get time remaining in grace period.
   */
  getGracePeriodRemaining(): number | null {
    if (!this.isInGracePeriod() || !this.openedAt) {
      return null;
    }
    const gracePeriodMs = this.config.gracePeriodHours * 60 * 60 * 1000;
    const elapsed = Date.now() - this.openedAt.getTime();
    return Math.max(0, gracePeriodMs - elapsed);
  }

  /**
   * Force reset the circuit (admin operation).
   */
  forceReset(): void {
    this.transitionToClosed();
    this.obs.info('circuit_force_reset', { circuit: this.config.name });
  }
}

// =============================================================================
// CIRCUIT BREAKER MANAGER
// =============================================================================

export class CircuitBreakerManager {
  private circuits: Map<string, CircuitBreaker> = new Map();
  private redis?: Redis;
  private obs = getObservability();

  constructor(redis?: Redis) {
    this.redis = redis;
    
    // Initialize default circuits
    for (const [name, config] of Object.entries(DEFAULT_CIRCUIT_CONFIGS)) {
      this.circuits.set(name, new CircuitBreaker(config));
    }
    
    console.log(`✅ Circuit Breaker Manager initialized: ${this.circuits.size} circuits`);
  }

  /**
   * Get or create a circuit breaker.
   */
  getCircuit(name: string, config?: Partial<CircuitConfig>): CircuitBreaker {
    let circuit = this.circuits.get(name);
    
    if (!circuit) {
      const fullConfig: CircuitConfig = {
        name,
        ...DEFAULT_CIRCUIT_CONFIGS.collabland, // Use collabland as template
        ...config,
      };
      circuit = new CircuitBreaker(fullConfig);
      this.circuits.set(name, circuit);
    }
    
    return circuit;
  }

  /**
   * Execute with circuit breaker protection.
   */
  async execute<T>(
    circuitName: string,
    fn: () => Promise<T>
  ): Promise<CircuitBreakerResult<T>> {
    const circuit = this.getCircuit(circuitName);
    return circuit.execute(fn);
  }

  /**
   * Get all circuit stats.
   */
  getAllStats(): Record<string, CircuitStats> {
    const stats: Record<string, CircuitStats> = {};
    
    for (const [name, circuit] of this.circuits) {
      stats[name] = circuit.getStats();
    }
    
    return stats;
  }

  /**
   * Check if any critical circuits are open.
   */
  hasCriticalOutage(): boolean {
    const criticalCircuits = ['collabland', 'stripe'];
    
    for (const name of criticalCircuits) {
      const circuit = this.circuits.get(name);
      if (circuit?.getState() === 'OPEN') {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get circuits in grace period (members should not lose access).
   */
  getGracePeriodCircuits(): string[] {
    const inGracePeriod: string[] = [];
    
    for (const [name, circuit] of this.circuits) {
      if (circuit.isInGracePeriod()) {
        inGracePeriod.push(name);
      }
    }
    
    return inGracePeriod;
  }

  /**
   * Force reset all circuits (admin operation).
   */
  forceResetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.forceReset();
    }
    this.obs.info('all_circuits_force_reset');
  }

  /**
   * Execute with stale-cache-optimistic mode during grace period.
   * If circuit is open but in grace period, returns cached data instead of failing.
   */
  async executeWithStaleCache<T>(
    circuitName: string,
    fn: () => Promise<T>,
    getCachedValue: () => Promise<T | null>,
    setCachedValue: (value: T) => Promise<void>
  ): Promise<CircuitBreakerResult<T> & { fromCache?: boolean }> {
    const circuit = this.getCircuit(circuitName);
    
    // If circuit is open and in grace period, try cache first
    if (circuit.shouldUseStaleCache()) {
      const cachedValue = await getCachedValue();
      
      if (cachedValue !== null) {
        this.obs.info('stale_cache_used', {
          circuit: circuitName,
          gracePeriodRemaining: circuit.getGracePeriodRemaining(),
        });
        
        return {
          success: true,
          data: cachedValue,
          circuitOpen: true,
          executionTime: 0,
          fromCache: true,
        };
      }
    }
    
    // Normal execution
    const result = await circuit.execute(fn);
    
    // Cache successful results
    if (result.success && result.data !== undefined) {
      try {
        await setCachedValue(result.data);
      } catch (e) {
        // Don't fail on cache errors
        this.obs.warn('cache_set_failed', { circuit: circuitName });
      }
    }
    
    return { ...result, fromCache: false };
  }

  /**
   * Get all circuits currently using stale cache mode.
   */
  getStaleCapModeCircuits(): Array<{
    name: string;
    gracePeriodRemaining: number;
  }> {
    const results: Array<{ name: string; gracePeriodRemaining: number }> = [];
    
    for (const [name, circuit] of this.circuits) {
      if (circuit.shouldUseStaleCache()) {
        const remaining = circuit.getGracePeriodRemaining();
        if (remaining !== null) {
          results.push({ name, gracePeriodRemaining: remaining });
        }
      }
    }
    
    return results;
  }

  /**
   * Persist circuit states to Redis (for distributed systems).
   */
  async persistState(): Promise<void> {
    if (!this.redis) return;

    const states: Record<string, CircuitStats> = {};
    for (const [name, circuit] of this.circuits) {
      states[name] = circuit.getStats();
    }

    await this.redis.set(
      'circuit_breaker:states',
      JSON.stringify(states),
      'EX',
      300 // 5 minute TTL
    );
  }
}

// =============================================================================
// CONVENIENCE WRAPPERS
// =============================================================================

/**
 * Decorator-style circuit breaker wrapper.
 */
export function withCircuitBreaker<T>(
  manager: CircuitBreakerManager,
  circuitName: string
) {
  return function (fn: () => Promise<T>): Promise<CircuitBreakerResult<T>> {
    return manager.execute(circuitName, fn);
  };
}

/**
 * Create a protected API client.
 */
export function createProtectedClient<T extends object>(
  client: T,
  manager: CircuitBreakerManager,
  circuitName: string
): T {
  return new Proxy(client, {
    get(target, prop) {
      const value = (target as any)[prop];
      
      if (typeof value === 'function') {
        return async (...args: unknown[]) => {
          const result = await manager.execute(circuitName, () => 
            value.apply(target, args)
          );
          
          if (!result.success) {
            throw result.error || new Error('Circuit breaker rejected request');
          }
          
          return result.data;
        };
      }
      
      return value;
    },
  });
}

// =============================================================================
// SINGLETON
// =============================================================================

let circuitBreakerManagerInstance: CircuitBreakerManager | null = null;

export function getCircuitBreakerManager(redis?: Redis): CircuitBreakerManager {
  if (!circuitBreakerManagerInstance) {
    circuitBreakerManagerInstance = new CircuitBreakerManager(redis);
  }
  return circuitBreakerManagerInstance;
}
