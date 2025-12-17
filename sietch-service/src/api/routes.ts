import { Router } from 'express';
import { z } from 'zod';
import type { Response, Request } from 'express';
import type { AuthenticatedRequest } from './middleware.js';
import {
  publicRateLimiter,
  adminRateLimiter,
  requireApiKey,
  ValidationError,
  NotFoundError,
} from './middleware.js';
import {
  getCurrentEligibility,
  getEligibilityByAddress,
  getHealthStatus,
  getActiveAdminOverrides,
  createAdminOverride,
  deactivateAdminOverride,
  getAuditLog,
  logAuditEvent,
} from '../db/index.js';
import { config } from '../config.js';
import type { EligibilityResponse, HealthResponse } from '../types/index.js';

/**
 * Public routes (rate limited, no auth required)
 */
export const publicRouter = Router();

// Apply public rate limiting
publicRouter.use(publicRateLimiter);

/**
 * GET /eligibility
 * Returns top 69 eligible wallets
 */
publicRouter.get('/eligibility', (_req: Request, res: Response) => {
  const eligibility = getCurrentEligibility();
  const health = getHealthStatus();

  const top69 = eligibility
    .filter((e) => e.rank !== undefined && e.rank <= 69)
    .map((e) => ({
      rank: e.rank!,
      address: e.address,
      bgt_held: Number(e.bgtHeld) / 1e18, // Convert from wei to BGT
    }));

  const top7 = eligibility
    .filter((e) => e.role === 'naib')
    .map((e) => e.address);

  const response: EligibilityResponse = {
    updated_at: health.lastSuccessfulQuery?.toISOString() ?? new Date().toISOString(),
    grace_period: health.inGracePeriod,
    top_69: top69,
    top_7: top7,
  };

  // Set cache headers (5 minutes)
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(response);
});

/**
 * GET /eligibility/:address
 * Check eligibility for a specific address
 */
publicRouter.get('/eligibility/:address', (req: Request, res: Response) => {
  const address = req.params.address;

  if (!address) {
    throw new ValidationError('Address parameter is required');
  }

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new ValidationError('Invalid Ethereum address format');
  }

  const entry = getEligibilityByAddress(address);

  if (!entry) {
    res.json({
      address: address.toLowerCase(),
      eligible: false,
      rank: null,
      role: 'none',
      bgt_held: null,
    });
    return;
  }

  res.json({
    address: entry.address,
    eligible: entry.rank !== undefined && entry.rank <= 69,
    rank: entry.rank ?? null,
    role: entry.role,
    bgt_held: Number(entry.bgtHeld) / 1e18,
  });
});

/**
 * GET /health
 * Returns service health status
 */
publicRouter.get('/health', (_req: Request, res: Response) => {
  const health = getHealthStatus();

  // Calculate next scheduled query (every 6 hours)
  const lastQuery = health.lastSuccessfulQuery ?? new Date();
  const nextQuery = new Date(lastQuery.getTime() + 6 * 60 * 60 * 1000);

  const response: HealthResponse = {
    status: health.inGracePeriod ? 'degraded' : 'healthy',
    last_successful_query: health.lastSuccessfulQuery?.toISOString() ?? null,
    next_query: nextQuery.toISOString(),
    grace_period: health.inGracePeriod,
  };

  // Use 200 even for degraded - it's still functioning
  res.json(response);
});

/**
 * Admin routes (rate limited, API key required)
 */
export const adminRouter = Router();

// Apply admin rate limiting and authentication
adminRouter.use(adminRateLimiter);
adminRouter.use(requireApiKey);

/**
 * Zod schema for admin override request
 */
const adminOverrideSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  action: z.enum(['add', 'remove']),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
  expires_at: z.string().datetime().optional(),
});

/**
 * POST /admin/override
 * Create an admin override
 */
adminRouter.post('/override', (req: AuthenticatedRequest, res: Response) => {
  const result = adminOverrideSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message).join(', ');
    throw new ValidationError(errors);
  }

  const { address, action, reason, expires_at } = result.data;

  const overrideId = createAdminOverride({
    address,
    action,
    reason,
    createdBy: req.adminName!,
    expiresAt: expires_at ? new Date(expires_at) : null,
  });

  res.status(201).json({
    id: overrideId,
    message: `Override created: ${action} ${address}`,
  });
});

/**
 * GET /admin/overrides
 * List all active admin overrides
 */
adminRouter.get('/overrides', (_req: AuthenticatedRequest, res: Response) => {
  const overrides = getActiveAdminOverrides();

  res.json({
    overrides: overrides.map((o) => ({
      id: o.id,
      address: o.address,
      action: o.action,
      reason: o.reason,
      created_by: o.createdBy,
      created_at: o.createdAt.toISOString(),
      expires_at: o.expiresAt?.toISOString() ?? null,
    })),
  });
});

/**
 * DELETE /admin/override/:id
 * Deactivate an admin override
 */
adminRouter.delete('/override/:id', (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.id;
  if (!idParam) {
    throw new ValidationError('Override ID is required');
  }
  const id = parseInt(idParam, 10);

  if (isNaN(id)) {
    throw new ValidationError('Invalid override ID');
  }

  const success = deactivateAdminOverride(id);

  if (!success) {
    throw new NotFoundError('Override not found');
  }

  logAuditEvent('admin_override', {
    action: 'deactivate',
    overrideId: id,
    deactivatedBy: req.adminName,
  });

  res.json({ message: 'Override deactivated' });
});

/**
 * Zod schema for audit log query params
 */
const auditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  event_type: z
    .enum([
      'eligibility_update',
      'admin_override',
      'member_removed',
      'member_added',
      'naib_promotion',
      'naib_demotion',
      'grace_period_entered',
      'grace_period_exited',
    ])
    .optional(),
  since: z.string().datetime().optional(),
});

/**
 * GET /admin/audit-log
 * Get audit log entries
 */
adminRouter.get('/audit-log', (req: AuthenticatedRequest, res: Response) => {
  const result = auditLogQuerySchema.safeParse(req.query);

  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message).join(', ');
    throw new ValidationError(errors);
  }

  const { limit, event_type, since } = result.data;

  const entries = getAuditLog({
    limit,
    eventType: event_type,
    since: since ? new Date(since) : undefined,
  });

  res.json({
    entries: entries.map((e) => ({
      id: e.id,
      event_type: e.eventType,
      event_data: e.eventData,
      created_at: e.createdAt.toISOString(),
    })),
  });
});

/**
 * GET /admin/health
 * Get detailed health status (more info than public endpoint)
 */
adminRouter.get('/health', (_req: AuthenticatedRequest, res: Response) => {
  const health = getHealthStatus();

  res.json({
    last_successful_query: health.lastSuccessfulQuery?.toISOString() ?? null,
    last_query_attempt: health.lastQueryAttempt?.toISOString() ?? null,
    consecutive_failures: health.consecutiveFailures,
    in_grace_period: health.inGracePeriod,
    grace_period_hours: config.gracePeriod.hours,
  });
});
