/**
 * Core Ports
 * Sprint S-15: Native Blockchain Reader & Interface
 * Sprint S-16: Score Service & Two-Tier Orchestration
 * Sprint S-17: Theme Interface & BasicTheme
 *
 * Exports all port interfaces (contracts) for the application.
 * Ports define the boundaries between the core domain and external adapters.
 */

// Chain Provider Interface
export * from './chain-provider.js';

// Score Service Protocol Types
export * from './score-service.js';

// Theme Provider Interface
export * from './theme-provider.js';
