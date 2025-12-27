# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Project Context

**Sietch** is a token-gated community service for Berachain BGT holders.

| Directory | Purpose |
|-----------|---------|
| `sietch-service/` | Main backend service (Node.js/TypeScript) |
| `loa-grimoire/` | Product docs (PRD, SDD, sprint plan) |
| `loa-grimoire/a2a/` | Sprint feedback & audit records |

## Single Source of Truth

| Topic | Location |
|-------|----------|
| Project overview, API, tiers | [README.md](README.md) |
| Development setup | [sietch-service/README.md](sietch-service/README.md) |
| Product requirements | [loa-grimoire/prd.md](loa-grimoire/prd.md) |
| System design | [loa-grimoire/sdd.md](loa-grimoire/sdd.md) |
| Sprint plan | [loa-grimoire/sprint.md](loa-grimoire/sprint.md) |
| Contribution guide | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Session Completion Protocol

**When ending a work session**, complete ALL steps. Work is NOT complete until `git push` succeeds.

1. **File issues** for remaining work
2. **Run quality gates** (if code changed): `npm run build && npm run test:run`
3. **Update issue status**: Close finished, update in-progress
4. **Push to remote** (MANDATORY):
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Verify**: All changes committed AND pushed

**Rules:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing
- If push fails, resolve and retry
