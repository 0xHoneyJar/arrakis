# Arrakis Codebase Analysis Report

> Generated: 2026-02-04
> Commit: 3212b41 (chore: remove simstim telegram bridge)
> Branch: chore/remove-simstim-bridge

## Project Overview

**Project**: Arrakis - Blockchain-based onboarding and verification system for Web3 communities
**Status**: Active development (Cycle 008 - Stillsuit Rapid Development Flow)

---

## Technology Stack

| Component | Technology | Reference |
|-----------|-----------|-----------|
| Runtime | Node.js + TypeScript | [package.json](../package.json) |
| Framework | Express.js (Discord bot) | [themes/sietch](../themes/sietch/) |
| Database | PostgreSQL + Drizzle ORM | [docker-compose.dev.yml](../docker-compose.dev.yml) |
| Cache | Redis | [elasticache.tf](../infrastructure/terraform/elasticache.tf) |
| Container | Docker + Docker Compose | [Dockerfile.dev](../Dockerfile.dev), [docker-compose.dev.yml](../docker-compose.dev.yml) |
| API Integration | Dune Sim API, Score Service gRPC | [dune-sim-client.ts](../packages/adapters/chain/dune-sim-client.ts), [score-service-client.ts](../packages/adapters/chain/score-service-client.ts) |
| Messaging | Discord API, Telegram API | [discord/](../themes/sietch/src/discord/), [telegram/](../themes/sietch/src/telegram/) |

---

## Package Structure

| Package | Purpose | Reference |
|---------|---------|-----------|
| `packages/core` | Domain models & ports (interfaces) | [packages/core/](../packages/core/) |
| `packages/adapters` | External integrations (chain, security, storage, themes) | [packages/adapters/](../packages/adapters/) |
| `packages/cli` | Command-line interface | [packages/cli/](../packages/cli/), [cli.md](cli.md) |
| `packages/sandbox` | Testing/experimentation | [packages/sandbox/](../packages/sandbox/), [sandbox-runbook.md](sandbox-runbook.md) |
| `themes/sietch` | Primary Discord bot application | [themes/sietch/](../themes/sietch/) |
| `apps/gateway` | API gateway microservice | [apps/gateway/](../apps/gateway/), [gateway.tf](../infrastructure/terraform/gateway.tf) |
| `apps/worker` | Background job processor | [apps/worker/](../apps/worker/) |
| `apps/ingestor` | Data ingestion service | [apps/ingestor/](../apps/ingestor/) |
| `sites/web` | Public website | [sites/web/](../sites/web/) |
| `sites/docs` | Documentation site | [sites/docs/](../sites/docs/) |

---

## Chain Provider Architecture

The chain provider system supports three modes. See [dune-sim-runbook.md](../grimoires/loa/deployment/dune-sim-runbook.md) for migration guide.

### Provider Modes

| Mode | File | Description |
|------|------|-------------|
| `rpc` | [native-reader.ts](../packages/adapters/chain/native-reader.ts) | Direct RPC calls via viem. No API key required. Default fallback. |
| `dune_sim` | [dune-sim-client.ts](../packages/adapters/chain/dune-sim-client.ts) | Dune Sim API exclusively. Requires `DUNE_SIM_API_KEY`. |
| `hybrid` | [hybrid-provider.ts](../packages/adapters/chain/hybrid-provider.ts) | Dune Sim with RPC fallback. Production recommended. |

### Supporting Files

| File | Purpose |
|------|---------|
| [provider-factory.ts](../packages/adapters/chain/provider-factory.ts) | Factory for provider creation |
| [config.ts](../packages/adapters/chain/config.ts) | Configuration loader |
| [two-tier-provider.ts](../packages/adapters/chain/two-tier-provider.ts) | Two-tier provider implementation |
| [metrics.ts](../packages/adapters/chain/metrics.ts) | Provider metrics |
| [dune-sim-metrics.ts](../packages/adapters/chain/dune-sim-metrics.ts) | Dune Sim specific metrics |
| [dune-sim-types.ts](../packages/adapters/chain/dune-sim-types.ts) | Dune Sim type definitions |

