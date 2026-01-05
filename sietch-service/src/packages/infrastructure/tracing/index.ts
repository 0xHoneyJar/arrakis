/**
 * Unified Tracing Module - Cross-Service Request Tracing
 *
 * Sprint 69: Unified Tracing & Resilience
 *
 * Provides request-scoped trace context for distributed tracing,
 * logging correlation, and database query attribution.
 *
 * @module packages/infrastructure/tracing
 *
 * @example
 * ```typescript
 * import {
 *   createTraceContext,
 *   runWithTrace,
 *   getCurrentTrace,
 *   withSpan,
 *   traceMiddleware
 * } from '../packages/infrastructure/tracing';
 *
 * // Express middleware usage
 * app.use(traceMiddleware());
 *
 * // Manual trace context
 * const ctx = createTraceContext({ tenantId: 'guild-123' });
 * await runWithTraceAsync(ctx, async () => {
 *   // All operations here have trace context
 *   const trace = getCurrentTrace();
 *   console.log('Trace ID:', trace?.traceId);
 * });
 *
 * // Span tracking for operations
 * const result = await withSpan('database.query', async () => {
 *   return await db.query('SELECT * FROM users');
 * });
 * ```
 */

// Core types
export type {
  TraceContext,
  Span,
  CreateTraceOptions,
  CreateSpanOptions,
} from './TraceContext';

// Constants
export { TRACE_HEADERS } from './TraceContext';

// Utility functions
export { generateId, generateSpanId } from './TraceContext';

// Core trace functions
export {
  createTraceContext,
  getCurrentTrace,
  getTraceId,
  getSpanId,
  runWithTrace,
  runWithTraceAsync,
} from './TraceContext';

// Span functions
export { createSpan, withSpan } from './TraceContext';

// Attribute functions
export {
  setTraceAttribute,
  setTenantId,
  setUserId,
} from './TraceContext';

// HTTP header functions
export {
  extractTraceFromHeaders,
  injectTraceHeaders,
  getTraceLogFields,
} from './TraceContext';

// SQL helper
export { getTraceSqlComment } from './TraceContext';

// Express middleware
export { traceMiddleware } from './TraceContext';

// Database tracing
export {
  TracedDatabase,
  createTracedDatabase,
} from './TracedDatabase';

export type {
  QueryStats,
  QueryStatsCallback,
  TracedDatabaseOptions,
} from './TracedDatabase';

// Redis tracing
export {
  withRedisTrace,
  withRedisTraceSync,
  createTracedRedisOps,
  parseRedisKey,
} from './TracedRedis';

export type {
  RedisOperationStats,
  RedisStatsCallback,
  TracedRedisOptions,
} from './TracedRedis';
