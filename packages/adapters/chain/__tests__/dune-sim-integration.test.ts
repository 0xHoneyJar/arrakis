/**
 * Dune Sim Integration Tests
 * Sprint 15: Dune Sim Integration & Rollout
 *
 * End-to-end integration tests that hit the real Dune Sim API.
 * These tests are skipped unless DUNE_SIM_API_KEY is set.
 *
 * Run with: DUNE_SIM_API_KEY=xxx pnpm test dune-sim-integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DuneSimClient } from '../dune-sim-client.js';
import { HybridChainProvider } from '../hybrid-provider.js';
import { NativeBlockchainReader } from '../native-reader.js';
import { createChainProvider, isDuneSimAvailable } from '../provider-factory.js';
import type { Logger } from 'pino';

// --------------------------------------------------------------------------
// Test Setup
// --------------------------------------------------------------------------

const API_KEY = process.env.DUNE_SIM_API_KEY;
const SKIP_REASON = 'DUNE_SIM_API_KEY not set, skipping integration tests';

// Real addresses for testing (public, no risk)
const TEST_ADDRESSES = {
  // Vitalik's address (has ETH balance)
  vitalik: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as const,
  // USDC contract on Ethereum
  usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
  // Bored Ape Yacht Club contract
  bayc: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D' as const,
};

// Mock logger for tests
const createMockLogger = (): Logger =>
  ({
    child: () => createMockLogger(),
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    trace: () => {},
    fatal: () => {},
    silent: () => {},
    level: 'silent',
  }) as unknown as Logger;

// --------------------------------------------------------------------------
// DuneSimClient Integration Tests
// --------------------------------------------------------------------------

describe.skipIf(!API_KEY)('DuneSimClient Integration', () => {
  let client: DuneSimClient;
  const logger = createMockLogger();

  beforeAll(() => {
    if (!API_KEY) {
      console.log(SKIP_REASON);
      return;
    }
    client = new DuneSimClient(logger, {
      apiKey: API_KEY,
      timeoutMs: 30_000, // Longer timeout for real API
    });
  });

  describe('loadSupportedChains', () => {
    it('should fetch supported chains from API', async () => {
      const chains = await client.loadSupportedChains();

      expect(chains).toBeInstanceOf(Array);
      expect(chains.length).toBeGreaterThan(0);

      // Check for major chains
      expect(chains).toContain(1); // Ethereum

      console.log('Supported chains:', chains);

      // Log Berachain support status
      const berachainSupported = chains.includes(80094);
      console.log(`Berachain (80094) supported: ${berachainSupported}`);
    });
  });

  describe('getNativeBalance', () => {
    it('should fetch ETH balance for known address', async () => {
      const balance = await client.getNativeBalance(1, TEST_ADDRESSES.vitalik);

      expect(typeof balance).toBe('bigint');
      expect(balance).toBeGreaterThan(0n);

      console.log(`Vitalik ETH balance: ${balance} wei`);
    });
  });

  describe('getBalanceWithUSD', () => {
    it('should fetch balance with USD pricing', async () => {
      const result = await client.getBalanceWithUSD(1, TEST_ADDRESSES.vitalik, 'native');

      expect(result.balance).toBeGreaterThan(0n);
      expect(result.symbol).toBe('ETH');
      expect(result.decimals).toBe(18);

      // USD values may be null for low-liquidity tokens
      console.log(`Balance: ${result.balance} ${result.symbol}`);
      console.log(`USD Price: $${result.priceUsd ?? 'N/A'}`);
      console.log(`USD Value: $${result.valueUsd ?? 'N/A'}`);
    });
  });

  describe('getCollectibles', () => {
    it('should fetch NFT collectibles (may be empty)', async () => {
      const result = await client.getCollectibles(TEST_ADDRESSES.vitalik, {
        chainIds: [1],
        filterSpam: true,
        limit: 10,
      });

      expect(result.collectibles).toBeInstanceOf(Array);
      console.log(`Found ${result.collectibles.length} collectibles`);

      if (result.collectibles.length > 0) {
        console.log('First collectible:', result.collectibles[0].collectionName);
      }
    });
  });

  describe('getActivity', () => {
    it('should fetch recent activity', async () => {
      const result = await client.getActivity(TEST_ADDRESSES.vitalik, {
        chainIds: [1],
        limit: 5,
      });

      expect(result.activities).toBeInstanceOf(Array);
      console.log(`Found ${result.activities.length} activities`);

      if (result.activities.length > 0) {
        const activity = result.activities[0];
        console.log(`Latest activity: ${activity.type} at ${activity.timestamp}`);
      }
    });
  });

  describe('isHealthy', () => {
    it('should report healthy status', async () => {
      const healthy = await client.isHealthy();
      expect(healthy).toBe(true);
    });
  });
});

// --------------------------------------------------------------------------
// HybridChainProvider Integration Tests
// --------------------------------------------------------------------------

describe.skipIf(!API_KEY)('HybridChainProvider Integration', () => {
  let provider: HybridChainProvider;
  const logger = createMockLogger();

  beforeAll(() => {
    if (!API_KEY) {
      console.log(SKIP_REASON);
      return;
    }

    provider = new HybridChainProvider(logger, {
      duneSim: {
        apiKey: API_KEY!,
        timeoutMs: 30_000,
      },
      fallbackEnabled: true,
    });
  });

  describe('getNativeBalance', () => {
    it('should fetch balance (preferring Dune Sim)', async () => {
      const balance = await provider.getNativeBalance(1, TEST_ADDRESSES.vitalik);

      expect(typeof balance).toBe('bigint');
      expect(balance).toBeGreaterThan(0n);

      // Check metrics to verify Dune Sim was used
      const metrics = provider.getMetrics();
      expect(metrics.duneSimRequests).toBeGreaterThan(0);
    });
  });

  describe('getBalanceWithUSD (Dune Sim exclusive)', () => {
    it('should return USD pricing', async () => {
      const result = await provider.getBalanceWithUSD(1, TEST_ADDRESSES.vitalik, 'native');

      expect(result.balance).toBeGreaterThan(0n);
      expect(result.symbol).toBe('ETH');
    });
  });

  describe('isHealthy', () => {
    it('should report healthy when at least one provider works', async () => {
      const healthy = await provider.isHealthy();
      expect(healthy).toBe(true);
    });
  });

  describe('getHealthStatus', () => {
    it('should return detailed health status', async () => {
      const status = await provider.getHealthStatus();

      expect(status.healthy).toBe(true);
      expect(status.duneSim).toBeDefined();
      expect(status.rpc).toBeDefined();

      console.log('Health status:', JSON.stringify(status, null, 2));
    });
  });
});

// --------------------------------------------------------------------------
// Provider Factory Integration Tests
// --------------------------------------------------------------------------

describe.skipIf(!API_KEY)('Provider Factory Integration', () => {
  const logger = createMockLogger();

  describe('isDuneSimAvailable', () => {
    it('should return true when API key is set', () => {
      const available = isDuneSimAvailable({
        DUNE_SIM_API_KEY: API_KEY,
        CHAIN_PROVIDER: 'hybrid',
      });

      expect(available).toBe(true);
    });

    it('should return false when API key is missing', () => {
      const available = isDuneSimAvailable({
        CHAIN_PROVIDER: 'hybrid',
      });

      expect(available).toBe(false);
    });
  });

  describe('createChainProvider with dune_sim mode', () => {
    it('should create DuneSimClient', () => {
      const { provider, mode } = createChainProvider(logger, {
        mode: 'dune_sim',
        apiKey: API_KEY,
      });

      expect(mode).toBe('dune_sim');
      expect(provider).toBeInstanceOf(DuneSimClient);
    });
  });

  describe('createChainProvider with hybrid mode', () => {
    it('should create HybridChainProvider', () => {
      const { provider, mode } = createChainProvider(logger, {
        mode: 'hybrid',
        apiKey: API_KEY,
      });

      expect(mode).toBe('hybrid');
      expect(provider).toBeInstanceOf(HybridChainProvider);
    });
  });
});

// --------------------------------------------------------------------------
// RPC Fallback Tests (with mocked Dune Sim failure)
// --------------------------------------------------------------------------

describe('RPC Fallback', () => {
  const logger = createMockLogger();

  it('should create RPC provider when no API key', () => {
    const { provider, mode } = createChainProvider(logger, {
      mode: 'rpc',
    });

    expect(mode).toBe('rpc');
    expect(provider).toBeInstanceOf(NativeBlockchainReader);
  });
});

// --------------------------------------------------------------------------
// Berachain Support Check
// --------------------------------------------------------------------------

describe.skipIf(!API_KEY)('Berachain Support Check', () => {
  const logger = createMockLogger();

  it('should check if Berachain is supported', async () => {
    const client = new DuneSimClient(logger, {
      apiKey: API_KEY!,
    });

    const chains = await client.loadSupportedChains();
    const berachainSupported = chains.includes(80094);

    console.log('\n===========================================');
    console.log('BERACHAIN SUPPORT STATUS');
    console.log('===========================================');
    console.log(`Berachain (chain ID: 80094): ${berachainSupported ? '✅ SUPPORTED' : '❌ NOT SUPPORTED'}`);
    console.log('===========================================\n');

    // This test documents the status but doesn't fail
    // If Berachain is not supported, hybrid mode will fall back to RPC
    expect(typeof berachainSupported).toBe('boolean');
  });
});
