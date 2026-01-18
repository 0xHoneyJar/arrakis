/**
 * Wizard Domain Types
 *
 * Sprint S-20: Wizard Session Store & State Model
 *
 * Defines the 8-step wizard state machine for self-service community onboarding.
 * Per SDD §6.3.2, the wizard guides administrators through:
 * INIT → CHAIN_SELECT → ASSET_CONFIG → ELIGIBILITY_RULES →
 * ROLE_MAPPING → CHANNEL_STRUCTURE → REVIEW → DEPLOY
 *
 * @see SDD §6.3 WizardEngine
 */

// =============================================================================
// Wizard State Machine
// =============================================================================

/**
 * 8-step wizard state enumeration.
 * States progress linearly with optional back-navigation.
 */
export enum WizardState {
  /** Welcome step - community name entry */
  INIT = 'INIT',
  /** Select blockchain(s) for eligibility */
  CHAIN_SELECT = 'CHAIN_SELECT',
  /** Enter contract address(es) */
  ASSET_CONFIG = 'ASSET_CONFIG',
  /** Configure tier thresholds */
  ELIGIBILITY_RULES = 'ELIGIBILITY_RULES',
  /** Define tier → role mapping */
  ROLE_MAPPING = 'ROLE_MAPPING',
  /** Select channel template or customize */
  CHANNEL_STRUCTURE = 'CHANNEL_STRUCTURE',
  /** Preview manifest before deployment */
  REVIEW = 'REVIEW',
  /** Execute synthesis (terminal state) */
  DEPLOY = 'DEPLOY',
}

/**
 * Valid state transitions map.
 * Each state can progress forward or back to previous step.
 * DEPLOY is a terminal state with no outgoing transitions.
 */
export const WIZARD_STATE_TRANSITIONS: Record<WizardState, WizardState[]> = {
  [WizardState.INIT]: [WizardState.CHAIN_SELECT],
  [WizardState.CHAIN_SELECT]: [WizardState.ASSET_CONFIG, WizardState.INIT],
  [WizardState.ASSET_CONFIG]: [WizardState.ELIGIBILITY_RULES, WizardState.CHAIN_SELECT],
  [WizardState.ELIGIBILITY_RULES]: [WizardState.ROLE_MAPPING, WizardState.ASSET_CONFIG],
  [WizardState.ROLE_MAPPING]: [WizardState.CHANNEL_STRUCTURE, WizardState.ELIGIBILITY_RULES],
  [WizardState.CHANNEL_STRUCTURE]: [WizardState.REVIEW, WizardState.ROLE_MAPPING],
  [WizardState.REVIEW]: [WizardState.DEPLOY, WizardState.CHANNEL_STRUCTURE],
  [WizardState.DEPLOY]: [], // Terminal state - no outgoing transitions
};

// =============================================================================
// Chain Configuration
// =============================================================================

/**
 * Supported chain identifiers.
 */
export type ChainId = 'ethereum' | 'polygon' | 'arbitrum' | 'base' | 'berachain';

/**
 * Chain configuration for eligibility checking.
 */
export interface ChainConfig {
  /** Chain identifier */
  chainId: ChainId;
  /** Display name */
  name: string;
  /** RPC endpoint (optional, uses default if not provided) */
  rpcUrl?: string;
  /** Whether this chain is enabled for the community */
  enabled: boolean;
}

// =============================================================================
// Asset Configuration
// =============================================================================

/**
 * Asset type enumeration.
 */
export type AssetType = 'erc20' | 'erc721' | 'erc1155' | 'native';

/**
 * Asset configuration for eligibility.
 */
export interface AssetConfig {
  /** Unique identifier */
  id: string;
  /** Asset type */
  type: AssetType;
  /** Contract address (null for native tokens) */
  contractAddress: string | null;
  /** Chain this asset is on */
  chainId: ChainId;
  /** Display name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Decimals (for ERC20) */
  decimals?: number;
  /** Token ID (for ERC721/ERC1155) */
  tokenId?: string;
}

// =============================================================================
// Eligibility Rules
// =============================================================================

/**
 * Eligibility rule types.
 */
export type EligibilityRuleType =
  | 'min_balance'
  | 'nft_ownership'
  | 'min_hold_duration'
  | 'score_threshold';

/**
 * Eligibility rule configuration.
 */
export interface EligibilityRuleConfig {
  /** Unique identifier */
  id: string;
  /** Rule type */
  type: EligibilityRuleType;
  /** Asset this rule applies to */
  assetId: string;
  /** Rule parameters */
  parameters: Record<string, unknown>;
  /** Description for display */
  description: string;
}

