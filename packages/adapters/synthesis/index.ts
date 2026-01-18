/**
 * Synthesis Adapters
 *
 * Sprint S-21: Synthesis Engine & Rate Limiting
 *
 * Exports:
 * - SynthesisEngine: BullMQ-based async job processor
 * - GlobalTokenBucket: Redis-backed rate limiter
 * - Metrics: Prometheus metrics for monitoring
 *
 * @see SDD §6.3.4 Synthesis Engine
 * @see SDD §6.3.5 Global Token Bucket
 */

// Engine
export {
  SynthesisEngine,
  createSynthesisEngine,
  type SynthesisEngineOptions,
  type BullMQQueue,
  type BullMQWorker,
  type BullMQJob,
  type JobOptions,
  type DiscordRestClient,
  type QueueFactory,
} from './engine.js';

// Token Bucket
export {
  GlobalTokenBucket,
  createGlobalTokenBucket,
  type TokenBucketOptions,
  type TokenBucketMetrics,
  type RedisClient,
} from './token-bucket.js';

// Metrics
export {
  createNoOpMetrics,
  trackDiscord429Error,
  JobMetrics,
  SYNTHESIS_METRIC_DEFINITIONS,
  type SynthesisMetrics,
  type CounterMetric,
  type GaugeMetric,
  type HistogramMetric,
} from './metrics.js';
