/**
 * SignatureVerifier
 *
 * EIP-191 signature verification using viem.
 * Recovers the signing address from a personal_sign signature.
 */

import { recoverMessageAddress, type Address, type Hex, isAddress } from 'viem';
import type { VerificationResult } from './types.js';

/**
 * Verifies EIP-191 (personal_sign) signatures and recovers the signing address.
 *
 * Uses viem's recoverMessageAddress() which handles:
 * - EIP-191 message prefix ("\x19Ethereum Signed Message:\n")
 * - ECDSA signature recovery (r, s, v components)
 * - Address derivation from public key
 */
export class SignatureVerifier {
  /**
   * Verify a signature and recover the signing address
   *
   * @param message - The original message that was signed
   * @param signature - The signature as a hex string (65 bytes: r + s + v)
   * @returns VerificationResult with valid flag and recovered address
   */
  async verify(message: string, signature: Hex): Promise<VerificationResult> {
    try {
      // Validate signature format before attempting recovery
      if (!this.isValidSignatureFormat(signature)) {
        return {
          valid: false,
          error: 'Invalid signature format',
        };
      }

      const recoveredAddress = await recoverMessageAddress({
        message,
        signature,
      });

      return {
        valid: true,
        recoveredAddress,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Signature verification failed',
      };
    }
  }

  /**
   * Verify a signature matches an expected address
   *
   * @param message - The original message that was signed
   * @param signature - The signature as a hex string
   * @param expectedAddress - The address that should have signed the message
   * @returns VerificationResult with valid flag indicating address match
   */
  async verifyAddress(
    message: string,
    signature: Hex,
    expectedAddress: Address
  ): Promise<VerificationResult> {
    // First verify the signature and recover the address
    const result = await this.verify(message, signature);

    if (!result.valid || !result.recoveredAddress) {
      return result;
    }

    // Case-insensitive address comparison
    const addressMatch = this.addressesEqual(result.recoveredAddress, expectedAddress);

    if (!addressMatch) {
      return {
        valid: false,
        recoveredAddress: result.recoveredAddress,
        error: 'Signature address does not match expected address',
      };
    }

    return {
      valid: true,
      recoveredAddress: result.recoveredAddress,
    };
  }

  /**
   * Check if a signature has valid format
   *
   * @param signature - The signature to validate
   * @returns true if signature format is valid
   */
  isValidSignatureFormat(signature: string): boolean {
    // Must start with 0x
    if (!signature.startsWith('0x')) {
      return false;
    }

    // Must be 65 bytes (130 hex chars + 0x prefix = 132 chars)
    if (signature.length !== 132) {
      return false;
    }

    // Must be valid hex
    const hexPart = signature.slice(2);
    return /^[0-9a-fA-F]+$/.test(hexPart);
  }

  /**
   * Compare two addresses for equality (case-insensitive)
   *
   * @param address1 - First address
   * @param address2 - Second address
   * @returns true if addresses are equal
   */
  addressesEqual(address1: string, address2: string): boolean {
    // Use strict: false to allow case-insensitive address formats
    if (!isAddress(address1, { strict: false }) || !isAddress(address2, { strict: false })) {
      return false;
    }
    return address1.toLowerCase() === address2.toLowerCase();
  }

  /**
   * Validate that an address is a valid Ethereum address
   *
   * @param address - The address to validate
   * @returns true if address is valid (accepts any case)
   */
  isValidAddress(address: string): boolean {
    return isAddress(address, { strict: false });
  }
}
