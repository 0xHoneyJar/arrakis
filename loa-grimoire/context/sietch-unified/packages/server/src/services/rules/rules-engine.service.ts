/**
 * =============================================================================
 * SIETCH UNIFIED - RULES ENGINE SERVICE
 * =============================================================================
 * 
 * Abstracts all eligibility and scoring logic from hardcoded implementations.
 * Reads rules from config/conviction-metrics.yaml to evaluate any token-gating
 * criteria across 50+ blockchains and 35+ wallet types via Collab.Land.
 * 
 * ENTERPRISE STANDARD: Supports custom rules without code deployment.
 * 
 * @module services/rules/rules-engine.service
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

// =============================================================================
// TYPES
// =============================================================================

export type RuleOperator = 
  | 'gte' | 'gt' | 'lte' | 'lt' | 'eq' | 'neq'  // Comparison
  | 'contains' | 'not_contains'                   // Array/string
  | 'in' | 'not_in'                               // Set membership
  | 'exists' | 'not_exists';                      // Existence check

export type RuleDataSource = 
  | 'token_balance'           // ERC20/Native balance
  | 'nft_ownership'           // ERC721/1155 ownership
  | 'governance_votes'        // Snapshot/on-chain votes
  | 'governance_proposals'    // Proposals created
  | 'staking_amount'          // Staked tokens
  | 'liquidity_provided'      // LP positions
  | 'activity_score'          // Platform activity
  | 'holding_duration'        // Time held
  | 'transaction_count'       // TX history
  | 'custom';                 // Custom data source

export interface RuleCondition {
  id: string;
  name: string;
  description?: string;
  dataSource: RuleDataSource;
  
  // Chain/contract targeting
  chain?: string;              // ethereum, polygon, arbitrum, etc.
  contractAddress?: string;    // For token-specific rules
  
  // Evaluation
  operator: RuleOperator;
  value: number | string | boolean | string[];
  
  // Optional modifiers
  decimals?: number;           // Token decimals for balance checks
  multiplier?: number;         // Score multiplier when condition met
  
  // Time-based conditions
  sinceTimestamp?: number;     // Unix timestamp for duration checks
  withinDays?: number;         // Activity within N days
}

export interface RuleSet {
  id: string;
  name: string;
  description?: string;
  version: string;
  
  // Evaluation mode
  mode: 'all' | 'any' | 'weighted';  // AND, OR, or weighted scoring
  
  // Conditions
  conditions: RuleCondition[];
  
  // Thresholds for tier assignment
  thresholds?: {
    none: { maxScore: number };
    low: { minScore: number; maxScore: number };
    high: { minScore: number };
  };
  
  // Weight configuration (for 'weighted' mode)
  weights?: Record<string, number>;  // condition_id -> weight
}

export interface RuleContext {
  walletAddress: string;
  chain?: string;
  communityId?: string;
  
  // Pre-fetched data (optional, will fetch if not provided)
  tokenBalances?: Record<string, bigint>;
  nftHoldings?: Record<string, number>;
  governanceData?: {
    votescast: number;
    proposalsCreated: number;
  };
  activityData?: {
    messageCount: number;
    lastActiveAt: Date;
  };
}

export interface RuleEvaluationResult {
  ruleSetId: string;
  passed: boolean;
  score: number;
  tier: 'none' | 'low' | 'high';
  conditionResults: Array<{
    conditionId: string;
    passed: boolean;
    actualValue: unknown;
    expectedValue: unknown;
    contribution: number;
  }>;
  evaluatedAt: Date;
}

// =============================================================================
// RULES ENGINE SERVICE
// =============================================================================

export class RulesEngineService {
  private ruleSets: Map<string, RuleSet> = new Map();
  private configPath: string;
  private dataProviders: Map<RuleDataSource, DataProvider> = new Map();

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'config', 'conviction-metrics.yaml');
    this.loadConfig();
    this.registerDefaultProviders();
  }

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  /**
   * Load rules from YAML configuration.
   */
  private loadConfig(): void {
    try {
      const fileContents = fs.readFileSync(this.configPath, 'utf8');
      const config = yaml.parse(fileContents);
      
      // Parse rule sets from config
      if (config.rule_sets) {
        for (const ruleSet of config.rule_sets) {
          this.ruleSets.set(ruleSet.id, ruleSet);
        }
      }
      
      // Also parse legacy conviction_metrics format
      if (config.conviction_metrics) {
        const legacyRuleSet = this.convertLegacyConfig(config);
        this.ruleSets.set('default', legacyRuleSet);
      }
      
      console.log(`✅ Rules Engine loaded: ${this.ruleSets.size} rule sets`);
    } catch (error) {
      console.warn('⚠️ Failed to load rules config, using defaults:', error);
      this.loadDefaultRules();
    }
  }

  /**
   * Convert legacy conviction_metrics format to RuleSet.
   */
  private convertLegacyConfig(config: any): RuleSet {
    const metrics = config.conviction_metrics;
    const conditions: RuleCondition[] = [];
    const weights: Record<string, number> = {};

    // Token balance rule
    if (metrics.token_balance) {
      conditions.push({
        id: 'token_balance',
        name: 'Token Balance',
        dataSource: 'token_balance',
        operator: 'gte',
        value: 0,
        multiplier: metrics.token_balance.weight || 0.35,
      });
      weights['token_balance'] = metrics.token_balance.weight || 0.35;
    }

    // Governance participation rule
    if (metrics.governance_participation) {
      conditions.push({
        id: 'governance',
        name: 'Governance Participation',
        dataSource: 'governance_votes',
        operator: 'gte',
        value: 0,
        multiplier: metrics.governance_participation.weight || 0.25,
      });
      weights['governance'] = metrics.governance_participation.weight || 0.25;
    }

    // Activity score rule
    if (metrics.activity_score) {
      conditions.push({
        id: 'activity',
        name: 'Activity Score',
        dataSource: 'activity_score',
        operator: 'gte',
        value: 0,
        multiplier: metrics.activity_score.weight || 0.20,
      });
      weights['activity'] = metrics.activity_score.weight || 0.20;
    }

    // Holding duration rule
    if (metrics.holding_duration) {
      conditions.push({
        id: 'holding_duration',
        name: 'Holding Duration',
        dataSource: 'holding_duration',
        operator: 'gte',
        value: 0,
        multiplier: metrics.holding_duration.weight || 0.20,
      });
      weights['holding_duration'] = metrics.holding_duration.weight || 0.20;
    }

    return {
      id: 'default',
      name: 'Default Conviction Rules',
      description: 'Converted from legacy conviction_metrics config',
      version: '1.0.0',
      mode: 'weighted',
      conditions,
      thresholds: config.tiers ? {
        none: { maxScore: (config.tiers.naib?.min_score || 100) - 1 },
        low: { 
          minScore: config.tiers.naib?.min_score || 100,
          maxScore: (config.tiers.fedaykin?.min_score || 500) - 1,
        },
        high: { minScore: config.tiers.fedaykin?.min_score || 500 },
      } : undefined,
      weights,
    };
  }

  /**
   * Load default rules if config is missing.
   */
  private loadDefaultRules(): void {
    this.ruleSets.set('default', {
      id: 'default',
      name: 'Default Rules',
      version: '1.0.0',
      mode: 'weighted',
      conditions: [
        {
          id: 'token_balance',
          name: 'Token Balance',
          dataSource: 'token_balance',
          operator: 'gte',
          value: 0,
          multiplier: 1,
        },
      ],
      thresholds: {
        none: { maxScore: 99 },
        low: { minScore: 100, maxScore: 499 },
        high: { minScore: 500 },
      },
      weights: { token_balance: 1.0 },
    });
  }

  /**
   * Register default data providers.
   */
  private registerDefaultProviders(): void {
    // Providers will be injected at runtime
    // This allows for mocking in tests
  }

  // ===========================================================================
  // RULE MANAGEMENT
  // ===========================================================================

  /**
   * Get a rule set by ID.
   */
  getRuleSet(id: string): RuleSet | undefined {
    return this.ruleSets.get(id);
  }

  /**
   * Get all rule sets.
   */
  getAllRuleSets(): RuleSet[] {
    return Array.from(this.ruleSets.values());
  }

  /**
   * Add or update a rule set at runtime.
   */
  setRuleSet(ruleSet: RuleSet): void {
    this.ruleSets.set(ruleSet.id, ruleSet);
  }

  /**
   * Register a data provider for a source type.
   */
  registerDataProvider(source: RuleDataSource, provider: DataProvider): void {
    this.dataProviders.set(source, provider);
  }

  // ===========================================================================
  // RULE EVALUATION
  // ===========================================================================

  /**
   * Evaluate a rule set against a context.
   */
  async evaluate(
    ruleSetId: string,
    context: RuleContext
  ): Promise<RuleEvaluationResult> {
    const ruleSet = this.ruleSets.get(ruleSetId);
    
    if (!ruleSet) {
      throw new Error(`Rule set not found: ${ruleSetId}`);
    }

    const conditionResults: RuleEvaluationResult['conditionResults'] = [];
    let totalScore = 0;
    let passedCount = 0;

    // Evaluate each condition
    for (const condition of ruleSet.conditions) {
      const result = await this.evaluateCondition(condition, context, ruleSet);
      conditionResults.push(result);
      
      totalScore += result.contribution;
      if (result.passed) passedCount++;
    }

    // Determine overall pass/fail based on mode
    let passed = false;
    switch (ruleSet.mode) {
      case 'all':
        passed = passedCount === ruleSet.conditions.length;
        break;
      case 'any':
        passed = passedCount > 0;
        break;
      case 'weighted':
        passed = true; // Always passes, score determines tier
        break;
    }

    // Determine tier from score
    const tier = this.scoreToTier(totalScore, ruleSet.thresholds);

    return {
      ruleSetId,
      passed,
      score: Math.round(totalScore),
      tier,
      conditionResults,
      evaluatedAt: new Date(),
    };
  }

  /**
   * Evaluate a single condition.
   */
  private async evaluateCondition(
    condition: RuleCondition,
    context: RuleContext,
    ruleSet: RuleSet
  ): Promise<RuleEvaluationResult['conditionResults'][0]> {
    // Get actual value from data provider
    const actualValue = await this.getDataValue(condition, context);
    
    // Evaluate the condition
    const passed = this.compareValues(
      actualValue,
      condition.operator,
      condition.value
    );

    // Calculate contribution to score
    let contribution = 0;
    if (ruleSet.mode === 'weighted' && ruleSet.weights) {
      const weight = ruleSet.weights[condition.id] || 0;
      const normalizedValue = this.normalizeValue(actualValue, condition);
      contribution = normalizedValue * weight * 100; // Scale to 0-100 per component
    } else if (passed) {
      contribution = condition.multiplier || 1;
    }

    return {
      conditionId: condition.id,
      passed,
      actualValue,
      expectedValue: condition.value,
      contribution,
    };
  }

  /**
   * Get data value from provider or context.
   */
  private async getDataValue(
    condition: RuleCondition,
    context: RuleContext
  ): Promise<unknown> {
    // Check if value is pre-provided in context
    switch (condition.dataSource) {
      case 'token_balance':
        if (context.tokenBalances && condition.contractAddress) {
          return context.tokenBalances[condition.contractAddress];
        }
        break;
      case 'nft_ownership':
        if (context.nftHoldings && condition.contractAddress) {
          return context.nftHoldings[condition.contractAddress];
        }
        break;
      case 'governance_votes':
        if (context.governanceData) {
          return context.governanceData.votescast;
        }
        break;
      case 'activity_score':
        if (context.activityData) {
          return context.activityData.messageCount;
        }
        break;
    }

    // Try to fetch from registered provider
    const provider = this.dataProviders.get(condition.dataSource);
    if (provider) {
      return provider.getValue(condition, context);
    }

    // Return 0 as fallback
    return 0;
  }

  /**
   * Compare values using operator.
   */
  private compareValues(
    actual: unknown,
    operator: RuleOperator,
    expected: unknown
  ): boolean {
    const numActual = Number(actual) || 0;
    const numExpected = Number(expected) || 0;

    switch (operator) {
      case 'gte': return numActual >= numExpected;
      case 'gt': return numActual > numExpected;
      case 'lte': return numActual <= numExpected;
      case 'lt': return numActual < numExpected;
      case 'eq': return actual === expected;
      case 'neq': return actual !== expected;
      case 'contains':
        if (Array.isArray(actual)) return actual.includes(expected);
        if (typeof actual === 'string') return actual.includes(String(expected));
        return false;
      case 'not_contains':
        if (Array.isArray(actual)) return !actual.includes(expected);
        if (typeof actual === 'string') return !actual.includes(String(expected));
        return true;
      case 'in':
        if (Array.isArray(expected)) return expected.includes(actual);
        return false;
      case 'not_in':
        if (Array.isArray(expected)) return !expected.includes(actual);
        return true;
      case 'exists': return actual != null && actual !== '';
      case 'not_exists': return actual == null || actual === '';
      default: return false;
    }
  }

  /**
   * Normalize value to 0-1 range for weighted scoring.
   */
  private normalizeValue(value: unknown, condition: RuleCondition): number {
    const numValue = Number(value) || 0;
    const maxValue = Number(condition.value) || 1;
    
    // Cap at 1.0 (100% of target)
    return Math.min(numValue / maxValue, 1.0);
  }

  /**
   * Convert score to tier using thresholds.
   */
  private scoreToTier(
    score: number,
    thresholds?: RuleSet['thresholds']
  ): 'none' | 'low' | 'high' {
    if (!thresholds) {
      // Default thresholds
      if (score >= 500) return 'high';
      if (score >= 100) return 'low';
      return 'none';
    }

    if (score >= thresholds.high.minScore) return 'high';
    if (score >= thresholds.low.minScore) return 'low';
    return 'none';
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Reload configuration from disk.
   */
  reloadConfig(): void {
    this.ruleSets.clear();
    this.loadConfig();
  }

  /**
   * Validate a rule set configuration.
   */
  validateRuleSet(ruleSet: RuleSet): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!ruleSet.id) errors.push('Missing rule set ID');
    if (!ruleSet.name) errors.push('Missing rule set name');
    if (!ruleSet.mode) errors.push('Missing evaluation mode');
    if (!ruleSet.conditions?.length) errors.push('No conditions defined');

    for (const condition of ruleSet.conditions || []) {
      if (!condition.id) errors.push(`Condition missing ID`);
      if (!condition.dataSource) errors.push(`Condition ${condition.id}: missing data source`);
      if (!condition.operator) errors.push(`Condition ${condition.id}: missing operator`);
    }

    if (ruleSet.mode === 'weighted' && !ruleSet.weights) {
      errors.push('Weighted mode requires weights configuration');
    }

    return { valid: errors.length === 0, errors };
  }
}

