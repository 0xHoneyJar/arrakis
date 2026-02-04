# Vault Transit Key Rotation Runbook

**Sprint**: S-89 (Security Audit Hardening)
**Last Updated**: 2026-01-17
**Owner**: Platform Security

---

## Overview

This runbook documents the key rotation procedures for HashiCorp Vault Transit keys used by Arrakis. Regular key rotation is a defense-in-depth measure that limits the exposure window if a key is compromised.

## Key Inventory

| Key Name | Purpose | Rotation Schedule | Algorithm |
|----------|---------|-------------------|-----------|
| `oauth-tokens` | Discord OAuth token encryption | Quarterly (Jan, Apr, Jul, Oct) | AES-256-GCM |
| `wallet-challenges` | Wallet verification challenge signing | Annually (January) | ECDSA-P256 |

## Rotation Schedule

### Quarterly Rotation (oauth-tokens)

**When**: First Monday of January, April, July, October
**Performed by**: Platform engineer with Vault admin access

### Annual Rotation (wallet-challenges)

**When**: First Monday of January
**Performed by**: Platform engineer with Vault admin access

---

## Pre-Rotation Checklist

- [ ] Verify Vault cluster health: `vault status`
- [ ] Ensure no active deployments in progress
- [ ] Notify on-call engineer of planned rotation
- [ ] Verify backup of current key metadata

## Rotation Procedures

### 1. Rotate oauth-tokens Key

```bash
# 1. Check current key version
vault read transit/keys/oauth-tokens

# 2. Rotate the key (creates new version, keeps old versions for decryption)
vault write -f transit/keys/oauth-tokens/rotate

# 3. Verify new version
vault read transit/keys/oauth-tokens
# Output should show latest_version incremented

# 4. (Optional) Set minimum decryption version after grace period
# Wait 7 days before running this to ensure all tokens can be re-encrypted
vault write transit/keys/oauth-tokens min_decryption_version=<previous_version>
```

**Grace Period**: 7 days before setting min_decryption_version

**Verification**:
```bash
# Test encryption with new key
vault write transit/encrypt/oauth-tokens plaintext=$(echo -n "test" | base64)

# Test decryption of old ciphertext (should work during grace period)
vault write transit/decrypt/oauth-tokens ciphertext=<old_ciphertext>
```

### 2. Rotate wallet-challenges Key

```bash
# 1. Check current key version
vault read transit/keys/wallet-challenges

# 2. Rotate the key
vault write -f transit/keys/wallet-challenges/rotate

# 3. Verify new version
vault read transit/keys/wallet-challenges

# 4. (Optional) Set minimum signature version after grace period
# Wallet challenges have 5-minute expiration, 24-hour grace is sufficient
vault write transit/keys/wallet-challenges min_encryption_version=<new_version>
```

**Grace Period**: 24 hours (wallet challenges expire in 5 minutes)

**Verification**:
```bash
# Test signing with new key version
vault write transit/sign/wallet-challenges input=$(echo -n "test-challenge" | base64)

# Verify the signature
vault write transit/verify/wallet-challenges \
  input=$(echo -n "test-challenge" | base64) \
  signature=<signature_from_above>
```

---

## Post-Rotation Checklist

- [ ] Verify application logs show no decryption/verification errors
- [ ] Check Prometheus metrics for Vault errors:
  ```promql
  rate(vault_transit_errors_total[5m]) > 0
  ```
- [ ] Update rotation log (below)
- [ ] Close rotation tracking issue

---

## Rollback Procedure

If rotation causes issues:

### 1. For Encryption Keys (oauth-tokens)

Old ciphertext will still decrypt as long as min_decryption_version hasn't been updated. No rollback needed for encryption keys.

If min_decryption_version was prematurely updated:
```bash
# Lower the minimum version (requires admin policy)
vault write transit/keys/oauth-tokens min_decryption_version=<older_version>
```

### 2. For Signing Keys (wallet-challenges)

Old signatures can still be verified. New challenges will be signed with new key version. No rollback typically needed.

If signatures are failing:
```bash
# Check key configuration
vault read transit/keys/wallet-challenges

# Verify key versions are available
# min_encryption_version should not be higher than signatures in use
```

---

## Rotation Log

| Date | Key | Previous Version | New Version | Performed By | Notes |
|------|-----|------------------|-------------|--------------|-------|
| 2026-01-17 | Initial setup | - | - | S-89 | Runbook created |

---

## Monitoring

### Prometheus Alerts

```yaml
# Alert if Vault Transit errors spike after rotation
- alert: VaultTransitErrorsPostRotation
  expr: |
    increase(vault_transit_errors_total[1h]) > 10
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Vault Transit errors detected after key rotation"
    description: "{{ $value }} Vault Transit errors in the last hour"
```

### CloudWatch Metrics (if using AWS)

- `Vault/TransitOperations` - Should remain stable
- `Vault/TransitErrors` - Should be zero post-rotation

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| Vault Admin | #platform-security Slack channel |
| On-Call Engineer | PagerDuty - Platform rotation |

---

## References

- [Vault Transit Secrets Engine](https://developer.hashicorp.com/vault/docs/secrets/transit)
- [Key Rotation Best Practices](https://developer.hashicorp.com/vault/tutorials/encryption-as-a-service/eaas-transit#rotate-the-encryption-key)
- Internal: `packages/adapters/security/vault-client.ts`