// =============================================================================
// Role Mapping
// =============================================================================

/**
 * Tier to Discord role mapping.
 */
export interface TierRoleMapping {
  /** Tier ID (from theme) */
  tierId: string;
  /** Discord role name */
  roleName: string;
  /** Role color (hex) */
  roleColor: number;
  /** Whether role is mentionable */
  mentionable: boolean;
  /** Whether role is hoisted (displayed separately) */
  hoist: boolean;
}

// =============================================================================
// Channel Configuration
// =============================================================================

/**
 * Channel template types.
 */
export type ChannelTemplate = 'none' | 'additive_only' | 'parallel_mirror' | 'custom';

/**
 * Channel type enumeration.
 */
export type ChannelType = 'text' | 'voice' | 'category';

/**
 * Channel permission override.
 */
export interface ChannelPermissionOverride {
  /** Role or user ID */
  id: string;
  /** Type of target */
  type: 'role' | 'user';
  /** Allowed permissions */
  allow: string[];
  /** Denied permissions */
  deny: string[];
}

/**
 * Channel configuration.
 */
export interface ChannelConfig {
  /** Channel name */
  name: string;
  /** Channel type */
  type: ChannelType;
  /** Topic (for text channels) */
  topic?: string;
  /** Parent category (if any) */
  parentId?: string;
  /** Required tier(s) to access */
  requiredTiers: string[];
  /** Permission overrides */
  permissionOverrides: ChannelPermissionOverride[];
}

// =============================================================================
// Deployment Status
// =============================================================================

/**
 * Deployment status enumeration.
 */
export type DeploymentStatus =
  | 'pending'
  | 'roles_creating'
  | 'roles_created'
  | 'channels_creating'
  | 'channels_created'
  | 'permissions_setting'
  | 'completed'
  | 'failed';

// =============================================================================
// Community Manifest
// =============================================================================

/**
 * Complete community configuration manifest.
 * Generated from wizard data and used for synthesis.
 */
export interface CommunityManifest {
  /** Version for schema evolution */
  version: string;
  /** Community name */
  name: string;
  /** Theme ID */
  themeId: string;
  /** Chain configurations */
  chains: ChainConfig[];
  /** Asset configurations */
  assets: AssetConfig[];
  /** Eligibility rules */
  rules: EligibilityRuleConfig[];
  /** Tier role mappings */
  tierRoles: TierRoleMapping[];
  /** Channel template */
  channelTemplate: ChannelTemplate;
  /** Custom channels (if template is 'custom') */
  channels?: ChannelConfig[];
  /** Created timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  updatedAt: Date;
}

// =============================================================================
// Wizard Session Data
// =============================================================================

/**
 * Accumulated data from wizard steps.
 * Each step populates its corresponding field.
 */
export interface WizardSessionData {
  // INIT step
  /** Community display name */
  communityName?: string;

  // CHAIN_SELECT step
  /** Selected chain configurations */
  chains?: ChainConfig[];

  // ASSET_CONFIG step
  /** Configured assets */
  assets?: AssetConfig[];

  // ELIGIBILITY_RULES step
  /** Eligibility rules */
  rules?: EligibilityRuleConfig[];

  // ROLE_MAPPING step
  /** Tier to role mappings */
  tierRoles?: TierRoleMapping[];

  // CHANNEL_STRUCTURE step
  /** Selected channel template */
  channelTemplate?: ChannelTemplate;
  /** Custom channel configurations */
  customChannels?: ChannelConfig[];

  // REVIEW step
  /** Generated manifest (preview) */
  manifest?: CommunityManifest;
  /** Whether manifest was validated */
  validated?: boolean;

