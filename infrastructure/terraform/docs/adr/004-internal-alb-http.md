# ADR-004: Internal ALB Uses HTTP (Not HTTPS) for East-West Traffic

> **Status**: Accepted
> **Date**: 2026-03-02
> **Source**: Bridgebuilder Field Report #52, Finding HIGH-1 (PR #115)
> **Deciders**: Infrastructure team

## Context

The internal Application Load Balancer (`alb-internal.tf`) handles service-to-service
communication between loa-finn and loa-freeside:

```
finn → http://freeside.{env}.internal:80 → ALB → freeside ECS:3000
```

This traffic includes JWKS endpoint requests for JWT validation (SDD §4.3 S2S JWT Contract).
The Bridgebuilder review of PR #115 flagged this as HIGH severity, requesting an explicit
threat model documenting why HTTP was chosen over HTTPS for internal traffic.

## Decision

**Internal ALB uses HTTP. This is a deliberate decision, not an oversight.**

### Why Not HTTPS

AWS Certificate Manager (ACM) requires DNS validation to issue certificates. DNS validation
works by creating a CNAME record in a **public** hosted zone. Our internal ALB uses a
**private** hosted zone (`{env}.internal`) that is not resolvable from the internet. ACM
cannot validate ownership of private zone domains.

Alternative TLS options and why they were deferred:

| Option | Complexity | Why Deferred |
|--------|-----------|--------------|
| AWS Private CA | High ($400/mo + per-cert fees) | Cost disproportionate for 2-service mesh |
| Self-signed certs | Medium | Certificate rotation management overhead |
| ACM + public zone alias | Medium | Exposes internal naming in public DNS |
| Service mesh (Envoy/Istio) | High | Overkill for 2-service topology |

### Threat Model

**What security groups protect (routing layer):**
- Only finn ECS tasks can reach the ALB (ingress rule: `aws_security_group.finn.id`)
- Only the ALB can reach freeside on port 3000 (ingress rule: `aws_security_group.alb_internal.id`)
- All traffic stays within VPC private subnets — no internet exposure

**What security groups do NOT protect (content layer):**
- Traffic content is unencrypted within the VPC
- A compromised workload in the same VPC could observe S2S traffic via packet capture
- JWKS responses and JWT tokens are visible in transit

**Risk acceptance:**
- East-west lateral movement within the VPC is accepted as low-risk given:
  - VPC isolation (no VPC peering, no Transit Gateway)
  - Restrictive security groups (not `0.0.0.0/0`)
  - ECS Fargate workloads (no SSH access, no host-level compromise vector)
  - JWT tokens are short-lived (5min TTL) and scoped to S2S operations
- The attack vector requires: VPC-level compromise → packet capture → JWT extraction → use within TTL window

**Industry precedent:**
- Netflix's BeyondCorp transition took years to add mTLS to internal services; they ran HTTP internally
  for the majority of their microservices history
- Google's internal mTLS migration (ALTS) was driven by compliance requirements at hyperscale,
  not by observed east-west attacks in their earlier plaintext era
- AWS's own ECS service discovery (Cloud Map) defaults to HTTP for internal communication

### Future Path

If any of these conditions arise, upgrade to TLS:

1. **Compliance requirement** (SOC 2, PCI-DSS) mandating encryption in transit → Use AWS Private CA
2. **VPC peering or Transit Gateway** introduced → East-west exposure increases
3. **Third-party services** added to VPC → Trust boundary expands beyond our workloads
4. **Service mesh adoption** for other reasons → Piggyback mTLS on Envoy/Istio sidecars

## Consequences

### Positive

- Zero certificate management overhead
- No ACM cost for internal certificates
- Simpler debugging (plaintext HTTP requests visible in logs)
- Health checks work without TLS handshake complexity

### Negative

- Unencrypted east-west traffic (accepted risk per threat model above)
- Cannot add mutual authentication at transport layer (rely on JWT at application layer)
- May need remediation if compliance scope expands

### Neutral

- S2S JWT validation provides application-layer authentication regardless of transport encryption
- CloudWatch metrics and ALB access logs provide observability without TLS inspection