// =============================================================================
// DATA PROVIDER INTERFACE
// =============================================================================

export interface DataProvider {
  getValue(condition: RuleCondition, context: RuleContext): Promise<unknown>;
}

// =============================================================================
// ACCOUNTKIT DATA PROVIDER (50+ Chains)
// =============================================================================

/**
 * Data provider that uses Collab.Land AccountKit as the unified source of truth
 * for token balances, NFT ownership, and governance across 50+ chains.
 */
export class AccountKitDataProvider implements DataProvider {
  private accountKitBaseUrl: string;
  private apiKey: string;
  private supportedChains: string[];

  constructor(params: {
    baseUrl?: string;
    apiKey?: string;
  }) {
    this.accountKitBaseUrl = params.baseUrl || process.env.COLLABLAND_API_URL || 'https://api.collab.land';
    this.apiKey = params.apiKey || process.env.COLLABLAND_API_KEY || '';
    
    // Collab.Land supports 50+ chains
    this.supportedChains = [
      // EVM Chains
      'ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'avalanche',
      'bsc', 'fantom', 'gnosis', 'celo', 'moonbeam', 'aurora', 'cronos',
      'harmony', 'metis', 'boba', 'evmos', 'klaytn', 'okc', 'heco',
      'iotex', 'kcc', 'cube', 'oasis', 'ronin', 'telos', 'palm',
      'berachain', 'linea', 'scroll', 'zksync', 'mantle', 'mode',
      // Non-EVM Chains
      'solana', 'near', 'flow', 'tezos', 'stacks', 'terra', 'cosmos',
      'immutable-x', 'loopring',
    ];
  }

