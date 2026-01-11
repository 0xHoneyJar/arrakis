# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 5.1.x   | :white_check_mark: |
| 5.0.x   | :white_check_mark: |
| < 5.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Do NOT create a public GitHub issue for security vulnerabilities.**

Instead, please report security vulnerabilities by emailing:

**security@0xhoneyjar.xyz**

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., SQL injection, XSS, authentication bypass)
- Full path(s) of the affected source file(s)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact assessment of the vulnerability

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Target**: Within 30 days (depending on severity)

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
2. **Assessment**: Our security team will assess the vulnerability and determine its severity
3. **Updates**: We will keep you informed of our progress
4. **Resolution**: Once fixed, we will notify you before public disclosure
5. **Credit**: With your permission, we will credit you in our security advisory

## Security Measures

Arrakis implements the following security controls:

### Data Protection
- Row-Level Security (RLS) for multi-tenant isolation
- Encryption at rest (AWS KMS)
- TLS 1.3 for all data in transit
- PII scrubbing in application logs

### Authentication & Authorization
- API key authentication with HMAC-SHA256
- Rate limiting per tenant
- Webhook signature verification

### Infrastructure Security
- Private subnets for compute and data layers
- VPC Flow Logs for network monitoring
- AWS WAF for edge protection
- HashiCorp Vault for secrets management

### Compliance
- SOC 2 Type II controls mapped
- GDPR compliant data handling
- Regular security audits

## Security Updates

Security updates are released as patch versions (e.g., 5.1.1) and announced via:

- GitHub Security Advisories
- Release notes in CHANGELOG.md

We recommend keeping your deployment up to date with the latest patch version.

## Scope

This security policy applies to:

- The Arrakis SaaS platform
- The sietch-service API
- Discord and Telegram bot integrations
- Official documentation

Third-party dependencies are covered by their respective security policies.
