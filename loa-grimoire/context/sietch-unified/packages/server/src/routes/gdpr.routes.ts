/**
 * =============================================================================
 * SIETCH UNIFIED - GDPR ROUTES
 * =============================================================================
 * 
 * Implements GDPR Data Subject Rights (Articles 15-22):
 * - Right of Access (Article 15)
 * - Right to Erasure (Article 17)
 * - Right to Data Portability (Article 20)
 * - Right to Object (Article 21)
 * 
 * @module routes/gdpr
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

// =============================================================================
// SCHEMAS
// =============================================================================

const optOutSchema = z.object({
  scopes: z.array(z.enum([
    'conviction_scoring',
    'directory_listing',
    'activity_tracking',
    'marketing',
  ])),
});

// =============================================================================
// ROUTE FACTORY
// =============================================================================

interface GDPRRouteDeps {
  prisma: PrismaClient;
}

export function createGDPRRoutes({ prisma }: GDPRRouteDeps): Hono {
  const router = new Hono();

  /**
   * GET /export
   * Article 15: Right of Access
   * Article 20: Right to Data Portability
   * 
   * Returns all personal data associated with the user
   */
  router.get('/export', async (c) => {
    const platform = c.req.header('x-platform');
    const platformId = c.req.header('x-platform-id');
    const format = c.req.query('format') || 'json';

    if (!platform || !platformId) {
      return c.json({
        success: false,
        error: 'Authentication required',
      }, 401);
    }

    try {
      // Find the user's identity
      const account = await prisma.linkedAccount.findUnique({
        where: {
          platform_platformId: {
            platform,
            platformId,
          },
        },
        include: {
          unifiedIdentity: {
            include: {
              wallets: true,
              accounts: true,
              profile: true,
              activityScore: true,
              sessions: {
                where: {
                  status: 'completed',
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
              },
            },
          },
        },
      });

      if (!account) {
        return c.json({
          success: false,
          error: 'No data found for this user',
        }, 404);
      }

      const identity = account.unifiedIdentity;

      // Get conviction history
      const convictionHistory = await prisma.convictionSnapshot.findMany({
        where: { walletAddress: identity.primaryWallet },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      // Get audit logs for this user (their own actions)
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          OR: [
            { actor: identity.id },
            { metadata: { path: ['userId'], equals: identity.id } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      // Build export data
      const exportData = {
        export_metadata: {
          generated_at: new Date().toISOString(),
          format: format,
          gdpr_article: 'Article 15 (Right of Access) / Article 20 (Portability)',
          data_controller: 'Sietch Unified',
        },
        identity: {
          id: identity.id,
          primary_wallet: identity.primaryWallet,
          tier: identity.tier,
          rank: identity.rank,
          created_at: identity.createdAt,
          updated_at: identity.updatedAt,
        },
        linked_accounts: identity.accounts.map(acc => ({
          platform: acc.platform,
          platform_id: acc.platformId,
          username: acc.username,
          linked_at: acc.linkedAt,
          verified_at: acc.verifiedAt,
        })),
        linked_wallets: identity.wallets.map(wallet => ({
          address: wallet.address,
          chain: wallet.chain,
          is_primary: wallet.isPrimary,
          verified_at: wallet.verifiedAt,
          verification_method: wallet.verificationMethod,
        })),
        profile: identity.profile ? {
          nym: identity.profile.nym,
          preferences: identity.profile.preferences,
          badges: identity.profile.badges,
          created_at: identity.profile.createdAt,
          updated_at: identity.profile.updatedAt,
        } : null,
        activity: identity.activityScore ? {
          score: identity.activityScore.score,
          last_activity_at: identity.activityScore.lastActivityAt,
          last_decay_at: identity.activityScore.lastDecayAt,
        } : null,
        conviction_history: convictionHistory.map(snapshot => ({
          score: snapshot.score,
          rank: snapshot.rank,
          tier: snapshot.tier,
          components: snapshot.components,
          recorded_at: snapshot.createdAt,
        })),
        verification_sessions: identity.sessions.map(session => ({
          id: session.id,
          platform: session.platform,
          status: session.status,
          wallet_address: session.walletAddress,
          created_at: session.createdAt,
          completed_at: session.completedAt,
        })),
        audit_trail: auditLogs.map(log => ({
          action: log.action,
          timestamp: log.createdAt,
          // Don't expose internal metadata
        })),
      };

      // Log this access request
      await prisma.auditLog.create({
        data: {
          action: 'gdpr_data_export',
          actor: identity.id,
          metadata: {
            platform,
            platformId,
            format,
            recordCount: {
              accounts: identity.accounts.length,
              wallets: identity.wallets.length,
              convictionSnapshots: convictionHistory.length,
              auditLogs: auditLogs.length,
            },
          },
        },
      });

      // Set appropriate headers for download
      if (format === 'portable') {
        c.header('Content-Disposition', `attachment; filename="sietch-data-export-${identity.id}.json"`);
      }

      return c.json({
        success: true,
        data: exportData,
      });
    } catch (error) {
      console.error('GDPR export failed:', error);
      return c.json({
        success: false,
        error: 'Failed to export data',
      }, 500);
    }
  });

  /**
   * DELETE /delete
   * Article 17: Right to Erasure ("Right to be Forgotten")
   * 
   * Permanently deletes all personal data
   */
  router.delete('/delete', async (c) => {
    const platform = c.req.header('x-platform');
    const platformId = c.req.header('x-platform-id');
    const confirmationCode = c.req.header('x-deletion-confirmation');

    if (!platform || !platformId) {
      return c.json({
        success: false,
        error: 'Authentication required',
      }, 401);
    }

    // Require explicit confirmation
    if (confirmationCode !== 'DELETE_ALL_MY_DATA') {
      return c.json({
        success: false,
        error: 'Deletion confirmation required. Send header: X-Deletion-Confirmation: DELETE_ALL_MY_DATA',
        instructions: 'This action is irreversible. All your data will be permanently deleted.',
      }, 400);
    }

    try {
      // Find the user's identity
      const account = await prisma.linkedAccount.findUnique({
        where: {
          platform_platformId: {
            platform,
            platformId,
          },
        },
        include: {
          unifiedIdentity: {
            include: {
              accounts: true,
            },
          },
        },
      });

      if (!account) {
        return c.json({
          success: false,
          error: 'No data found for this user',
        }, 404);
      }

      const identity = account.unifiedIdentity;

      // Check for blocking conditions
      const subscription = await prisma.communitySubscription.findFirst({
        where: {
          createdByUserId: identity.id,
          status: { in: ['active', 'past_due'] },
        },
      });

      if (subscription) {
        return c.json({
          success: false,
          error: 'Cannot delete account with active subscription. Please cancel subscription first.',
          subscriptionId: subscription.id,
        }, 400);
      }

      // Log before deletion (for security audit)
      await prisma.auditLog.create({
        data: {
          action: 'gdpr_deletion_requested',
          actor: 'system',
          metadata: {
            identityId: identity.id,
            primaryWallet: identity.primaryWallet,
            linkedAccounts: identity.accounts.length,
            requestedFrom: platform,
            deletedAt: new Date().toISOString(),
          },
        },
      });

      // Perform cascading deletion
      // Note: Prisma cascade delete handles most relations
      
      // 1. Delete activity score
      await prisma.activityScore.deleteMany({
        where: { unifiedIdentityId: identity.id },
      });

      // 2. Delete profile
      await prisma.userProfile.deleteMany({
        where: { unifiedIdentityId: identity.id },
      });

      // 3. Delete verification sessions
      await prisma.verificationSession.deleteMany({
        where: { unifiedIdentityId: identity.id },
      });

      // 4. Delete linked wallets
      await prisma.linkedWallet.deleteMany({
        where: { unifiedIdentityId: identity.id },
      });

      // 5. Delete linked accounts
      await prisma.linkedAccount.deleteMany({
        where: { unifiedIdentityId: identity.id },
      });

      // 6. Anonymize conviction snapshots (keep for analytics, remove PII)
      await prisma.convictionSnapshot.updateMany({
        where: { walletAddress: identity.primaryWallet },
        data: { walletAddress: `deleted_${identity.id.slice(0, 8)}` },
      });

      // 7. Delete the unified identity
      await prisma.unifiedIdentity.delete({
        where: { id: identity.id },
      });

      return c.json({
        success: true,
        message: 'All personal data has been permanently deleted',
        deletedAt: new Date().toISOString(),
        note: 'Some anonymized analytics data may be retained as permitted under GDPR Article 17(3)(d)',
      });
    } catch (error) {
      console.error('GDPR deletion failed:', error);
      return c.json({
        success: false,
        error: 'Failed to delete data',
      }, 500);
    }
  });

  /**
   * POST /opt-out
   * Article 21: Right to Object
   * 
   * Opt out of specific processing activities
   */
  router.post(
    '/opt-out',
    zValidator('json', optOutSchema),
    async (c) => {
      const platform = c.req.header('x-platform');
      const platformId = c.req.header('x-platform-id');
      const { scopes } = c.req.valid('json');

      if (!platform || !platformId) {
        return c.json({
          success: false,
          error: 'Authentication required',
        }, 401);
      }

      try {
        const account = await prisma.linkedAccount.findUnique({
          where: {
            platform_platformId: {
              platform,
              platformId,
            },
          },
          include: {
            unifiedIdentity: {
              include: { profile: true },
            },
          },
        });

        if (!account) {
          return c.json({
            success: false,
            error: 'User not found',
          }, 404);
        }

        const identity = account.unifiedIdentity;

        // Build opt-out preferences
        const existingPrefs = (identity.profile?.preferences as Record<string, unknown>) || {};
        const optOuts = (existingPrefs.optOuts as string[]) || [];
        const newOptOuts = [...new Set([...optOuts, ...scopes])];

        // Update or create profile with opt-outs
        await prisma.userProfile.upsert({
          where: { unifiedIdentityId: identity.id },
          update: {
            preferences: {
              ...existingPrefs,
              optOuts: newOptOuts,
            },
          },
          create: {
            unifiedIdentityId: identity.id,
            preferences: {
              optOuts: newOptOuts,
            },
          },
        });

        // Apply immediate effects
        for (const scope of scopes) {
          switch (scope) {
            case 'directory_listing':
              // Remove from directory
              await prisma.userProfile.update({
                where: { unifiedIdentityId: identity.id },
                data: {
                  preferences: {
                    ...existingPrefs,
                    optOuts: newOptOuts,
                    showInDirectory: false,
                  },
                },
              });
              break;
              
            case 'activity_tracking':
              // Clear activity score
              await prisma.activityScore.deleteMany({
                where: { unifiedIdentityId: identity.id },
              });
              break;
              
            case 'conviction_scoring':
              // Set tier to 'none' (still keep wallet link for gating)
              await prisma.unifiedIdentity.update({
                where: { id: identity.id },
                data: { tier: 'none', rank: null },
              });
              break;
          }
        }

        // Log the opt-out
        await prisma.auditLog.create({
          data: {
            action: 'gdpr_opt_out',
            actor: identity.id,
            metadata: {
              scopes,
              platform,
            },
          },
        });

        return c.json({
          success: true,
          optedOut: newOptOuts,
          message: 'Processing preferences updated',
        });
      } catch (error) {
        console.error('GDPR opt-out failed:', error);
        return c.json({
          success: false,
          error: 'Failed to update preferences',
        }, 500);
      }
    }
  );

  /**
   * GET /status
   * Check GDPR compliance status for user
   */
  router.get('/status', async (c) => {
    const platform = c.req.header('x-platform');
    const platformId = c.req.header('x-platform-id');

    if (!platform || !platformId) {
      return c.json({
        success: false,
        error: 'Authentication required',
      }, 401);
    }

    try {
      const account = await prisma.linkedAccount.findUnique({
        where: {
          platform_platformId: {
            platform,
            platformId,
          },
        },
        include: {
          unifiedIdentity: {
            include: { profile: true },
          },
        },
      });

      if (!account) {
        return c.json({
          success: true,
          hasData: false,
          message: 'No personal data stored',
        });
      }

      const identity = account.unifiedIdentity;
      const prefs = (identity.profile?.preferences as Record<string, unknown>) || {};
      const optOuts = (prefs.optOuts as string[]) || [];

      return c.json({
        success: true,
        hasData: true,
        dataRegion: 'Determined by community settings',
        rights: {
          export: '/api/gdpr/export',
          delete: '/api/gdpr/delete',
          optOut: '/api/gdpr/opt-out',
        },
        currentOptOuts: optOuts,
        consentStatus: {
          termsOfService: true, // Must have accepted to have data
          privacyPolicy: true,
          walletVerification: true,
        },
        processingActivities: {
          convictionScoring: !optOuts.includes('conviction_scoring'),
          directoryListing: !optOuts.includes('directory_listing'),
          activityTracking: !optOuts.includes('activity_tracking'),
          marketing: !optOuts.includes('marketing'),
        },
      });
    } catch (error) {
      console.error('GDPR status check failed:', error);
      return c.json({
        success: false,
        error: 'Failed to check status',
      }, 500);
    }
  });

  /**
   * GET /data-passport
   * Article 15: Right of Access - Extended
   * 
   * Generates a comprehensive "Data Passport" with:
   * - All personal data
   * - Complete access history (who accessed your data)
   * - Data inventory (what categories are stored)
   * - Retention schedule (when data will be deleted)
   * 
   * Enterprise Feature: Full PII audit trail for compliance
   */
  router.get('/data-passport', async (c) => {
    const platform = c.req.header('x-platform');
    const platformId = c.req.header('x-platform-id');

    if (!platform || !platformId) {
      return c.json({
        success: false,
        error: 'Authentication required',
      }, 401);
    }

    try {
      // Find the user's identity
      const account = await prisma.linkedAccount.findUnique({
        where: {
          platform_platformId: {
            platform,
            platformId,
          },
        },
        include: {
          unifiedIdentity: true,
        },
      });

      if (!account?.unifiedIdentity) {
        return c.json({
          success: false,
          error: 'Identity not found',
        }, 404);
      }

      const subjectId = account.unifiedIdentity.id;

      // Get access history from audit logs
      const accessHistory = await prisma.auditLog.findMany({
        where: {
          action: { startsWith: 'pii_access:' },
          metadata: {
            path: ['subjectId'],
            equals: subjectId,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      // Get full identity data
      const identity = await prisma.unifiedIdentity.findUnique({
        where: { id: subjectId },
        include: {
          wallets: true,
          accounts: true,
          profile: true,
          activityScore: true,
        },
      });

      // Build data inventory
      const dataInventory = [];

      dataInventory.push({
        category: 'Core Identity',
        fields: ['unified_identity_id', 'created_at', 'updated_at'],
        source: 'Sietch Unified',
        collectedAt: identity?.createdAt,
        legalBasis: 'contract',
        retentionPeriod: 'Until account deletion',
      });

      if (identity?.wallets && identity.wallets.length > 0) {
        dataInventory.push({
          category: 'Wallet Addresses',
          fields: identity.wallets.map(w => `${w.chain}:${w.address.slice(0, 10)}...`),
          source: 'Collab.Land AccountKit',
          legalBasis: 'contract',
          retentionPeriod: 'Until wallet unlink',
        });
      }

      if (identity?.accounts && identity.accounts.length > 0) {
        dataInventory.push({
          category: 'Platform Accounts',
          fields: identity.accounts.map(a => `${a.platform}_uid`),
          source: 'User verification',
          legalBasis: 'contract',
          retentionPeriod: 'Until account unlink',
        });
      }

      if (identity?.profile) {
        dataInventory.push({
          category: 'Profile Data',
          fields: ['nym', 'visibility', 'data_region', 'preferences'],
          source: 'User input',
          legalBasis: 'consent',
          retentionPeriod: 'Until profile deletion',
        });
      }

      // Calculate retention schedule
      const now = new Date();
      const retentionSchedule = [
        {
          dataType: 'Verification Sessions',
          retentionDays: 7,
          deletionDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          legalBasis: 'Contract performance',
        },
        {
          dataType: 'Activity Events',
          retentionDays: 30,
          deletionDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          legalBasis: 'Legitimate interest',
        },
        {
          dataType: 'Conviction Scores',
          retentionDays: 90,
          deletionDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
          legalBasis: 'Legitimate interest',
        },
        {
          dataType: 'Audit Logs',
          retentionDays: 365,
          deletionDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          legalBasis: 'Legal obligation',
        },
      ];

      // Log this data passport generation
      await prisma.auditLog.create({
        data: {
          action: 'pii_access:data_export',
          actor: `user:${subjectId}`,
          metadata: {
            accessType: 'data_export',
            subjectId,
            actorId: subjectId,
            actorType: 'user',
            dataFields: ['full_data_passport'],
            purpose: 'GDPR Article 15 Data Passport generation',
            sourceService: 'GDPRRoutes',
            gdprBasis: 'legal_obligation',
          },
        },
      });

      return c.json({
        success: true,
        dataPassport: {
          subjectId,
          generatedAt: new Date().toISOString(),
          gdprArticles: ['15', '20'],
          accessHistory: accessHistory.map(log => ({
            timestamp: log.createdAt,
            action: log.action,
            actor: log.actor,
            details: log.metadata,
          })),
          dataInventory,
          retentionSchedule,
          yourRights: {
            access: 'You have the right to access all data we hold about you (Article 15)',
            portability: 'You can export your data in machine-readable format (Article 20)',
            erasure: 'You can request deletion of your data (Article 17)',
            rectification: 'You can request correction of inaccurate data (Article 16)',
            objection: 'You can object to processing for specific purposes (Article 21)',
          },
          contactDPO: 'dpo@sietch.io',
          supervisoryAuthority: 'You may lodge a complaint with your local data protection authority',
        },
      });
    } catch (error) {
      console.error('Data passport generation failed:', error);
      return c.json({
        success: false,
        error: 'Failed to generate data passport',
      }, 500);
    }
  });

  return router;
}
