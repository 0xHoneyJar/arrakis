/**
 * Vault Metrics Tests
 *
 * Sprint S-22: Vault Integration & Kill Switch
 *
 * Tests for Prometheus metrics utilities:
 * - Metric definitions
 * - NoOp metrics factory
 * - VaultMetricsHelper utility functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createNoOpVaultMetrics,
  VAULT_METRIC_DEFINITIONS,
  VaultMetricsHelper,
} from '../metrics.js';
import type { VaultMetrics } from '../metrics.js';

// =============================================================================
// Test Suites
// =============================================================================

describe('VAULT_METRIC_DEFINITIONS', () => {
  it('should define operations counter', () => {
    expect(VAULT_METRIC_DEFINITIONS.operations).toBeDefined();
    expect(VAULT_METRIC_DEFINITIONS.operations.name).toContain('operations_total');
    expect(VAULT_METRIC_DEFINITIONS.operations.type).toBe('counter');
    expect(VAULT_METRIC_DEFINITIONS.operations.labels).toContain('operation');
    expect(VAULT_METRIC_DEFINITIONS.operations.labels).toContain('status');
  });

  it('should define latency histogram', () => {
    expect(VAULT_METRIC_DEFINITIONS.latency).toBeDefined();
    expect(VAULT_METRIC_DEFINITIONS.latency.name).toContain('latency_seconds');
    expect(VAULT_METRIC_DEFINITIONS.latency.type).toBe('histogram');
    expect(VAULT_METRIC_DEFINITIONS.latency.buckets).toBeDefined();
  });

  it('should define kill switch active gauge', () => {
    expect(VAULT_METRIC_DEFINITIONS.killSwitchActive).toBeDefined();
    expect(VAULT_METRIC_DEFINITIONS.killSwitchActive.name).toContain(
      'kill_switch_active'
    );
    expect(VAULT_METRIC_DEFINITIONS.killSwitchActive.type).toBe('gauge');
  });

  it('should define MFA verifications counter', () => {
    expect(VAULT_METRIC_DEFINITIONS.mfaVerifications).toBeDefined();
    expect(VAULT_METRIC_DEFINITIONS.mfaVerifications.name).toContain(
      'mfa_verifications_total'
    );
    expect(VAULT_METRIC_DEFINITIONS.mfaVerifications.labels).toContain('status');
  });

  it('should define token renewal counter', () => {
    expect(VAULT_METRIC_DEFINITIONS.tokenRenewals).toBeDefined();
    expect(VAULT_METRIC_DEFINITIONS.tokenRenewals.name).toContain(
      'token_renewals_total'
    );
  });

  it('should define key rotations counter', () => {
    expect(VAULT_METRIC_DEFINITIONS.keyRotations).toBeDefined();
    expect(VAULT_METRIC_DEFINITIONS.keyRotations.name).toContain('key_rotations_total');
    expect(VAULT_METRIC_DEFINITIONS.keyRotations.labels).toContain('key');
  });

  it('should have appropriate latency buckets', () => {
    const buckets = VAULT_METRIC_DEFINITIONS.latency.buckets;
    expect(buckets).toContain(0.001); // 1ms
    expect(buckets).toContain(0.01);  // 10ms
    expect(buckets).toContain(0.1);   // 100ms
    expect(buckets).toContain(1);     // 1s
  });

  it('should define OAuth encryption metrics', () => {
    expect(VAULT_METRIC_DEFINITIONS.oauthEncryptions).toBeDefined();
    expect(VAULT_METRIC_DEFINITIONS.oauthEncryptions.name).toContain(
      'oauth_encryptions_total'
    );
    expect(VAULT_METRIC_DEFINITIONS.oauthDecryptions).toBeDefined();
    expect(VAULT_METRIC_DEFINITIONS.oauthDecryptions.name).toContain(
      'oauth_decryptions_total'
    );
  });

  it('should define wallet challenges metric', () => {
    expect(VAULT_METRIC_DEFINITIONS.walletChallenges).toBeDefined();
    expect(VAULT_METRIC_DEFINITIONS.walletChallenges.name).toContain(
      'wallet_challenges_total'
    );
  });
});

describe('createNoOpVaultMetrics', () => {
  let metrics: VaultMetrics;

  beforeEach(() => {
    metrics = createNoOpVaultMetrics();
  });

  it('should create metrics object with all required properties', () => {
    expect(metrics).toBeDefined();
    expect(metrics.operations).toBeDefined();
    expect(metrics.latency).toBeDefined();
    expect(metrics.tokenRenewals).toBeDefined();
    expect(metrics.keyRotations).toBeDefined();
    expect(metrics.killSwitchActive).toBeDefined();
    expect(metrics.killSwitchActivations).toBeDefined();
    expect(metrics.killSwitchDeactivations).toBeDefined();
    expect(metrics.mfaVerifications).toBeDefined();
    expect(metrics.oauthEncryptions).toBeDefined();
    expect(metrics.oauthDecryptions).toBeDefined();
    expect(metrics.walletChallenges).toBeDefined();
  });

  it('should have inc method on counters', () => {
    expect(typeof metrics.operations.inc).toBe('function');
    expect(typeof metrics.tokenRenewals.inc).toBe('function');
    expect(typeof metrics.keyRotations.inc).toBe('function');
    expect(typeof metrics.mfaVerifications.inc).toBe('function');
    expect(typeof metrics.oauthEncryptions.inc).toBe('function');
    expect(typeof metrics.oauthDecryptions.inc).toBe('function');
    expect(typeof metrics.walletChallenges.inc).toBe('function');
  });

  it('should have set method on gauges', () => {
    expect(typeof metrics.killSwitchActive.set).toBe('function');
  });

  it('should have observe method on histograms', () => {
    expect(typeof metrics.latency.observe).toBe('function');
  });

  it('should not throw when calling counter inc', () => {
    expect(() => {
      metrics.operations.inc({ operation: 'sign', status: 'success' });
    }).not.toThrow();
  });

  it('should not throw when calling gauge set', () => {
    expect(() => {
      metrics.killSwitchActive.set(1);
    }).not.toThrow();
  });

  it('should not throw when calling histogram observe', () => {
    expect(() => {
      metrics.latency.observe({ operation: 'sign' }, 0.05);
    }).not.toThrow();
  });

  it('should create independent metric instances', () => {
    const metrics1 = createNoOpVaultMetrics();
    const metrics2 = createNoOpVaultMetrics();

    expect(metrics1).not.toBe(metrics2);
    expect(metrics1.operations).not.toBe(metrics2.operations);
  });
});

describe('VaultMetricsHelper', () => {
  let metrics: VaultMetrics;

  beforeEach(() => {
    metrics = createNoOpVaultMetrics();
  });

  describe('success', () => {
    it('should increment operations counter with success status', () => {
      const incSpy = vi.spyOn(metrics.operations, 'inc');
      const observeSpy = vi.spyOn(metrics.latency, 'observe');

      VaultMetricsHelper.success(metrics, 'sign', 25);

      expect(incSpy).toHaveBeenCalledWith({
        operation: 'sign',
        status: 'success',
      });
      expect(observeSpy).toHaveBeenCalledWith({ operation: 'sign' }, 0.025);
    });
  });

  describe('error', () => {
    it('should increment operations counter with error status', () => {
      const incSpy = vi.spyOn(metrics.operations, 'inc');
      const observeSpy = vi.spyOn(metrics.latency, 'observe');

      VaultMetricsHelper.error(metrics, 'encrypt', 50);

      expect(incSpy).toHaveBeenCalledWith({
        operation: 'encrypt',
        status: 'error',
      });
      expect(observeSpy).toHaveBeenCalledWith({ operation: 'encrypt' }, 0.05);
    });
  });

  describe('mfaVerification', () => {
    it('should record successful MFA verification', () => {
      const incSpy = vi.spyOn(metrics.mfaVerifications, 'inc');

      VaultMetricsHelper.mfaVerification(metrics, true);

      expect(incSpy).toHaveBeenCalledWith({ status: 'success' });
    });

    it('should record failed MFA verification', () => {
      const incSpy = vi.spyOn(metrics.mfaVerifications, 'inc');

      VaultMetricsHelper.mfaVerification(metrics, false);

      expect(incSpy).toHaveBeenCalledWith({ status: 'failure' });
    });
  });

  describe('killSwitchStateChange', () => {
    it('should set kill switch active to 1 and increment activations', () => {
      const setSpy = vi.spyOn(metrics.killSwitchActive, 'set');
      const incSpy = vi.spyOn(metrics.killSwitchActivations, 'inc');

      VaultMetricsHelper.killSwitchStateChange(metrics, true);

      expect(setSpy).toHaveBeenCalledWith(1);
      expect(incSpy).toHaveBeenCalled();
    });

    it('should set kill switch active to 0 and increment deactivations', () => {
      const setSpy = vi.spyOn(metrics.killSwitchActive, 'set');
      const incSpy = vi.spyOn(metrics.killSwitchDeactivations, 'inc');

      VaultMetricsHelper.killSwitchStateChange(metrics, false);

      expect(setSpy).toHaveBeenCalledWith(0);
      expect(incSpy).toHaveBeenCalled();
    });
  });

  describe('oauthOperation', () => {
    it('should record successful encryption', () => {
      const incSpy = vi.spyOn(metrics.oauthEncryptions, 'inc');

      VaultMetricsHelper.oauthOperation(metrics, 'encrypt', true);

      expect(incSpy).toHaveBeenCalledWith({ status: 'success' });
    });

    it('should record failed encryption', () => {
      const incSpy = vi.spyOn(metrics.oauthEncryptions, 'inc');

      VaultMetricsHelper.oauthOperation(metrics, 'encrypt', false);

      expect(incSpy).toHaveBeenCalledWith({ status: 'error' });
    });

    it('should record successful decryption', () => {
      const incSpy = vi.spyOn(metrics.oauthDecryptions, 'inc');

      VaultMetricsHelper.oauthOperation(metrics, 'decrypt', true);

      expect(incSpy).toHaveBeenCalledWith({ status: 'success' });
    });

    it('should record failed decryption', () => {
      const incSpy = vi.spyOn(metrics.oauthDecryptions, 'inc');

      VaultMetricsHelper.oauthOperation(metrics, 'decrypt', false);

      expect(incSpy).toHaveBeenCalledWith({ status: 'error' });
    });
  });

  describe('walletChallenge', () => {
    it('should record successful wallet challenge', () => {
      const incSpy = vi.spyOn(metrics.walletChallenges, 'inc');

      VaultMetricsHelper.walletChallenge(metrics, true);

      expect(incSpy).toHaveBeenCalledWith({ status: 'success' });
    });

    it('should record failed wallet challenge', () => {
      const incSpy = vi.spyOn(metrics.walletChallenges, 'inc');

      VaultMetricsHelper.walletChallenge(metrics, false);

      expect(incSpy).toHaveBeenCalledWith({ status: 'error' });
    });
  });
});

describe('Metric Integration', () => {
  it('should allow chaining helper calls', () => {
    const metrics = createNoOpVaultMetrics();

    expect(() => {
      VaultMetricsHelper.success(metrics, 'sign', 10);
      VaultMetricsHelper.error(metrics, 'encrypt', 20);
      VaultMetricsHelper.mfaVerification(metrics, true);
      VaultMetricsHelper.killSwitchStateChange(metrics, true);
      VaultMetricsHelper.oauthOperation(metrics, 'encrypt', true);
      VaultMetricsHelper.walletChallenge(metrics, true);
    }).not.toThrow();
  });

  it('should work with real spy implementations', () => {
    const metrics = createNoOpVaultMetrics();

    // Create spies for all methods
    const spies = {
      operations: vi.spyOn(metrics.operations, 'inc'),
      latency: vi.spyOn(metrics.latency, 'observe'),
      killSwitch: vi.spyOn(metrics.killSwitchActive, 'set'),
      activations: vi.spyOn(metrics.killSwitchActivations, 'inc'),
      deactivations: vi.spyOn(metrics.killSwitchDeactivations, 'inc'),
      mfa: vi.spyOn(metrics.mfaVerifications, 'inc'),
      oauthEnc: vi.spyOn(metrics.oauthEncryptions, 'inc'),
      oauthDec: vi.spyOn(metrics.oauthDecryptions, 'inc'),
      wallet: vi.spyOn(metrics.walletChallenges, 'inc'),
    };

    // Simulate a typical operation flow
    VaultMetricsHelper.success(metrics, 'sign', 15);
    VaultMetricsHelper.mfaVerification(metrics, true);
    VaultMetricsHelper.killSwitchStateChange(metrics, true);
    VaultMetricsHelper.oauthOperation(metrics, 'encrypt', true);
    VaultMetricsHelper.walletChallenge(metrics, true);

    // Verify all metrics were recorded
    expect(spies.operations).toHaveBeenCalledTimes(1);
    expect(spies.latency).toHaveBeenCalledTimes(1);
    expect(spies.mfa).toHaveBeenCalledTimes(1);
    expect(spies.killSwitch).toHaveBeenCalledTimes(1);
    expect(spies.activations).toHaveBeenCalledTimes(1);
    expect(spies.oauthEnc).toHaveBeenCalledTimes(1);
    expect(spies.wallet).toHaveBeenCalledTimes(1);
  });
});
