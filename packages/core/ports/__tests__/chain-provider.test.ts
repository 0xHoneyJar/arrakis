/**
 * Chain Provider Port Tests
 * Sprint S-15: Native Blockchain Reader & Interface
 *
 * Tests for type definitions and constants in chain-provider.ts
 */

import { describe, it, expect } from 'vitest';
import {
  CHAIN_CONFIGS,
  type IChainProvider,
  type Address,
  type ChainId,
  type AssetConfig,
  type EligibilityResult,
  type RankedHolder,
  type CrossChainScore,
  type ChainConfig,
  type ChainProviderOptions,
} from '../chain-provider.js';

// --------------------------------------------------------------------------
// Type Tests (compile-time verification)
// --------------------------------------------------------------------------

describe('Type Definitions', () => {
  describe('Address type', () => {
    it('should accept valid 0x-prefixed addresses', () => {
      const validAddress: Address = '0x1234567890123456789012345678901234567890';
      expect(validAddress.startsWith('0x')).toBe(true);
    });
  });

  describe('ChainId type', () => {
    it('should accept numeric chain IDs', () => {
      const numericChainId: ChainId = 1;
      expect(typeof numericChainId).toBe('number');
    });

    it('should accept string chain IDs', () => {
      const stringChainId: ChainId = 'ethereum';
      expect(typeof stringChainId).toBe('string');
    });
  });

  describe('AssetConfig type', () => {
    it('should define token asset', () => {
      const tokenAsset: AssetConfig = {
        type: 'token',
        contractAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        decimals: 18,
        name: 'Test Token',
        symbol: 'TEST',
      };
      expect(tokenAsset.type).toBe('token');
    });

    it('should define NFT asset', () => {
      const nftAsset: AssetConfig = {
        type: 'nft',
        contractAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        name: 'Test NFT',
      };
      expect(nftAsset.type).toBe('nft');
    });

    it('should define native asset', () => {
      const nativeAsset: AssetConfig = {
        type: 'native',
        chainId: 1,
        symbol: 'ETH',
      };
      expect(nativeAsset.type).toBe('native');
    });
  });

  describe('EligibilityResult type', () => {
    it('should define eligible result with native source', () => {
      const result: EligibilityResult = {
        eligible: true,
        source: 'native',
        confidence: 1.0,
        details: {
          balance: '1000000000000000000',
          threshold: '100000000000000000',
        },
      };
      expect(result.eligible).toBe(true);
      expect(result.source).toBe('native');
    });

    it('should define eligible result with score_service source', () => {
      const result: EligibilityResult = {
        eligible: true,
        source: 'score_service',
        confidence: 0.95,
        details: {
          tierMatched: 'gold',
          score: 1500,
          rank: 10,
        },
      };
      expect(result.source).toBe('score_service');
    });

    it('should define degraded result', () => {
      const result: EligibilityResult = {
        eligible: true,
        source: 'native_degraded',
        confidence: 0.8,
        details: {},
      };
      expect(result.source).toBe('native_degraded');
    });
  });

  describe('RankedHolder type', () => {
    it('should define ranked holder', () => {
      const holder: RankedHolder = {
        address: '0x1234567890123456789012345678901234567890',
        rank: 1,
        score: '1500.50',
        balance: '1000000000000000000',
      };
      expect(holder.rank).toBe(1);
      expect(typeof holder.score).toBe('string');
      expect(typeof holder.balance).toBe('string');
    });
  });

  describe('CrossChainScore type', () => {
    it('should define cross-chain score', () => {
      const score: CrossChainScore = {
        address: '0x1234567890123456789012345678901234567890',
        totalScore: '2500.00',
        chainScores: {
          '1': '1000.00',
          '137': '1500.00',
        },
        computedAt: new Date(),
      };
      expect(typeof score.totalScore).toBe('string');
      expect(score.chainScores['1']).toBe('1000.00');
    });
  });

  describe('ChainConfig type', () => {
    it('should define chain configuration', () => {
      const config: ChainConfig = {
        chainId: 1,
        name: 'Ethereum',
        symbol: 'ETH',
        rpcUrls: ['https://eth.drpc.org'],
        explorerUrl: 'https://etherscan.io',
        decimals: 18,
        isTestnet: false,
      };
      expect(config.chainId).toBe(1);
      expect(config.isTestnet).toBe(false);
    });

    it('should allow optional explorer URL', () => {
      const config: ChainConfig = {
        chainId: 1,
        name: 'Ethereum',
        symbol: 'ETH',
        rpcUrls: ['https://eth.drpc.org'],
        decimals: 18,
        isTestnet: false,
      };
      expect(config.explorerUrl).toBeUndefined();
    });
  });

  describe('ChainProviderOptions type', () => {
    it('should define provider options', () => {
      const options: ChainProviderOptions = {
        cacheTtlMs: 300000,
        timeoutMs: 10000,
        enableScoreService: true,
        scoreServiceUrl: 'https://score.example.com',
      };
      expect(options.cacheTtlMs).toBe(300000);
    });

    it('should allow partial options', () => {
      const options: ChainProviderOptions = {
        cacheTtlMs: 300000,
      };
      expect(options.chains).toBeUndefined();
    });
  });
});