### Environment Variables

```bash
# Provider mode selection (default: rpc)
CHAIN_PROVIDER=hybrid  # Options: rpc, dune_sim, hybrid

# Dune Sim API key (required for dune_sim/hybrid modes)
DUNE_SIM_API_KEY=your_api_key

# RPC fallback settings (hybrid mode only)
CHAIN_PROVIDER_FALLBACK_ENABLED=true

# Chains that should always use RPC (comma-separated)
CHAIN_PROVIDER_RPC_ONLY_CHAINS=80094
```

### IChainProvider Interface

Core port defined at [chain-provider.ts](../packages/core/ports/chain-provider.ts)

**Tier 1 Methods** (Always Available):
- `hasBalance(chainId, address, token, minAmount): Promise<boolean>`
- `ownsNFT(chainId, address, collection, tokenId?): Promise<boolean>`
- `getBalance(chainId, address, token): Promise<bigint>`
- `getNativeBalance(chainId, address): Promise<bigint>`

**Tier 2 Methods** (May Be Unavailable):
- `getRankedHolders(asset, limit, offset): Promise<RankedHolder[]>`
- `getAddressRank(address, asset): Promise<number | null>`
- `checkActionHistory(address, config): Promise<boolean>`
- `getCrossChainScore(address, chains): Promise<CrossChainScore>`
- `isScoreServiceAvailable(): Promise<boolean>`

**Optional Methods** (Dune Sim Exclusive):
- `getBalanceWithUSD()` - Balance with USD pricing
- `getCollectibles()` - NFT enumeration with spam filtering
- `getActivity()` - Transaction history with categorization

### Supported Chains

| Chain | Chain ID |
|-------|----------|
| Berachain | 80094 |
| Ethereum | 1 |
| Polygon | 137 |
| Arbitrum One | 42161 |
| Base | 8453 |

---

## Core Domain Models

Located in [packages/core/domain/](../packages/core/domain/):

| File | Purpose |
|------|---------|
| [coexistence.ts](../packages/core/domain/coexistence.ts) | Parallel execution modes |
| [parallel-mode.ts](../packages/core/domain/parallel-mode.ts) | Parallel feature gate logic |
| [verification-tiers.ts](../packages/core/domain/verification-tiers.ts) | Multi-tier verification system |
| [wizard.ts](../packages/core/domain/wizard.ts) | Onboarding wizard state machine |
| [glimpse-mode.ts](../packages/core/domain/glimpse-mode.ts) | Lightweight preview mode |
| [migration.ts](../packages/core/domain/migration.ts) | Schema/data migration logic |

### Core Ports (Interfaces)

Located in [packages/core/ports/](../packages/core/ports/):

| File | Purpose |
|------|---------|
| [chain-provider.ts](../packages/core/ports/chain-provider.ts) | IChainProvider interface |
| [theme-provider.ts](../packages/core/ports/theme-provider.ts) | IThemeProvider interface |
| [score-service.ts](../packages/core/ports/score-service.ts) | Score service interface |
| [storage-provider.ts](../packages/core/ports/storage-provider.ts) | Storage abstraction |
| [wizard-engine.ts](../packages/core/ports/wizard-engine.ts) | Wizard engine interface |
| [feature-gate.ts](../packages/core/ports/feature-gate.ts) | Feature flag interface |
| [glimpse-mode.ts](../packages/core/ports/glimpse-mode.ts) | Glimpse mode interface |
| [migration.ts](../packages/core/ports/migration.ts) | Migration interface |

---

## Theme System

Adapter-based theme implementation in [packages/adapters/themes/](../packages/adapters/themes/):

| File | Purpose |
|------|---------|
| [basic-theme.ts](../packages/adapters/themes/basic-theme.ts) | Basic theme implementation |
| [sietch-theme.ts](../packages/adapters/themes/sietch-theme.ts) | Sietch-specific theme |
| [badge-evaluators.ts](../packages/adapters/themes/badge-evaluators.ts) | Badge evaluation logic |
| [theme-registry.ts](../packages/adapters/themes/theme-registry.ts) | Theme registry |

