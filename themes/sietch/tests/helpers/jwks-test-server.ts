/**
 * JWKS Test Server & JWT/JWS Signers
 * Sprint 3, Task 3.4: Test fixtures for JWKS E2E contract tests
 *
 * Provides:
 * - Local HTTP JWKS server on ephemeral port
 * - Multi-kid JWT signer (ES256 P-256)
 * - Multi-kid JWS signer (ES256 P-256)
 * - Controllable key rotation (old-only → overlap → new-only)
 *
 * @see SDD §7.2.2 JWKS Caching & Key Rotation Contract
 */

import { createServer, type Server } from 'node:http';
import { generateKeyPairSync, createPublicKey } from 'node:crypto';
import { SignJWT, CompactSign, exportJWK, importPKCS8 } from 'jose';
import type { JWK, KeyLike } from 'jose';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface TestKeyPair {
  kid: string;
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];
  publicJwk: JWK;
  privateKeyLike: KeyLike;
}

export interface JwksTestServer {
  /** Base URL including port, e.g. http://127.0.0.1:9876 */
  url: string;
  /** Current key set served by the server */
  keys: TestKeyPair[];
  /** Replace the key set served by the JWKS endpoint */
  setKeys(keys: TestKeyPair[]): void;
  /** Shut down the HTTP server */
  close(): Promise<void>;
}

// --------------------------------------------------------------------------
// Key generation
// --------------------------------------------------------------------------

/** Generate a test EC P-256 key pair with kid and jose-compatible private key */
export async function generateTestKey(kid: string): Promise<TestKeyPair> {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const publicKey = createPublicKey(privateKey);
  const publicJwk = await exportJWK(publicKey);
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  const privateKeyLike = await importPKCS8(pem, 'ES256');

  return { kid, privateKey, publicJwk, privateKeyLike };
}

// --------------------------------------------------------------------------
// JWKS Test Server
// --------------------------------------------------------------------------

/**
 * Start a local HTTP JWKS server on an ephemeral port.
 * Serves GET /.well-known/jwks.json with the configured key set.
 */
export async function startJwksServer(initialKeys: TestKeyPair[]): Promise<JwksTestServer> {
  let currentKeys = initialKeys;

  const server = createServer((req, res) => {
    if (req.url === '/.well-known/jwks.json' && req.method === 'GET') {
      const jwks = {
        keys: currentKeys.map((k) => ({
          ...k.publicJwk,
          kid: k.kid,
          alg: 'ES256',
          use: 'sig',
          kty: 'EC',
          crv: 'P-256',
        })),
      };
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, must-revalidate',
      });
      res.end(JSON.stringify(jwks));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const url = `http://127.0.0.1:${port}`;

  return {
    url,
    get keys() { return currentKeys; },
    setKeys(keys: TestKeyPair[]) { currentKeys = keys; },
    close: () => new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    }),
  };
}

// --------------------------------------------------------------------------
// JWT Signer
// --------------------------------------------------------------------------

/** Sign a JWT with the specified test key and claims */
export async function signTestJwt(
  key: TestKeyPair,
  claims: Record<string, unknown>,
  options?: { expirySec?: number; iat?: number },
): Promise<string> {
  const now = options?.iat ?? Math.floor(Date.now() / 1000);
  const expirySec = options?.expirySec ?? 120;

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', kid: key.kid, typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + expirySec)
    .sign(key.privateKeyLike);
}

// --------------------------------------------------------------------------
// JWS Signer
// --------------------------------------------------------------------------

/** Sign raw bytes in JWS Compact Serialization format (for usage reports) */
export async function signTestJws(
  key: TestKeyPair,
  payload: Uint8Array | string,
): Promise<string> {
  const bytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;

  return new CompactSign(bytes)
    .setProtectedHeader({ alg: 'ES256', kid: key.kid, typ: 'JWS' })
    .sign(key.privateKeyLike);
}
