/**
 * Telegram API Routes (v4.1 - Sprint 30)
 *
 * Handles:
 * - Telegram bot webhook endpoint
 * - Health check for bot status
 * - Collab.Land verification callback
 */

import { Router, type Request, type Response } from 'express';
import { config, isTelegramEnabled } from '../config.js';
import { logger } from '../utils/logger.js';
import {
  telegramWebhookHandler,
  getTelegramBotInfo,
  sendTelegramMessage,
} from '../telegram/bot.js';
import { identityService } from '../services/IdentityService.js';

export const telegramRouter = Router();

// =============================================================================
// Middleware
// =============================================================================

/**
 * Validate Telegram webhook secret token
 * Telegram sends this in the X-Telegram-Bot-Api-Secret-Token header
 */
function validateTelegramWebhook(req: Request, res: Response, next: Function): void {
  if (!isTelegramEnabled()) {
    res.status(503).json({ error: 'Telegram bot is disabled' });
    return;
  }

  const secretToken = req.headers['x-telegram-bot-api-secret-token'];

  // If webhook secret is configured, validate it
  if (config.telegram.webhookSecret) {
    if (secretToken !== config.telegram.webhookSecret) {
      logger.warn(
        { receivedToken: secretToken ? '***' : 'none' },
        'Invalid Telegram webhook secret token'
      );
      res.status(403).json({ error: 'Invalid webhook secret' });
      return;
    }
  }

  next();
}

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /telegram/webhook
 *
 * Telegram Bot API webhook endpoint.
 * Receives updates from Telegram and processes them.
 */
telegramRouter.post('/webhook', validateTelegramWebhook, (req, res) => {
  logger.debug(
    { updateId: req.body?.update_id },
    'Received Telegram webhook update'
  );

  telegramWebhookHandler(req, res);
});

/**
 * GET /telegram/health
 *
 * Health check endpoint for Telegram bot.
 * Returns bot status and info.
 */
telegramRouter.get('/health', async (_req, res) => {
  if (!isTelegramEnabled()) {
    res.json({
      status: 'disabled',
      message: 'Telegram bot is not enabled',
    });
    return;
  }

  try {
    const botInfo = await getTelegramBotInfo();

    if (botInfo) {
      res.json({
        status: 'healthy',
        bot: {
          id: botInfo.id,
          username: botInfo.username,
          firstName: botInfo.firstName,
          canReadMessages: botInfo.canReadMessages,
        },
        webhookConfigured: !!config.telegram.webhookUrl,
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        message: 'Could not get bot info',
      });
    }
  } catch (error) {
    logger.error({ error }, 'Telegram health check failed');
    res.status(503).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /telegram/verify/callback
 *
 * Collab.Land verification callback endpoint.
 * Called when a user completes wallet verification.
 */
telegramRouter.post('/verify/callback', async (req, res) => {
  try {
    const { sessionId, walletAddress, signature } = req.body;

    if (!sessionId || !walletAddress) {
      res.status(400).json({
        error: 'Missing required fields: sessionId, walletAddress',
      });
      return;
    }

    logger.info(
      { sessionId, walletAddress: walletAddress.slice(0, 10) + '...' },
      'Received Telegram verification callback'
    );

    // TODO: Verify Collab.Land signature if provided
    // This depends on your specific Collab.Land integration
    // For now, we trust the callback (should be internal network only)
    if (signature) {
      // Placeholder for signature verification
      logger.debug({ sessionId }, 'Signature verification placeholder');
    }

    // Complete the verification
    const result = await identityService.completeVerification(
      sessionId,
      walletAddress
    );

    // Send success message to the Telegram user
    const truncatedWallet = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    const sent = await sendTelegramMessage(
      result.telegramUserId,
      `✅ *Wallet Linked Successfully!*\n\n` +
        `Your Telegram account is now linked to:\n` +
        `\`${truncatedWallet}\`\n\n` +
        `Use /score to see your conviction score.`,
      { parseMode: 'Markdown' }
    );

    if (!sent) {
      logger.warn(
        { telegramUserId: result.telegramUserId },
        'Could not send verification success message to user'
      );
    }

    res.json({
      success: true,
      memberId: result.memberId,
      message: 'Wallet linked successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Telegram verification callback failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // If we have a session ID, mark it as failed
    if (req.body?.sessionId) {
      try {
        await identityService.failVerification(req.body.sessionId, errorMessage);
      } catch (failError) {
        // Ignore secondary errors
      }
    }

    res.status(400).json({
      error: errorMessage,
    });
  }
});

/**
 * GET /telegram/session/:sessionId
 *
 * Get verification session status.
 * Used by frontend to poll for verification completion.
 */
telegramRouter.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await identityService.getVerificationSession(sessionId);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({
      id: session.id,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      completedAt: session.completedAt?.toISOString(),
      // Don't expose wallet address until completed
      walletLinked: session.status === 'completed',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get verification session');
    res.status(500).json({ error: 'Internal server error' });
  }
});
