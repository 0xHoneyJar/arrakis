/**
 * =============================================================================
 * SIETCH UNIFIED - OBSERVABILITY SERVICE (OpenTelemetry)
 * =============================================================================
 * 
 * Enterprise-grade observability using OpenTelemetry for:
 * - Distributed tracing
 * - Metrics collection
 * - Structured logging
 * - Error tracking
 * 
 * ENTERPRISE STANDARD: Google SRE best practices for observability.
 * 
 * @module services/observability/observability.service
 */

import { context, trace, SpanStatusCode, Span, SpanKind, Attributes } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// =============================================================================
// TYPES
// =============================================================================

export interface TracingConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  exporterEndpoint?: string;
  samplingRate?: number;
}

export interface MetricLabels {
  [key: string]: string | number;
}

export interface LogContext {
  traceId?: string;
  spanId?: string;
  userId?: string;
  communityId?: string;
  [key: string]: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// =============================================================================
// OBSERVABILITY SERVICE
// =============================================================================

export class ObservabilityService {
  private tracer: trace.Tracer;
  private config: TracingConfig;
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  constructor(config: TracingConfig) {
    this.config = config;
    this.tracer = trace.getTracer(config.serviceName, config.serviceVersion);
    
    console.log(`✅ Observability initialized: ${config.serviceName}@${config.serviceVersion}`);
  }

  // ===========================================================================
  // DISTRIBUTED TRACING
  // ===========================================================================

  /**
   * Start a new span for tracing.
   */
  startSpan(
    name: string,
    options?: {
      kind?: SpanKind;
      attributes?: Attributes;
      parent?: Span;
    }
  ): Span {
    const spanOptions = {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: {
        'service.name': this.config.serviceName,
        'service.version': this.config.serviceVersion,
        'deployment.environment': this.config.environment,
        ...options?.attributes,
      },
    };

    if (options?.parent) {
      const ctx = trace.setSpan(context.active(), options.parent);
      return this.tracer.startSpan(name, spanOptions, ctx);
    }

    return this.tracer.startSpan(name, spanOptions);
  }