  async getValue(condition: RuleCondition, context: RuleContext): Promise<unknown> {
    switch (condition.dataSource) {
      case 'token_balance':
        return this.getTokenBalance(condition, context);
      case 'nft_ownership':
        return this.getNftOwnership(condition, context);
      case 'governance_votes':
        return this.getGovernanceParticipation(condition, context);
      case 'staking_amount':
        return this.getStakingAmount(condition, context);
      default:
        return 0;
    }
  }

  /**
   * Get token balance from AccountKit.
   */
  private async getTokenBalance(
    condition: RuleCondition,
    context: RuleContext
  ): Promise<bigint> {
    const chain = condition.chain || 'ethereum';
    
    if (!this.supportedChains.includes(chain)) {
      console.warn(`Chain not supported: ${chain}`);
      return BigInt(0);
    }

    try {
      const response = await fetch(
        `${this.accountKitBaseUrl}/account/${context.walletAddress}/balance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
          body: JSON.stringify({
            chain,
            contractAddress: condition.contractAddress,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`AccountKit API error: ${response.status}`);
      }

      const data = await response.json();
      return BigInt(data.balance || 0);
    } catch (error) {
      console.error('AccountKit balance fetch failed:', error);
      return BigInt(0);
    }
  }

  /**
   * Get NFT ownership count from AccountKit.
   */
  private async getNftOwnership(
    condition: RuleCondition,
    context: RuleContext
  ): Promise<number> {
    const chain = condition.chain || 'ethereum';

    try {
      const response = await fetch(
        `${this.accountKitBaseUrl}/account/${context.walletAddress}/nfts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
          body: JSON.stringify({
            chain,
            contractAddress: condition.contractAddress,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`AccountKit API error: ${response.status}`);
      }

      const data = await response.json();
      return data.count || 0;
    } catch (error) {
      console.error('AccountKit NFT fetch failed:', error);
      return 0;
    }
  }

  /**
   * Get governance participation from AccountKit (Snapshot + on-chain).
   */
  private async getGovernanceParticipation(
    condition: RuleCondition,
    context: RuleContext
  ): Promise<{ votescast: number; proposalsCreated: number }> {
    try {
      const response = await fetch(
        `${this.accountKitBaseUrl}/account/${context.walletAddress}/governance`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        return { votescast: 0, proposalsCreated: 0 };
      }

      const data = await response.json();
      return {
        votescast: data.votescast || 0,
        proposalsCreated: data.proposalsCreated || 0,
      };
    } catch (error) {
      console.error('AccountKit governance fetch failed:', error);
      return { votescast: 0, proposalsCreated: 0 };
    }
  }

  /**
   * Get staking amount from AccountKit.
   */
  private async getStakingAmount(
    condition: RuleCondition,
    context: RuleContext
  ): Promise<bigint> {
    const chain = condition.chain || 'ethereum';

    try {
      const response = await fetch(
        `${this.accountKitBaseUrl}/account/${context.walletAddress}/staking`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
          body: JSON.stringify({
            chain,
            protocol: condition.contractAddress,
          }),
        }
      );

      if (!response.ok) {
        return BigInt(0);
      }

      const data = await response.json();
      return BigInt(data.stakedAmount || 0);
    } catch (error) {
      console.error('AccountKit staking fetch failed:', error);
      return BigInt(0);
    }
  }

  /**
   * Get list of supported chains.
   */
  getSupportedChains(): string[] {
    return [...this.supportedChains];
  }

  /**
   * Check if a chain is supported.
   */
  isChainSupported(chain: string): boolean {
    return this.supportedChains.includes(chain.toLowerCase());
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let rulesEngineInstance: RulesEngineService | null = null;

export function getRulesEngine(configPath?: string): RulesEngineService {
  if (!rulesEngineInstance) {
    rulesEngineInstance = new RulesEngineService(configPath);
  }
  return rulesEngineInstance;
}