// --------------------------------------------------------------------------
// Chain Configs Tests
// --------------------------------------------------------------------------

describe('CHAIN_CONFIGS', () => {
  describe('Berachain', () => {
    it('should have correct chain ID', () => {
      expect(CHAIN_CONFIGS.berachain.chainId).toBe(80094);
    });

    it('should have correct symbol', () => {
      expect(CHAIN_CONFIGS.berachain.symbol).toBe('BERA');
    });

    it('should have RPC URLs', () => {
      expect(CHAIN_CONFIGS.berachain.rpcUrls.length).toBeGreaterThan(0);
    });

    it('should not be a testnet', () => {
      expect(CHAIN_CONFIGS.berachain.isTestnet).toBe(false);
    });
  });

  describe('Ethereum', () => {
    it('should have correct chain ID', () => {
      expect(CHAIN_CONFIGS.ethereum.chainId).toBe(1);
    });

    it('should have correct symbol', () => {
      expect(CHAIN_CONFIGS.ethereum.symbol).toBe('ETH');
    });

    it('should have RPC URLs', () => {
      expect(CHAIN_CONFIGS.ethereum.rpcUrls.length).toBeGreaterThan(0);
    });
  });

  describe('Polygon', () => {
    it('should have correct chain ID', () => {
      expect(CHAIN_CONFIGS.polygon.chainId).toBe(137);
    });

    it('should have correct symbol', () => {
      expect(CHAIN_CONFIGS.polygon.symbol).toBe('MATIC');
    });
  });

  describe('Arbitrum', () => {
    it('should have correct chain ID', () => {
      expect(CHAIN_CONFIGS.arbitrum.chainId).toBe(42161);
    });

    it('should have ETH as symbol', () => {
      expect(CHAIN_CONFIGS.arbitrum.symbol).toBe('ETH');
    });
  });

  describe('Base', () => {
    it('should have correct chain ID', () => {
      expect(CHAIN_CONFIGS.base.chainId).toBe(8453);
    });

    it('should have ETH as symbol', () => {
      expect(CHAIN_CONFIGS.base.symbol).toBe('ETH');
    });
  });

  describe('All chains', () => {
    it('should have 18 decimals', () => {
      for (const chain of Object.values(CHAIN_CONFIGS)) {
        expect(chain.decimals).toBe(18);
      }
    });

    it('should have at least one RPC URL', () => {
      for (const chain of Object.values(CHAIN_CONFIGS)) {
        expect(chain.rpcUrls.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should have names', () => {
      for (const chain of Object.values(CHAIN_CONFIGS)) {
        expect(chain.name.length).toBeGreaterThan(0);
      }
    });
  });
});

// --------------------------------------------------------------------------
// Interface Contract Tests (documentation)
// --------------------------------------------------------------------------

describe('IChainProvider Interface Contract', () => {
  // These tests document the expected interface contract
  // They verify type shapes, not runtime behavior

  it('should require Tier 1 methods', () => {
    // This is a type-level test - if these types don't exist,
    // TypeScript compilation will fail
    type Tier1Methods = {
      hasBalance: IChainProvider['hasBalance'];
      ownsNFT: IChainProvider['ownsNFT'];
      getBalance: IChainProvider['getBalance'];
      getNativeBalance: IChainProvider['getNativeBalance'];
    };

    // Verify the type compiles
    const tier1Check: Tier1Methods = {} as Tier1Methods;
    expect(tier1Check).toBeDefined();
  });

  it('should require Tier 2 methods', () => {
    type Tier2Methods = {
      getRankedHolders: IChainProvider['getRankedHolders'];
      getAddressRank: IChainProvider['getAddressRank'];
      checkActionHistory: IChainProvider['checkActionHistory'];
      getCrossChainScore: IChainProvider['getCrossChainScore'];
    };

    const tier2Check: Tier2Methods = {} as Tier2Methods;
    expect(tier2Check).toBeDefined();
  });

  it('should require status methods', () => {
    type StatusMethods = {
      isScoreServiceAvailable: IChainProvider['isScoreServiceAvailable'];
      getSupportedChains: IChainProvider['getSupportedChains'];
    };

    const statusCheck: StatusMethods = {} as StatusMethods;
    expect(statusCheck).toBeDefined();
  });
});