  // DEPLOY step
  /** Current deployment status */
  deploymentStatus?: DeploymentStatus;
  /** BullMQ job ID for tracking */
  synthesisJobId?: string;
  /** Deployment error message (if failed) */
  deploymentError?: string;
}

// =============================================================================
// Wizard Session
// =============================================================================

/**
 * Complete wizard session state.
 * Persisted to Redis with 15-minute TTL.
 */
export interface WizardSession {
  /** Session UUID */
  id: string;
  /** Community ID (tenant) */
  communityId: string;
  /** Discord guild ID */
  guildId: string;
  /** Discord user ID (admin performing setup) */
  userId: string;
  /** Current wizard state */
  state: WizardState;
  /** Accumulated step data */
  data: WizardSessionData;
  /** Session creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Session expiration timestamp */
  expiresAt: Date;
  /** IP address for session binding (security) */
  ipAddress?: string;
}

/**
 * Input for creating a new wizard session.
 */
export type NewWizardSession = Omit<WizardSession, 'id' | 'createdAt' | 'updatedAt' | 'expiresAt'>;

// =============================================================================
// State Machine Utilities
// =============================================================================

/**
 * Check if a state transition is valid.
 *
 * @param from - Current state
 * @param to - Target state
 * @returns True if transition is valid
 */
export function isValidTransition(from: WizardState, to: WizardState): boolean {
  return WIZARD_STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get all valid transitions from a state.
 *
 * @param state - Current state
 * @returns Array of valid target states
 */
export function getValidTransitions(state: WizardState): WizardState[] {
  return WIZARD_STATE_TRANSITIONS[state] ?? [];
}

/**
 * Check if a state is terminal (no outgoing transitions).
 *
 * @param state - State to check
 * @returns True if terminal
 */
export function isTerminalState(state: WizardState): boolean {
  return WIZARD_STATE_TRANSITIONS[state]?.length === 0;
}

/**
 * Get the next forward state (first transition option).
 *
 * @param state - Current state
 * @returns Next forward state or null if terminal
 */
export function getNextState(state: WizardState): WizardState | null {
  const transitions = WIZARD_STATE_TRANSITIONS[state];
  return transitions && transitions.length > 0 ? transitions[0] ?? null : null;
}

/**
 * Get the previous state (second transition option, if available).
 *
 * @param state - Current state
 * @returns Previous state or null if at beginning
 */
export function getPreviousState(state: WizardState): WizardState | null {
  const transitions = WIZARD_STATE_TRANSITIONS[state];
  return transitions && transitions.length > 1 ? transitions[1] ?? null : null;
}

/**
 * Get the step number (1-8) for a state.
 *
 * @param state - State to check
 * @returns Step number (1-8)
 */
export function getStepNumber(state: WizardState): number {
  const order = [
    WizardState.INIT,
    WizardState.CHAIN_SELECT,
    WizardState.ASSET_CONFIG,
    WizardState.ELIGIBILITY_RULES,
    WizardState.ROLE_MAPPING,
    WizardState.CHANNEL_STRUCTURE,
    WizardState.REVIEW,
    WizardState.DEPLOY,
  ];
  return order.indexOf(state) + 1;
}

/**
 * Get state by step number.
 *
 * @param step - Step number (1-8)
 * @returns State or null if invalid
 */
export function getStateByStep(step: number): WizardState | null {
  const order = [
    WizardState.INIT,
    WizardState.CHAIN_SELECT,
    WizardState.ASSET_CONFIG,
    WizardState.ELIGIBILITY_RULES,
    WizardState.ROLE_MAPPING,
    WizardState.CHANNEL_STRUCTURE,
    WizardState.REVIEW,
    WizardState.DEPLOY,
  ];
  return step >= 1 && step <= 8 ? order[step - 1] ?? null : null;
}

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Validate session data completeness for a state.
 * Each state requires certain data fields to be populated.
 *
 * @param state - State to validate for
 * @param data - Session data to validate
 * @returns Validation result with errors
 */
export function validateSessionData(
  state: WizardState,
  data: WizardSessionData
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (state) {
    case WizardState.CHAIN_SELECT:
      // INIT data required
      if (!data.communityName?.trim()) {
        errors.push('Community name is required');
      }
      break;

    case WizardState.ASSET_CONFIG:
      // CHAIN_SELECT data required
      if (!data.chains || data.chains.length === 0) {
        errors.push('At least one chain must be selected');
      }
      break;

    case WizardState.ELIGIBILITY_RULES:
      // ASSET_CONFIG data required
      if (!data.assets || data.assets.length === 0) {
        errors.push('At least one asset must be configured');
      }
      break;

    case WizardState.ROLE_MAPPING:
      // ELIGIBILITY_RULES data required
      if (!data.rules || data.rules.length === 0) {
        errors.push('At least one eligibility rule must be configured');
      }
      break;

    case WizardState.CHANNEL_STRUCTURE:
      // ROLE_MAPPING data required
      if (!data.tierRoles || data.tierRoles.length === 0) {
        errors.push('At least one tier role mapping is required');
      }
      break;

    case WizardState.REVIEW:
      // CHANNEL_STRUCTURE data required
      if (!data.channelTemplate) {
        errors.push('Channel template must be selected');
      }
      break;

    case WizardState.DEPLOY:
      // REVIEW data required
      if (!data.manifest || !data.validated) {
        errors.push('Manifest must be generated and validated');
      }
      break;
  }

  return { valid: errors.length === 0, errors };
}
