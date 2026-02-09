/**
 * Agent Gateway Routes
 * Sprint S1-T5: JWKS Express route (Sprint 1 — partial)
 *
 * Public JWKS endpoint for loa-finn JWT verification.
 * Agent API routes (invoke, stream) added in Sprint 4.
 *
 * @see SDD §4.2 JWKS Endpoint
 * @see Trust Boundary §3.1 JWKS Trust Model
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { JWK } from 'jose';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/** Dependencies for agent routes (injected by factory) */
export interface AgentRoutesDeps {
  /** Returns JWKS keys from JwtService */
  getJwks: () => { keys: JWK[] };
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/** Known JWK private key fields (RSA, EC, OKP, symmetric) */
const PRIVATE_JWK_FIELDS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'] as const;

/**
 * Strip private key fields from a JWK — defense-in-depth at the route boundary.
 * JwtService already exports only public JWKs, but this ensures no private
 * material can ever leak through the public JWKS endpoint.
 */
function stripPrivateJwk(jwk: JWK): JWK {
  const pub = { ...jwk };
  for (const field of PRIVATE_JWK_FIELDS) {
    delete (pub as Record<string, unknown>)[field];
  }
  return pub;
}

/**
 * Constant-time ETag comparison for conditional requests.
 */
function matchesEtag(header: string | string[] | undefined, etag: string): boolean {
  if (!header) return false;
  const values = Array.isArray(header)
    ? header
    : header.split(',').map(v => v.trim());

  for (const candidate of values) {
    if (candidate.length !== etag.length) continue;
    if (timingSafeEqual(Buffer.from(candidate), Buffer.from(etag))) {
      return true;
    }
  }
  return false;
}

// --------------------------------------------------------------------------
// Factory
// --------------------------------------------------------------------------

/**
 * Create agent gateway routes.
 * Sprint 1: JWKS endpoint only. Agent API routes added in Sprint 4.
 */
export function createAgentRoutes(deps: AgentRoutesDeps): Router {
  const router = Router();

  /**
   * GET /.well-known/jwks.json
   *
   * Public endpoint — no authentication required.
   * loa-finn fetches this to verify JWTs signed by Arrakis.
   *
   * Cache-Control: public, max-age=3600 (1 hour)
   * ETag: weak ETag based on JSON hash for conditional requests
   */
  router.get('/.well-known/jwks.json', (req: Request, res: Response) => {
    const jwks = deps.getJwks();
    const publicJwks = { keys: jwks.keys.map(stripPrivateJwk) };
    const body = JSON.stringify(publicJwks);

    // ETag for conditional requests (If-None-Match)
    const etag = `W/"${createHash('sha256').update(body).digest('hex').slice(0, 16)}"`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('ETag', etag);

    // Conditional GET — return 304 if client has matching ETag
    if (matchesEtag(req.headers['if-none-match'], etag)) {
      res.status(304).end();
      return;
    }

    res.send(body);
  });

  return router;
}