Core interface: [IThemeProvider](../packages/core/ports/theme-provider.ts)

---

## API Surface

### Discord Integration (Primary)

Location: [themes/sietch/src/discord/](../themes/sietch/src/discord/)

**Commands** ([commands/](../themes/sietch/src/discord/commands/)):

| Command | File | Description |
|---------|------|-------------|
| `/badges` | [badges.ts](../themes/sietch/src/discord/commands/badges.ts) | View and claim badges |
| `/stats` | [stats.ts](../themes/sietch/src/discord/commands/stats.ts) | Community statistics |
| `/profile` | [profile.ts](../themes/sietch/src/discord/commands/profile.ts) | User profile display |
| `/admin-badge` | [admin-badge.ts](../themes/sietch/src/discord/commands/admin-badge.ts) | Admin badge management |
| `/admin-water-share` | [admin-water-share.ts](../themes/sietch/src/discord/commands/admin-water-share.ts) | Admin water share management |
| `/leaderboard` | [leaderboard.ts](../themes/sietch/src/discord/commands/leaderboard.ts) | View leaderboard |
| `/alerts` | [alerts.ts](../themes/sietch/src/discord/commands/alerts.ts) | Manage alerts |
| `/threshold` | [threshold.ts](../themes/sietch/src/discord/commands/threshold.ts) | Threshold settings |
| `/directory` | [directory.ts](../themes/sietch/src/discord/commands/directory.ts) | Community directory |
| `/onboard` | [onboard.ts](../themes/sietch/src/discord/commands/onboard.ts) | Start onboarding |
| `/verify` | [verify.ts](../themes/sietch/src/discord/commands/verify.ts) | Wallet verification |
| `/simulation` | [simulation.ts](../themes/sietch/src/discord/commands/simulation.ts) | QA sandbox mode |

**Embeds** ([embeds/](../themes/sietch/src/discord/embeds/)):

| Embed | File |
|-------|------|
| Badge display | [badge.ts](../themes/sietch/src/discord/embeds/badge.ts) |
| Profile | [profile.ts](../themes/sietch/src/discord/embeds/profile.ts) |
| Alerts | [alerts.ts](../themes/sietch/src/discord/embeds/alerts.ts) |
| Stats | [stats.ts](../themes/sietch/src/discord/embeds/stats.ts) |
| Directory | [directory.ts](../themes/sietch/src/discord/embeds/directory.ts) |
| Threshold | [threshold.ts](../themes/sietch/src/discord/embeds/threshold.ts) |

**Interactions** ([interactions/](../themes/sietch/src/discord/interactions/)):

| Interaction | File |
|-------------|------|
| Onboarding flow | [onboarding.ts](../themes/sietch/src/discord/interactions/onboarding.ts) |
| Alert management | [alerts.ts](../themes/sietch/src/discord/interactions/alerts.ts) |

### Telegram Integration (Secondary)

Location: [themes/sietch/src/telegram/](../themes/sietch/src/telegram/)

**Commands** ([commands/](../themes/sietch/src/telegram/commands/)):

| Command | File | Description |
|---------|------|-------------|
| `/score` | [score.ts](../themes/sietch/src/telegram/commands/score.ts) | Check score |
| `/refresh` | [refresh.ts](../themes/sietch/src/telegram/commands/refresh.ts) | Refresh data |
| `/status` | [status.ts](../themes/sietch/src/telegram/commands/status.ts) | Connection status |
| `/unlink` | [unlink.ts](../themes/sietch/src/telegram/commands/unlink.ts) | Unlink account |
| `/leaderboard` | [leaderboard.ts](../themes/sietch/src/telegram/commands/leaderboard.ts) | View leaderboard |
| `/alerts` | [alerts.ts](../themes/sietch/src/telegram/commands/alerts.ts) | Manage alerts |
| `/verify` | [verify.ts](../themes/sietch/src/telegram/commands/verify.ts) | Verify wallet |
| `/help` | [help.ts](../themes/sietch/src/telegram/commands/help.ts) | Help text |
| `/start` | [start.ts](../themes/sietch/src/telegram/commands/start.ts) | Bot start |

