@.claude/loa/CLAUDE.loa.md

# Project-Specific Instructions

> This file contains project-specific customizations that take precedence over the framework instructions.
> The framework instructions are loaded via the `@` import above.

## CRITICAL: Tool Enforcement Rules

**These rules are MANDATORY. Violations will result in incorrect behavior.**

### 1. Task Management: Use `br` (NOT `bd`)

```bash
# CORRECT - Use br (beads_rust)
br create --title "..." --type task
br ready
br update <id> --status in_progress
br close <id>
br sync

# WRONG - Never use bd
bd create ...  # DEPRECATED
bd list ...    # DEPRECATED
```

### 2. Code Search: Use `ck` (NOT `grep`)

```bash
# CORRECT - Use ck (seek) for all code search
ck "pattern" src/                    # Basic search
ck --sem "error handling" src/       # Semantic search
ck --lex "user authentication"       # Full-text search

# WRONG - Never use grep for code search
grep -r "pattern" src/  # DEPRECATED - use ck instead
rg "pattern" src/       # DEPRECATED - use ck instead
```

### 3. Goal Tracking: All PRD Goals MUST Have IDs

```markdown
## Goals

| ID | Goal | Metric |
|----|------|--------|
| G-1 | Enable parallel development | 2+ simultaneous PRs |
| G-2 | Reduce context window | -60% tokens |
```

Every goal in the PRD must have a `G-N` identifier for traceability.

---

## Chain Provider Architecture (Sprint 14-16)

The chain provider system supports multiple modes for blockchain data queries:

### Provider Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `rpc` | Direct RPC calls via viem | Default, no API key needed |
| `dune_sim` | Dune Sim API exclusively | Best performance, requires API key |
| `hybrid` | Dune Sim with RPC fallback | Production recommended |

### Environment Variables

```bash
# Required for dune_sim/hybrid modes
DUNE_SIM_API_KEY=your_api_key

# Provider mode selection
CHAIN_PROVIDER=hybrid  # Options: rpc, dune_sim, hybrid

# Enable fallback to RPC (hybrid mode only)
CHAIN_PROVIDER_FALLBACK_ENABLED=true

# Chains that should always use RPC
CHAIN_PROVIDER_RPC_ONLY_CHAINS=80094  # If Dune Sim doesn't support Berachain
```

### Key Files

| File | Purpose |
|------|---------|
| `packages/adapters/chain/dune-sim-client.ts` | Dune Sim API client |
| `packages/adapters/chain/hybrid-provider.ts` | Hybrid provider with fallback |
| `packages/adapters/chain/provider-factory.ts` | Factory for provider creation |
| `packages/adapters/chain/config.ts` | Configuration loader |
| `packages/core/ports/chain-provider.ts` | IChainProvider interface |

### Usage

```typescript
import { createChainProvider } from '@arrakis/adapters/chain';

const { provider, mode } = createChainProvider(logger);

// Standard IChainProvider methods
const balance = await provider.getBalance(chainId, address, token);
const owns = await provider.ownsNFT(chainId, address, collection);

// Dune Sim exclusive methods (optional)
if (provider.getBalanceWithUSD) {
  const { balance, priceUsd, valueUsd } = await provider.getBalanceWithUSD(chainId, address, token);
}
if (provider.getActivity) {
  const { activities } = await provider.getActivity(address, { limit: 10 });
}
```

### Migration Runbook

See `grimoires/loa/deployment/dune-sim-runbook.md` for:
- Pre-migration checklist
- Rollout procedure (staging -> production)
- Verification steps
- Rollback procedure
- Troubleshooting guide

## How This Works

1. Claude Code loads `@.claude/loa/CLAUDE.loa.md` first (framework instructions)
2. Then loads this file (project-specific instructions)
3. Instructions in this file **take precedence** over imported content
4. Framework updates modify `.claude/loa/CLAUDE.loa.md`, not this file

## Related Documentation

- `.claude/loa/CLAUDE.loa.md` - Framework-managed instructions (auto-updated)
- `.loa.config.yaml` - User configuration file
- `PROCESS.md` - Detailed workflow documentation