  /**
   * Execute function within a traced span.
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options?: {
      kind?: SpanKind;
      attributes?: Attributes;
    }
  ): Promise<T> {
    const span = this.startSpan(name, options);
    
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Add event to current span.
   */
  addSpanEvent(name: string, attributes?: Attributes): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.addEvent(name, attributes);
    }
  }

  /**
   * Set attributes on current span.
   */
  setSpanAttributes(attributes: Attributes): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setAttributes(attributes);
    }
  }

  /**
   * Get current trace ID.
   */
  getCurrentTraceId(): string | undefined {
    const currentSpan = trace.getActiveSpan();
    return currentSpan?.spanContext().traceId;
  }

  // ===========================================================================
  // METRICS
  // ===========================================================================

  /**
   * Increment a counter metric.
   */
  incrementCounter(name: string, value: number = 1, labels?: MetricLabels): void {
    const key = this.metricKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);

    // Log for export
    this.log('debug', `metric.counter`, {
      metric: name,
      value: current + value,
      increment: value,
      labels,
    });
  }

  /**
   * Record a histogram value (for latencies, sizes, etc).
   */
  recordHistogram(name: string, value: number, labels?: MetricLabels): void {
    const key = this.metricKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);

    // Log for export
    this.log('debug', `metric.histogram`, {
      metric: name,
      value,
      labels,
    });
  }

  /**
   * Set a gauge value (point-in-time measurement).
   */
  setGauge(name: string, value: number, labels?: MetricLabels): void {
    const key = this.metricKey(name, labels);
    this.counters.set(key, value);

    this.log('debug', `metric.gauge`, {
      metric: name,
      value,
      labels,
    });
  }

  /**
   * Time a function execution and record as histogram.
   */
  async timeExecution<T>(
    metricName: string,
    fn: () => Promise<T>,
    labels?: MetricLabels
  ): Promise<T> {
    const start = performance.now();
    
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.recordHistogram(metricName, duration, labels);
    }
  }

  /**
   * Get metric statistics (for debugging).
   */
  getMetricStats(name: string, labels?: MetricLabels): {
    count?: number;
    values?: number[];
    mean?: number;
    p50?: number;
    p95?: number;
    p99?: number;
  } {
    const key = this.metricKey(name, labels);
    
    const count = this.counters.get(key);
    const values = this.histograms.get(key);

    if (values && values.length > 0) {
      const sorted = [...values].sort((a, b) => a - b);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      return { values, mean, p50, p95, p99 };
    }

    return { count };
  }

  private metricKey(name: string, labels?: MetricLabels): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  // ===========================================================================
  // STRUCTURED LOGGING
  // ===========================================================================

  /**
   * Log a structured message.
   */
  log(level: LogLevel, message: string, context?: LogContext): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.serviceName,
      version: this.config.serviceVersion,
      environment: this.config.environment,
      traceId: context?.traceId || this.getCurrentTraceId(),
      ...context,
    };

    // Output as JSON for log aggregation
    const output = JSON.stringify(logEntry);

    switch (level) {
      case 'debug':
        if (process.env.NODE_ENV === 'development') console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
      case 'fatal':
        console.error(output);
        break;
    }
  }

  /**
   * Log info message.
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message.
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message.
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.log('error', message, {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }

  // ===========================================================================
  // SLI/SLO HELPERS
  // ===========================================================================

  /**
   * Record an API request for SLI tracking.
   */
  recordApiRequest(params: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    userId?: string;
    communityId?: string;
  }): void {
    const { method, path, statusCode, durationMs, userId, communityId } = params;
    
    // Request count
    this.incrementCounter('http_requests_total', 1, {
      method,
      path,
      status: String(statusCode),
    });

    // Request duration histogram
    this.recordHistogram('http_request_duration_ms', durationMs, {
      method,
      path,
    });

    // Error rate tracking
    if (statusCode >= 400) {
      this.incrementCounter('http_errors_total', 1, {
        method,
        path,
        status: String(statusCode),
      });
    }

    // Log the request
    this.log('info', 'api.request', {
      method,
      path,
      statusCode,
      durationMs,
      userId,
      communityId,
    });
  }

  /**
   * Record a billing event for revenue tracking.
   */
  recordBillingEvent(params: {
    event: 'subscription_created' | 'subscription_cancelled' | 'boost_purchased' | 'badge_purchased' | 'payment_failed';
    amount?: number;
    currency?: string;
    communityId?: string;
    userId?: string;
    tier?: string;
  }): void {
    const { event, amount, currency, communityId, userId, tier } = params;

    this.incrementCounter('billing_events_total', 1, { event, tier: tier || 'unknown' });
    
    if (amount) {
      this.recordHistogram('billing_amount', amount, { event, currency: currency || 'usd' });
    }

    this.log('info', `billing.${event}`, {
      amount,
      currency,
      communityId,
      userId,
      tier,
    });
  }

  /**
   * Record a verification event.
   */
  recordVerificationEvent(params: {
    event: 'started' | 'completed' | 'failed' | 'expired';
    platform: 'discord' | 'telegram';
    durationMs?: number;
    userId?: string;
    errorReason?: string;
  }): void {
    const { event, platform, durationMs, userId, errorReason } = params;

    this.incrementCounter('verification_events_total', 1, { event, platform });
    
    if (durationMs) {
      this.recordHistogram('verification_duration_ms', durationMs, { platform });
    }

    this.log('info', `verification.${event}`, {
      platform,
      durationMs,
      userId,
      errorReason,
    });
  }

  /**
   * Record a boost level change.
   */
  recordBoostLevelChange(params: {
    communityId: string;
    previousLevel: number;
    newLevel: number;
    totalBoosts: number;
  }): void {
    const { communityId, previousLevel, newLevel, totalBoosts } = params;
    
    this.setGauge('community_boost_level', newLevel, { communityId });
    this.setGauge('community_total_boosts', totalBoosts, { communityId });

    this.log('info', 'boost.level_change', {
      communityId,
      previousLevel,
      newLevel,
      totalBoosts,
      direction: newLevel > previousLevel ? 'upgrade' : 'downgrade',
    });
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let observabilityInstance: ObservabilityService | null = null;

export function getObservability(config?: TracingConfig): ObservabilityService {
  if (!observabilityInstance) {
    observabilityInstance = new ObservabilityService(config || {
      serviceName: process.env.SERVICE_NAME || 'sietch-unified',
      serviceVersion: process.env.SERVICE_VERSION || '2.4.0',
      environment: process.env.NODE_ENV || 'development',
    });
  }
  return observabilityInstance;
}

// =============================================================================
// MIDDLEWARE FACTORY
// =============================================================================

/**
 * Create Hono middleware for request tracing.
 */
export function createTracingMiddleware() {
  const obs = getObservability();

  return async (c: any, next: () => Promise<void>) => {
    const start = performance.now();
    const method = c.req.method;
    const path = c.req.path;

    await obs.withSpan(
      `${method} ${path}`,
      async (span) => {
        span.setAttribute('http.method', method);
        span.setAttribute('http.url', c.req.url);
        span.setAttribute('http.route', path);

        try {
          await next();
          
          span.setAttribute('http.status_code', c.res.status);
        } finally {
          const duration = performance.now() - start;
          
          obs.recordApiRequest({
            method,
            path,
            statusCode: c.res.status,
            durationMs: duration,
            userId: c.req.header('x-identity-id'),
            communityId: c.req.header('x-community-id'),
          });
        }
      },
      { kind: SpanKind.SERVER }
    );
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export const obs = {
  get: () => getObservability(),
  span: <T>(name: string, fn: (span: Span) => Promise<T>) => getObservability().withSpan(name, fn),
  time: <T>(metric: string, fn: () => Promise<T>) => getObservability().timeExecution(metric, fn),
  counter: (name: string, value?: number, labels?: MetricLabels) => 
    getObservability().incrementCounter(name, value, labels),
  histogram: (name: string, value: number, labels?: MetricLabels) =>
    getObservability().recordHistogram(name, value, labels),
  log: (level: LogLevel, message: string, context?: LogContext) =>
    getObservability().log(level, message, context),
  info: (message: string, context?: LogContext) => getObservability().info(message, context),
  warn: (message: string, context?: LogContext) => getObservability().warn(message, context),
  error: (message: string, error?: Error, context?: LogContext) =>
    getObservability().error(message, error, context),
};