**Features**:
- Bot entry: [bot.ts](../themes/sietch/src/telegram/bot.ts)
- Inline queries: [inline.ts](../themes/sietch/src/telegram/inline.ts)

---

## Infrastructure

### Stillsuit Rapid Development Flow

See [STILLSUIT.md](STILLSUIT.md) for full documentation.

| Environment | Target |
|-------------|--------|
| Local iteration | <5 seconds (tsx watch + hot-reload) |
| Staging deployment | <5 minutes (Docker + ECS) |

**Components**:

| File | Purpose |
|------|---------|
| [docker-compose.dev.yml](../docker-compose.dev.yml) | Local dev environment (PostgreSQL, Redis) |
| [Dockerfile.base](../Dockerfile.base) | Dependency caching base image |
| [Dockerfile.dev](../Dockerfile.dev) | Development image with file watcher |
| [themes/sietch/Dockerfile](../themes/sietch/Dockerfile) | Production bot image |

### Production Infrastructure

Terraform definitions in [infrastructure/terraform/](../infrastructure/terraform/):

| Component | File | Description |
|-----------|------|-------------|
| Compute | [ecs.tf](../infrastructure/terraform/ecs.tf) | ECS Fargate services |
| Database | [rds.tf](../infrastructure/terraform/rds.tf) | PostgreSQL (RDS) |
| Cache | [elasticache.tf](../infrastructure/terraform/elasticache.tf) | Redis (ElastiCache) |
| Load Balancer | [alb.tf](../infrastructure/terraform/alb.tf) | Application Load Balancer |
| Networking | [vpc.tf](../infrastructure/terraform/vpc.tf) | VPC configuration |
| DNS | [route53.tf](../infrastructure/terraform/route53.tf) | Route53 DNS |
| Autoscaling | [autoscaling.tf](../infrastructure/terraform/autoscaling.tf) | ECS autoscaling |
| Monitoring | [monitoring.tf](../infrastructure/terraform/monitoring.tf) | CloudWatch alarms |
| Tracing | [tracing.tf](../infrastructure/terraform/tracing.tf) | X-Ray tracing |
| Gateway | [gateway.tf](../infrastructure/terraform/gateway.tf) | API Gateway config |
| Security | [kms.tf](../infrastructure/terraform/kms.tf) | KMS encryption |

See [iac.md](iac.md) for infrastructure documentation.

---

## Testing

### Test Locations

| Directory | Coverage | Files |
|-----------|----------|-------|
| [packages/adapters/chain/__tests__/](../packages/adapters/chain/__tests__/) | Chain provider tests | 6 files |
| [packages/adapters/security/__tests__/](../packages/adapters/security/__tests__/) | Security tests | 6 files |
| [packages/adapters/themes/__tests__/](../packages/adapters/themes/__tests__/) | Theme tests | 4 files |

### Chain Provider Tests

| File | Purpose |
|------|---------|
| [dune-sim-integration.test.ts](../packages/adapters/chain/__tests__/dune-sim-integration.test.ts) | End-to-end Dune Sim tests |
| [dune-sim-client.test.ts](../packages/adapters/chain/__tests__/dune-sim-client.test.ts) | Dune Sim client unit tests |
| [two-tier-provider.test.ts](../packages/adapters/chain/__tests__/two-tier-provider.test.ts) | Hybrid provider validation |
| [native-reader.test.ts](../packages/adapters/chain/__tests__/native-reader.test.ts) | RPC fallback testing |
| [metrics.test.ts](../packages/adapters/chain/__tests__/metrics.test.ts) | Provider metrics |
| [score-service-client.test.ts](../packages/adapters/chain/__tests__/score-service-client.test.ts) | Score service integration |

### Security Tests

