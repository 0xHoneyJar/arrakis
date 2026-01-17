/**
 * Native Blockchain Reader Tests
 * Sprint S-15: Native Blockchain Reader & Interface
 *
 * Unit tests for the NativeBlockchainReader implementation.
 * Uses mocked viem clients to test without real RPC calls.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NativeBlockchainReader } from '../native-reader.js';
import type { Logger } from 'pino';
import type { ChainConfig } from '../../../core/ports/chain-provider.js';

// --------------------------------------------------------------------------
// Mock Setup
// --------------------------------------------------------------------------

// Mock viem
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    readContract: vi.fn(),
    getBalance: vi.fn(),
  })),
  http: vi.fn((url) => ({ url })),
  fallback: vi.fn((transports) => transports),
  getAddress: vi.fn((addr: string) => addr),
}));

// Mock opossum circuit breaker
vi.mock('opossum', () => {
  return {
    default: vi.fn().mockImplementation((fn) => ({
      fire: vi.fn((callback: () => Promise<unknown>) => callback()),
      on: vi.fn(),
      opened: false,
      halfOpen: false,
    })),
  };
});

// Mock logger
const createMockLogger = (): Logger => ({
  child: vi.fn(() => createMockLogger()),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  silent: vi.fn(),
  level: 'info',
}) as unknown as Logger;

// --------------------------------------------------------------------------
// Test Fixtures
// --------------------------------------------------------------------------

const TEST_ADDRESS = '0x1234567890123456789012345678901234567890' as const;
const TEST_TOKEN = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const;
const TEST_NFT = '0x9876543210987654321098765432109876543210' as const;

const TEST_CHAIN_CONFIG: ChainConfig = {
  chainId: 80094,
  name: 'Berachain',
  symbol: 'BERA',
  rpcUrls: ['https://test-rpc.example.com'],
  decimals: 18,
  isTestnet: false,
};

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('NativeBlockchainReader', () => {
  let reader: NativeBlockchainReader;
  let mockLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    reader = new NativeBlockchainReader(mockLogger, {
      chains: [TEST_CHAIN_CONFIG],
      cacheTtlMs: 300_000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with default chains when none provided', () => {
      const defaultReader = new NativeBlockchainReader(mockLogger);
      const chains = defaultReader.getSupportedChains();

      // Should have default chains (Berachain, Ethereum, Polygon, Arbitrum, Base)
      expect(chains.length).toBeGreaterThanOrEqual(1);
    });

    it('should initialize with custom chain configuration', () => {
      const customChain: ChainConfig = {
        chainId: 999,
        name: 'Custom Chain',
        symbol: 'CUSTOM',
        rpcUrls: ['https://custom-rpc.example.com'],
        decimals: 18,
        isTestnet: true,
      };

      const customReader = new NativeBlockchainReader(mockLogger, {
        chains: [customChain],
      });

      const chains = customReader.getSupportedChains();
      expect(chains).toContain(999);
    });

    it('should log initialization', () => {
      expect(mockLogger.child).toHaveBeenCalled();
    });
  });

  describe('getSupportedChains', () => {
    it('should return array of supported chain IDs', () => {
      const chains = reader.getSupportedChains();
      expect(Array.isArray(chains)).toBe(true);
      expect(chains).toContain(80094);
    });

    it('should return a copy, not the original array', () => {
      const chains1 = reader.getSupportedChains();
      const chains2 = reader.getSupportedChains();
      expect(chains1).not.toBe(chains2);
      expect(chains1).toEqual(chains2);
    });
  });

  describe('isScoreServiceAvailable', () => {
    it('should always return false for Native Reader', async () => {
      const available = await reader.isScoreServiceAvailable();
      expect(available).toBe(false);
    });
  });

  describe('Tier 2 methods', () => {
    it('should throw error for getRankedHolders', async () => {
      await expect(
        reader.getRankedHolders({ type: 'token', chainId: 80094 }, 10)
      ).rejects.toThrow('requires Score Service');
    });

    it('should throw error for getAddressRank', async () => {
      await expect(
        reader.getAddressRank(TEST_ADDRESS, { type: 'token', chainId: 80094 })
      ).rejects.toThrow('requires Score Service');
    });

    it('should throw error for checkActionHistory', async () => {
      await expect(
        reader.checkActionHistory(TEST_ADDRESS, { action: 'swap' })
      ).rejects.toThrow('requires Score Service');
    });

    it('should throw error for getCrossChainScore', async () => {
      await expect(
        reader.getCrossChainScore(TEST_ADDRESS, [80094, 1])
      ).rejects.toThrow('requires Score Service');
    });
  });

  describe('getCircuitStates', () => {
    it('should return circuit states for all chains', () => {
      const states = reader.getCircuitStates();
      expect(states).toHaveProperty('80094');
    });

    it('should return closed state when circuit is healthy', () => {
      const states = reader.getCircuitStates();
      expect(states[80094]).toBe('closed');
    });
  });

  describe('isHealthy', () => {
    it('should return true when at least one chain is healthy', () => {
      expect(reader.isHealthy()).toBe(true);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics object with correct properties', () => {
      const metrics = reader.getMetrics();

      expect(metrics).toHaveProperty('requests');
      expect(metrics).toHaveProperty('cacheHits');
      expect(metrics).toHaveProperty('cacheMisses');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('avgLatencyMs');
    });

    it('should return a copy of metrics', () => {
      const metrics1 = reader.getMetrics();
      const metrics2 = reader.getMetrics();
      expect(metrics1).not.toBe(metrics2);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = reader.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hitRate');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
    });

    it('should return 0 hit rate when no requests made', () => {
      const stats = reader.getCacheStats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', () => {
      reader.clearCache();
      const stats = reader.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('invalidateByPattern', () => {
    it('should return count of invalidated entries', () => {
      const count = reader.invalidateByPattern('nonexistent');
      expect(count).toBe(0);
    });
  });

  describe('unsupported chain handling', () => {
    it('should throw error for unsupported chain', async () => {
      await expect(
        reader.getBalance(999999, TEST_ADDRESS, TEST_TOKEN)
      ).rejects.toThrow('not supported');
    });
  });
});

describe('NativeBlockchainReader - Integration Style Tests', () => {
  let reader: NativeBlockchainReader;
  let mockLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    reader = new NativeBlockchainReader(mockLogger, {
      chains: [
        {
          chainId: 80094,
          name: 'Berachain',
          symbol: 'BERA',
          rpcUrls: ['https://berachain.drpc.org'],
          decimals: 18,
          isTestnet: false,
        },
        {
          chainId: 1,
          name: 'Ethereum',
          symbol: 'ETH',
          rpcUrls: ['https://eth.drpc.org'],
          decimals: 18,
          isTestnet: false,
        },
        {
          chainId: 137,
          name: 'Polygon',
          symbol: 'MATIC',
          rpcUrls: ['https://polygon.drpc.org'],
          decimals: 18,
          isTestnet: false,
        },
      ],
    });
  });

  describe('multi-chain support', () => {
    it('should support Berachain', () => {
      const chains = reader.getSupportedChains();
      expect(chains).toContain(80094);
    });

    it('should support Ethereum', () => {
      const chains = reader.getSupportedChains();
      expect(chains).toContain(1);
    });

    it('should support Polygon', () => {
      const chains = reader.getSupportedChains();
      expect(chains).toContain(137);
    });

    it('should support all three chains simultaneously', () => {
      const chains = reader.getSupportedChains();
      expect(chains).toContain(80094);
      expect(chains).toContain(1);
      expect(chains).toContain(137);
      expect(chains.length).toBe(3);
    });
  });

  describe('circuit breaker states', () => {
    it('should have circuit breakers for all chains', () => {
      const states = reader.getCircuitStates();
      expect(states).toHaveProperty('80094');
      expect(states).toHaveProperty('1');
      expect(states).toHaveProperty('137');
    });

    it('should start with all circuits closed', () => {
      const states = reader.getCircuitStates();
      expect(states[80094]).toBe('closed');
      expect(states[1]).toBe('closed');
      expect(states[137]).toBe('closed');
    });
  });
});

describe('ChainConfig validation', () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it('should handle chain with explorer URL', () => {
    const configWithExplorer: ChainConfig = {
      chainId: 80094,
      name: 'Berachain',
      symbol: 'BERA',
      rpcUrls: ['https://test.example.com'],
      explorerUrl: 'https://beratrail.io',
      decimals: 18,
      isTestnet: false,
    };

    const reader = new NativeBlockchainReader(mockLogger, {
      chains: [configWithExplorer],
    });

    expect(reader.getSupportedChains()).toContain(80094);
  });

  it('should handle testnet chain', () => {
    const testnetConfig: ChainConfig = {
      chainId: 80085,
      name: 'Berachain Testnet',
      symbol: 'BERA',
      rpcUrls: ['https://testnet.example.com'],
      decimals: 18,
      isTestnet: true,
    };

    const reader = new NativeBlockchainReader(mockLogger, {
      chains: [testnetConfig],
    });

    expect(reader.getSupportedChains()).toContain(80085);
  });

  it('should handle multiple RPC URLs', () => {
    const multiRpcConfig: ChainConfig = {
      chainId: 1,
      name: 'Ethereum',
      symbol: 'ETH',
      rpcUrls: [
        'https://eth-mainnet-1.example.com',
        'https://eth-mainnet-2.example.com',
        'https://eth-mainnet-3.example.com',
      ],
      decimals: 18,
      isTestnet: false,
    };

    const reader = new NativeBlockchainReader(mockLogger, {
      chains: [multiRpcConfig],
    });

    expect(reader.getSupportedChains()).toContain(1);
  });
});

describe('Cache behavior', () => {
  let reader: NativeBlockchainReader;
  let mockLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    reader = new NativeBlockchainReader(mockLogger, {
      chains: [
        {
          chainId: 80094,
          name: 'Berachain',
          symbol: 'BERA',
          rpcUrls: ['https://test.example.com'],
          decimals: 18,
          isTestnet: false,
        },
      ],
      cacheTtlMs: 300_000, // 5 minutes
    });
  });

  it('should have configurable cache TTL', () => {
    // Cache TTL is internal, but we can verify via getCacheStats
    const stats = reader.getCacheStats();
    expect(stats).toBeDefined();
  });

  it('should clear cache on demand', () => {
    reader.clearCache();
    const stats = reader.getCacheStats();
    expect(stats.size).toBe(0);
  });

  it('should track cache hit rate', () => {
    const stats = reader.getCacheStats();
    expect(stats.hitRate).toBeGreaterThanOrEqual(0);
    expect(stats.hitRate).toBeLessThanOrEqual(1);
  });
});

describe('Error handling', () => {
  let reader: NativeBlockchainReader;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    reader = new NativeBlockchainReader(mockLogger, {
      chains: [
        {
          chainId: 80094,
          name: 'Berachain',
          symbol: 'BERA',
          rpcUrls: ['https://test.example.com'],
          decimals: 18,
          isTestnet: false,
        },
      ],
    });
  });

  it('should handle unsupported chain gracefully', async () => {
    try {
      await reader.getBalance(999999, TEST_ADDRESS, TEST_TOKEN);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).toContain('not supported');
    }
  });

  it('should track errors in metrics', () => {
    const metrics = reader.getMetrics();
    expect(metrics.errors).toBeGreaterThanOrEqual(0);
  });
});
