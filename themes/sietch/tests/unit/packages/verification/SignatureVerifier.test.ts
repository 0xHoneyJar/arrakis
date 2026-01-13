/**
 * SignatureVerifier Tests
 *
 * Unit tests for EIP-191 signature verification.
 * Uses viem's privateKeyToAccount to generate test signatures.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import type { Hex, Address } from 'viem';
import { SignatureVerifier } from '../../../../src/packages/verification/SignatureVerifier.js';

describe('SignatureVerifier', () => {
  let verifier: SignatureVerifier;
  let testAccount: PrivateKeyAccount;
  let testMessage: string;
  let validSignature: Hex;

  // Test private key - NEVER use in production
  const TEST_PRIVATE_KEY: Hex =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  beforeAll(async () => {
    verifier = new SignatureVerifier();
    testAccount = privateKeyToAccount(TEST_PRIVATE_KEY);
    testMessage = 'Hello, Arrakis! Verify your wallet.\n\nNonce: test-nonce-123';
    validSignature = await testAccount.signMessage({ message: testMessage });
  });

  describe('verify', () => {
    it('should recover correct address from valid signature', async () => {
      const result = await verifier.verify(testMessage, validSignature);

      expect(result.valid).toBe(true);
      expect(result.recoveredAddress).toBeDefined();
      expect(result.recoveredAddress?.toLowerCase()).toBe(testAccount.address.toLowerCase());
      expect(result.error).toBeUndefined();
    });

    it('should fail for wrong message', async () => {
      const result = await verifier.verify('Wrong message', validSignature);

      // Signature is valid but recovers different address
      expect(result.valid).toBe(true);
      expect(result.recoveredAddress?.toLowerCase()).not.toBe(testAccount.address.toLowerCase());
    });

    it('should fail for invalid signature format (too short)', async () => {
      const shortSig = '0x1234' as Hex;
      const result = await verifier.verify(testMessage, shortSig);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature format');
    });

    it('should fail for invalid signature format (too long)', async () => {
      const longSig = (validSignature + 'abcd') as Hex;
      const result = await verifier.verify(testMessage, longSig);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature format');
    });

    it('should fail for invalid signature format (no 0x prefix)', async () => {
      const noPrefixSig = validSignature.slice(2) as Hex;
      const result = await verifier.verify(testMessage, noPrefixSig);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature format');
    });

    it('should fail for malformed signature (invalid hex)', async () => {
      // Create a signature-length string with invalid hex characters
      const invalidHexSig = '0x' + 'g'.repeat(130);
      const result = await verifier.verify(testMessage, invalidHexSig as Hex);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature format');
    });

    it('should handle signature with corrupted recovery byte', async () => {
      // Corrupt the last byte (v value) of the signature
      const corruptedSig = (validSignature.slice(0, -2) + '00') as Hex;
      const result = await verifier.verify(testMessage, corruptedSig);

      // viem may still recover an address or throw - either way, not the expected address
      if (result.valid && result.recoveredAddress) {
        expect(result.recoveredAddress.toLowerCase()).not.toBe(testAccount.address.toLowerCase());
      } else {
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('verifyAddress', () => {
    it('should return valid when signature matches expected address', async () => {
      const result = await verifier.verifyAddress(
        testMessage,
        validSignature,
        testAccount.address
      );

      expect(result.valid).toBe(true);
      expect(result.recoveredAddress?.toLowerCase()).toBe(testAccount.address.toLowerCase());
      expect(result.error).toBeUndefined();
    });

    it('should return valid with case-insensitive address match', async () => {
      // Keep 0x prefix lowercase, uppercase only the hex portion (valid Ethereum address format)
      const uppercaseAddress = ('0x' + testAccount.address.slice(2).toUpperCase()) as Address;
      const result = await verifier.verifyAddress(testMessage, validSignature, uppercaseAddress);

      expect(result.valid).toBe(true);
    });

    it('should fail when signature does not match expected address', async () => {
      const differentAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;
      const result = await verifier.verifyAddress(testMessage, validSignature, differentAddress);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Signature address does not match expected address');
      expect(result.recoveredAddress).toBeDefined(); // Should still return recovered address
    });

    it('should fail for invalid signature', async () => {
      const invalidSig = '0x1234' as Hex;
      const result = await verifier.verifyAddress(
        testMessage,
        invalidSig,
        testAccount.address
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature format');
    });
  });

  describe('isValidSignatureFormat', () => {
    it('should return true for valid signature format', () => {
      expect(verifier.isValidSignatureFormat(validSignature)).toBe(true);
    });

    it('should return false for signature without 0x prefix', () => {
      expect(verifier.isValidSignatureFormat(validSignature.slice(2))).toBe(false);
    });

    it('should return false for too short signature', () => {
      expect(verifier.isValidSignatureFormat('0x1234')).toBe(false);
    });

    it('should return false for too long signature', () => {
      expect(verifier.isValidSignatureFormat(validSignature + 'ab')).toBe(false);
    });

    it('should return false for invalid hex characters', () => {
      expect(verifier.isValidSignatureFormat('0x' + 'zz'.repeat(65))).toBe(false);
    });

    it('should return true for uppercase hex (with lowercase 0x prefix)', () => {
      // Uppercase the hex portion but keep 0x prefix lowercase
      const upperSig = '0x' + validSignature.slice(2).toUpperCase();
      expect(verifier.isValidSignatureFormat(upperSig)).toBe(true);
    });
  });

  describe('addressesEqual', () => {
    it('should return true for identical addresses', () => {
      expect(verifier.addressesEqual(testAccount.address, testAccount.address)).toBe(true);
    });

    it('should return true for case-different addresses', () => {
      const lower = testAccount.address.toLowerCase();
      // Keep 0x prefix lowercase, uppercase only the hex portion (valid Ethereum address format)
      const upper = '0x' + testAccount.address.slice(2).toUpperCase();
      expect(verifier.addressesEqual(lower, upper)).toBe(true);
    });

    it('should return false for different addresses', () => {
      const other = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
      expect(verifier.addressesEqual(testAccount.address, other)).toBe(false);
    });

    it('should return false for invalid addresses', () => {
      expect(verifier.addressesEqual('not-an-address', testAccount.address)).toBe(false);
      expect(verifier.addressesEqual(testAccount.address, 'not-an-address')).toBe(false);
    });
  });

  describe('isValidAddress', () => {
    it('should return true for valid checksum address', () => {
      expect(verifier.isValidAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')).toBe(true);
    });

    it('should return true for lowercase address', () => {
      expect(verifier.isValidAddress('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266')).toBe(true);
    });

    it('should return false for invalid address', () => {
      expect(verifier.isValidAddress('0x123')).toBe(false);
      expect(verifier.isValidAddress('not-an-address')).toBe(false);
      expect(verifier.isValidAddress('')).toBe(false);
    });

    it('should return false for address without 0x prefix', () => {
      expect(verifier.isValidAddress('f39Fd6e51aad88F6F4ce6aB8827279cffFb92266')).toBe(false);
    });
  });

  describe('multi-account signatures', () => {
    it('should correctly verify signatures from different accounts', async () => {
      // Second test account
      const secondAccount = privateKeyToAccount(
        '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
      );
      const secondMessage = 'Different message for second account';
      const secondSignature = await secondAccount.signMessage({ message: secondMessage });

      // Verify first account
      const result1 = await verifier.verifyAddress(
        testMessage,
        validSignature,
        testAccount.address
      );
      expect(result1.valid).toBe(true);

      // Verify second account
      const result2 = await verifier.verifyAddress(
        secondMessage,
        secondSignature,
        secondAccount.address
      );
      expect(result2.valid).toBe(true);

      // Cross-verify should fail (wrong address)
      const crossResult = await verifier.verifyAddress(
        testMessage,
        validSignature,
        secondAccount.address
      );
      expect(crossResult.valid).toBe(false);
    });
  });
});
