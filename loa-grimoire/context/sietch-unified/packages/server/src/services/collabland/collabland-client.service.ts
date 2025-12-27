/**
 * =============================================================================
 * SIETCH UNIFIED - COLLAB.LAND CLIENT SERVICE
 * =============================================================================
 * 
 * Client for Collab.Land AccountKit APIs.
 * Handles identity resolution, wallet verification, and account management.
 * 
 * @module services/collabland/collabland-client.service
 */

// =============================================================================
// TYPES
// =============================================================================

export interface AccountKitIdentity {
  id: string;
  discordId?: string;
  telegramId?: string;
  walletAddresses: string[];
  primaryWallet?: string;
  verified: boolean;
}

interface AccountControllerResponse {
  id: string;
  accounts: Array<{
    platform: string;
    platformId: string;
    username?: string;
    metadata?: Record<string, unknown>;
  }>;
  wallets: Array<{
    address: string;
    chain: string;
    isPrimary: boolean;
  }>;
}

interface CollabLandClientConfig {
  apiKey: string;
  apiUrl: string;
}

// =============================================================================
// COLLAB.LAND CLIENT
// =============================================================================

export class CollabLandClient {
  private apiKey: string;
  private apiUrl: string;

  constructor(config: CollabLandClientConfig) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl;
  }

  /**
   * Resolve identity from any platform ID
   */
  async resolveIdentity(
    platform: 'discord' | 'telegram',
    platformId: string
  ): Promise<AccountKitIdentity | null> {
    const endpoint = `${this.apiUrl}/account/v1/accounts`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({ platform, platformId }),
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`AccountKit API error: ${response.status}`);
      }

      const data: AccountControllerResponse = await response.json();

      return {
        id: data.id,
        discordId: data.accounts.find(a => a.platform === 'discord')?.platformId,
        telegramId: data.accounts.find(a => a.platform === 'telegram')?.platformId,
        walletAddresses: data.wallets.map(w => w.address),
        primaryWallet: data.wallets.find(w => w.isPrimary)?.address,
        verified: data.wallets.length > 0,
      };
    } catch (error) {
      console.error('CollabLand identity resolution failed:', error);
      throw error;
    }
  }

  /**
   * Get identity by wallet address
   */
  async getIdentityByWallet(walletAddress: string): Promise<AccountKitIdentity | null> {
    const endpoint = `${this.apiUrl}/account/v1/accounts/wallet/${walletAddress}`;

    try {
      const response = await fetch(endpoint, {
        headers: { 'X-API-Key': this.apiKey },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`AccountKit API error: ${response.status}`);
      }

      const data: AccountControllerResponse = await response.json();

      return {
        id: data.id,
        discordId: data.accounts.find(a => a.platform === 'discord')?.platformId,
        telegramId: data.accounts.find(a => a.platform === 'telegram')?.platformId,
        walletAddresses: data.wallets.map(w => w.address),
        primaryWallet: data.wallets.find(w => w.isPrimary)?.address,
        verified: true,
      };
    } catch (error) {
      console.error('CollabLand wallet lookup failed:', error);
      throw error;
    }
  }

  /**
   * Verify wallet signature
   */
  async verifyWalletSignature(
    walletAddress: string,
    message: string,
    signature: string
  ): Promise<boolean> {
    const endpoint = `${this.apiUrl}/account/v1/verify`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({ address: walletAddress, message, signature }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      return data.verified === true;
    } catch (error) {
      console.error('Wallet verification failed:', error);
      return false;
    }
  }

  /**
   * Get current user info (for /account/me endpoint)
   */
  async getMe(accessToken: string): Promise<AccountKitIdentity | null> {
    const endpoint = `${this.apiUrl}/account/v1/me`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-API-Key': this.apiKey,
        },
      });

      if (!response.ok) {
        if (response.status === 401) return null;
        throw new Error(`AccountKit API error: ${response.status}`);
      }

      const data: AccountControllerResponse = await response.json();

      return {
        id: data.id,
        discordId: data.accounts.find(a => a.platform === 'discord')?.platformId,
        telegramId: data.accounts.find(a => a.platform === 'telegram')?.platformId,
        walletAddresses: data.wallets.map(w => w.address),
        primaryWallet: data.wallets.find(w => w.isPrimary)?.address,
        verified: data.wallets.length > 0,
      };
    } catch (error) {
      console.error('AccountKit /me failed:', error);
      return null;
    }
  }

  /**
   * Check community subscription tier via Command Center
   */
  async getCommunityTier(communityId: string): Promise<string | null> {
    const endpoint = `${this.apiUrl}/cc/v1/communities/${communityId}/subscription`;

    try {
      const response = await fetch(endpoint, {
        headers: { 'X-API-Key': this.apiKey },
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.tier || 'starter';
    } catch (error) {
      console.error('Failed to get community tier:', error);
      return null;
    }
  }

  /**
   * Refresh token-gating rules for a community
   */
  async refreshTGRs(communityId: string): Promise<boolean> {
    const endpoint = `${this.apiUrl}/cc/v1/communities/${communityId}/tgrs/refresh`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'X-API-Key': this.apiKey },
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to refresh TGRs:', error);
      return false;
    }
  }
}
