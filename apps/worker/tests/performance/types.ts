/**
 * Performance Validation Types
 * Sprint S-14: Performance Validation & Documentation
 *
 * Defines types for performance testing and validation.
 */

/**
 * Performance target definitions from SDD §14.1
 */
export interface PerformanceTarget {
  /** Target name */
  name: string;
  /** Description of what's being measured */
  description: string;
  /** Target threshold value */
  threshold: number;
  /** Unit of measurement */
  unit: 'ms' | 'MB' | '%' | 'req/s' | 'events/s';
  /** Percentile (for latency metrics) */
  percentile?: number;
}

/**
 * Performance test result
 */
export interface PerformanceResult {
  /** Target being tested */
  target: PerformanceTarget;
  /** Measured value */
  measured: number;
  /** Whether target was met */
  passed: boolean;
  /** Test timestamp */
  timestamp: Date;
  /** Additional context/notes */
  notes?: string;
  /** Sample count */
  samples?: number;
}

/**
 * Percentile statistics
 */
export interface PercentileStats {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  count: number;
}

/**
 * Memory snapshot
 */
export interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
  timestamp: Date;
}

/**
 * Load test configuration
 */
export interface LoadTestConfig {
  /** Number of virtual users/connections */
  concurrentUsers: number;
  /** Duration in seconds */
  durationSec: number;
  /** Requests per second target */
  targetRps?: number;
  /** Ramp-up time in seconds */
  rampUpSec?: number;
}

/**
 * Load test result
 */
export interface LoadTestResult {
  config: LoadTestConfig;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  latencyStats: PercentileStats;
  throughput: number;
  errorRate: number;
  duration: number;
}

/**
 * Performance targets from SDD §14.1
 */
export const PERFORMANCE_TARGETS: Record<string, PerformanceTarget> = {
  GATEWAY_MEMORY_1K: {
    name: 'Gateway Memory (1k guilds)',
    description: 'Memory usage per 1000 guilds',
    threshold: 40,
    unit: 'MB',
  },
  GATEWAY_MEMORY_10K: {
    name: 'Gateway Memory (10k guilds)',
    description: 'Memory usage at 10,000 guilds',
    threshold: 200,
    unit: 'MB',
  },
  EVENT_ROUTING_LATENCY: {
    name: 'Event Routing (NATS)',
    description: 'NATS message routing latency',
    threshold: 50,
    unit: 'ms',
    percentile: 99,
  },
  ELIGIBILITY_CACHED: {
    name: 'Eligibility Check (cached)',
    description: 'Cached eligibility check response time',
    threshold: 100,
    unit: 'ms',
    percentile: 99,
  },
  ELIGIBILITY_RPC: {
    name: 'Eligibility Check (RPC)',
    description: 'RPC eligibility check response time',
    threshold: 2000,
    unit: 'ms',
    percentile: 99,
  },
  COMMAND_RESPONSE: {
    name: 'Slash Command Response',
    description: 'User-perceived command response time',
    threshold: 500,
    unit: 'ms',
    percentile: 99,
  },
  DB_QUERY_POSTGRES: {
    name: 'Database Query (PostgreSQL)',
    description: 'PostgreSQL query latency',
    threshold: 10,
    unit: 'ms',
    percentile: 99,
  },
  DB_QUERY_SCYLLA: {
    name: 'Database Query (ScyllaDB)',
    description: 'ScyllaDB query latency',
    threshold: 5,
    unit: 'ms',
    percentile: 99,
  },
  CACHE_HIT_RATE: {
    name: 'Cache Hit Rate',
    description: 'Multi-layer cache effectiveness',
    threshold: 90,
    unit: '%',
  },
  TRACING_OVERHEAD: {
    name: 'Tracing Overhead',
    description: 'Performance impact of distributed tracing',
    threshold: 5,
    unit: '%',
  },
};

/**
 * Calculate percentile from sorted array
 */
export function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)];
}

/**
 * Calculate percentile statistics from array of values
 */
export function calculatePercentileStats(values: number[]): PercentileStats {
  if (values.length === 0) {
    return {
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      min: 0,
      max: 0,
      mean: 0,
      stdDev: 0,
      count: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;

  return {
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    stdDev: Math.sqrt(variance),
    count: values.length,
  };
}

/**
 * Format bytes to human-readable
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let value = bytes;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format duration to human-readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
