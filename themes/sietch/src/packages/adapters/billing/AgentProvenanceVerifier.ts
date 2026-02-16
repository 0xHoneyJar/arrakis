/**
 * AgentProvenanceVerifier — Agent Identity & Provenance Adapter
 *
 * Manages agent on-chain identity registration and creator provenance verification.
 * Creator KYC level cascades to agent: agent inherits creator's verification status.
 *
 * SDD refs: §SS4.5
 * Sprint refs: Task 7.3
 *
 * @module adapters/billing/AgentProvenanceVerifier
 */

import type Database from 'better-sqlite3';
import { logger } from '../../../utils/logger.js';
import { sqliteTimestamp } from './protocol/timestamps.js';
import type {
  IAgentProvenanceVerifier,
  RegisterAgentOpts,
  AgentIdentity,
  ProvenanceResult,
} from '../../core/ports/IAgentProvenanceVerifier.js';
import type { CreditAccount } from '../../core/ports/ICreditLedgerService.js';

// =============================================================================
// AgentProvenanceVerifier
// =============================================================================

export class AgentProvenanceVerifier implements IAgentProvenanceVerifier {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async registerAgent(opts: RegisterAgentOpts): Promise<AgentIdentity> {
    const now = sqliteTimestamp();

    // Validate creator account exists
    const creator = this.db.prepare(
      `SELECT id FROM credit_accounts WHERE id = ?`
    ).get(opts.creatorAccountId) as { id: string } | undefined;

    if (!creator) {
      throw Object.assign(
        new Error(`Creator account not found: ${opts.creatorAccountId}`),
        { code: 'NOT_FOUND', statusCode: 404 },
      );
    }

    // Validate agent account exists
    const agent = this.db.prepare(
      `SELECT id FROM credit_accounts WHERE id = ?`
    ).get(opts.agentAccountId) as { id: string } | undefined;

    if (!agent) {
      throw Object.assign(
        new Error(`Agent account not found: ${opts.agentAccountId}`),
        { code: 'NOT_FOUND', statusCode: 404 },
      );
    }

    try {
      const row = this.db.prepare(`
        INSERT INTO agent_identity
          (account_id, chain_id, contract_address, token_id, creator_account_id, creator_signature, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `).get(
        opts.agentAccountId, opts.chainId, opts.contractAddress,
        opts.tokenId, opts.creatorAccountId, opts.creatorSignature ?? null, now,
      ) as any;

      logger.info({
        event: 'agent.registered',
        agentAccountId: opts.agentAccountId,
        creatorAccountId: opts.creatorAccountId,
        chainId: opts.chainId,
        contractAddress: opts.contractAddress,
        tokenId: opts.tokenId,
      }, 'Agent identity registered');

      return this.mapRow(row);
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message?.includes('UNIQUE')) {
        throw Object.assign(
          new Error(`Agent identity already registered for (${opts.chainId}, ${opts.contractAddress}, ${opts.tokenId})`),
          { code: 'CONFLICT', statusCode: 409 },
        );
      }
      throw err;
    }
  }

  async verifyProvenance(agentAccountId: string): Promise<ProvenanceResult> {
    const identity = this.db.prepare(`
      SELECT ai.*, ca.entity_type as creator_entity_type
      FROM agent_identity ai
      JOIN credit_accounts ca ON ca.id = ai.creator_account_id
      WHERE ai.account_id = ?
    `).get(agentAccountId) as any;

    if (!identity) {
      throw Object.assign(
        new Error(`No identity found for agent account: ${agentAccountId}`),
        { code: 'NOT_FOUND', statusCode: 404 },
      );
    }

    // Look up creator's KYC level (defaults to 0 if not set)
    const kycRow = this.db.prepare(`
      SELECT COALESCE(kyc_level, 0) as kyc_level
      FROM credit_accounts WHERE id = ?
    `).get(identity.creator_account_id) as { kyc_level: number } | undefined;

    const creatorKycLevel = kycRow?.kyc_level ?? 0;

    return {
      agentAccountId,
      creatorAccountId: identity.creator_account_id,
      chainId: identity.chain_id,
      contractAddress: identity.contract_address,
      tokenId: identity.token_id,
      creatorKycLevel,
      verified: identity.verified_at !== null,
      verifiedAt: identity.verified_at,
    };
  }

  async getCreator(agentAccountId: string): Promise<CreditAccount> {
    const row = this.db.prepare(`
      SELECT ca.*
      FROM credit_accounts ca
      JOIN agent_identity ai ON ai.creator_account_id = ca.id
      WHERE ai.account_id = ?
    `).get(agentAccountId) as any;

    if (!row) {
      throw Object.assign(
        new Error(`No creator found for agent account: ${agentAccountId}`),
        { code: 'NOT_FOUND', statusCode: 404 },
      );
    }

    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async bindTBA(_accountId: string, _tbaAddress: string): Promise<AgentIdentity> {
    throw Object.assign(
      new Error('Phase 2: ERC-6551 TBA binding not yet implemented'),
      { code: 'NOT_IMPLEMENTED', statusCode: 501 },
    );
  }

  private mapRow(row: any): AgentIdentity {
    return {
      id: row.id,
      accountId: row.account_id,
      chainId: row.chain_id,
      contractAddress: row.contract_address,
      tokenId: row.token_id,
      tbaAddress: row.tba_address,
      creatorAccountId: row.creator_account_id,
      creatorSignature: row.creator_signature,
      verifiedAt: row.verified_at,
      createdAt: row.created_at,
    };
  }
}