| File | Purpose |
|------|---------|
| [wallet-verification.test.ts](../packages/adapters/security/__tests__/wallet-verification.test.ts) | Wallet signature verification |
| [oauth-token-encryption.test.ts](../packages/adapters/security/__tests__/oauth-token-encryption.test.ts) | OAuth token encryption |
| [vault-client.test.ts](../packages/adapters/security/__tests__/vault-client.test.ts) | Vault client tests |
| [mfa-verifier.test.ts](../packages/adapters/security/__tests__/mfa-verifier.test.ts) | MFA verification |
| [kill-switch.test.ts](../packages/adapters/security/__tests__/kill-switch.test.ts) | Kill switch tests |
| [metrics.test.ts](../packages/adapters/security/__tests__/metrics.test.ts) | Security metrics |

### Theme Tests

| File | Purpose |
|------|---------|
| [basic-theme.test.ts](../packages/adapters/themes/__tests__/basic-theme.test.ts) | Basic theme tests |
| [sietch-theme.test.ts](../packages/adapters/themes/__tests__/sietch-theme.test.ts) | Sietch theme tests |
| [badge-evaluators.test.ts](../packages/adapters/themes/__tests__/badge-evaluators.test.ts) | Badge evaluator tests |
| [theme-registry.test.ts](../packages/adapters/themes/__tests__/theme-registry.test.ts) | Theme registry tests |

---

## Code Quality

### Tech Debt Markers

| Metric | Count |
|--------|-------|
| Total TODO/FIXME/HACK/BUG | 381 comments |
| Distribution | 52% adapters, 28% themes |

**Critical Areas**:
- Chain provider fallback logic ([hybrid-provider.ts](../packages/adapters/chain/hybrid-provider.ts))
- Theme evaluation ([badge-evaluators.ts](../packages/adapters/themes/badge-evaluators.ts))
- Score service integration ([score-service-client.ts](../packages/adapters/chain/score-service-client.ts))

---

## Documentation Artifacts

### Planning Documents

| File | Purpose |
|------|---------|
| [grimoires/loa/prd.md](../grimoires/loa/prd.md) | Product Requirements Document |
| [grimoires/loa/sdd.md](../grimoires/loa/sdd.md) | Software Design Document |
| [grimoires/loa/sprint.md](../grimoires/loa/sprint.md) | Sprint planning |
| [grimoires/loa/NOTES.md](../grimoires/loa/NOTES.md) | Development notes |

### Deployment Guides

| File | Purpose |
|------|---------|
| [deployment/README.md](../grimoires/loa/deployment/README.md) | Deployment overview |
| [deployment/deployment-guide.md](../grimoires/loa/deployment/deployment-guide.md) | General deployment guide |
| [deployment/dune-sim-runbook.md](../grimoires/loa/deployment/dune-sim-runbook.md) | Dune Sim migration runbook |
| [deployment/production-runsheet.md](../grimoires/loa/deployment/production-runsheet.md) | Production runsheet |
| [deployment/STAGING-DEPLOYMENT-PLAN.md](../grimoires/loa/deployment/STAGING-DEPLOYMENT-PLAN.md) | Staging deployment plan |
| [deployment/PRODUCTION-DEPLOYMENT-PLAN.md](../grimoires/loa/deployment/PRODUCTION-DEPLOYMENT-PLAN.md) | Production deployment plan |
| [deployment/infrastructure.md](../grimoires/loa/deployment/infrastructure.md) | Infrastructure documentation |

### Developer Guides

| File | Purpose |
|------|---------|
| [STILLSUIT.md](STILLSUIT.md) | Development workflow |
| [MAINTAINER_GUIDE.md](MAINTAINER_GUIDE.md) | Maintainer guide |
| [cli.md](cli.md) | CLI documentation |
| [iac.md](iac.md) | Infrastructure as Code guide |
| [sandbox-runbook.md](sandbox-runbook.md) | Sandbox environment guide |
| [discord-test-server-setup.md](discord-test-server-setup.md) | Discord test server setup |
