/**
 * S2S JWT Auth Middleware — Inbound loa-finn → arrakis authentication
 *
 * Express middleware that validates S2S JWT Bearer tokens from loa-finn,
 * attaches validated claims to the request for downstream handlers.
 *
 * @see SDD §3.1 S2SJwtValidator
 * @see SDD §3.2 UsageReceiver
 */

import type { Request, Response, NextFunction } from 'express'
import type { Logger } from 'pino'
import type { S2SJwtValidator, S2SJwtPayload } from './s2s-jwt-validator.js'

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/** Extended request with validated S2S JWT claims */
export interface S2SAuthenticatedRequest extends Request {
  s2sClaims: S2SJwtPayload
}

export interface S2SAuthMiddlewareDeps {
  s2sValidator: S2SJwtValidator
  logger: Logger
}

// --------------------------------------------------------------------------
// Factory
// --------------------------------------------------------------------------

/**
 * Create S2S JWT auth middleware.
 * Extracts Bearer token from Authorization header, validates via S2SJwtValidator,
 * and attaches claims to `req.s2sClaims`.
 */
export function createS2SAuthMiddleware(deps: S2SAuthMiddlewareDeps) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' })
      return
    }

    const token = authHeader.slice(7) // Strip "Bearer "
    if (!token) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Empty bearer token' })
      return
    }

    try {
      const claims = await deps.s2sValidator.validateJwt(token)

      // Attach validated claims to request
      ;(req as S2SAuthenticatedRequest).s2sClaims = claims

      next()
    } catch (err) {
      deps.logger.warn({ err }, 'S2S JWT validation failed')
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired S2S token' })
    }
  }
}
