# Agent-to-Agent Communication (`a2a/`)

This directory contains inter-agent communication artifacts generated during the Loa workflow.

## Purpose

When agents collaborate during sprints, they exchange structured feedback through files in this directory. This enables:

- **Persistent memory** across sessions
- **Audit trails** of agent decisions
- **Feedback loops** between implementation, review, and security audit phases

## Structure

```
a2a/
├── index.md                    # Audit trail index (links to all sprint artifacts)
├── trajectory/                 # Agent reasoning logs (JSONL format)
├── sprint-N/                   # Per-sprint communication
│   ├── reviewer.md             # Implementation report from engineer
│   ├── engineer-feedback.md    # Tech lead review feedback
│   ├── auditor-sprint-feedback.md  # Security audit findings
│   └── COMPLETED               # Marker indicating sprint approval
├── deployment-report.md        # DevOps deployment documentation
└── deployment-feedback.md      # Auditor feedback on infrastructure
```

## Sprint Numbering Convention

**IMPORTANT:** New sprints should continue from the highest existing sprint number.

### Current Sprint History

| Range | Feature/Project | Status |
|-------|-----------------|--------|
| 1-22 | Original Arrakis | Completed |
| 23-66 | Continued development | Archived (`sprints-archive-23-66.tar.gz`) |
| 67-83 | Part I completion | Active |
| 84-87 | Discord Server Sandboxes | Planned |

### Highest Sprint Number: **83**

When starting a new feature, check this README and use the next available number. After completing your feature, update this table.

### Legacy Prefixed Sprints (Deprecated)

Some historical sprints used prefixes. This is no longer recommended:
- `sprint-gw-N` (gateway) - 5 sprints
- `sprint-s-N` (SaaS platform) - 29 sprints
- `sprint-sec-N` (security) - 4 sprints
- `sprint-paddle-N` (billing) - 1 sprint

**New features should use sequential numbering** (e.g., sprint-84, sprint-85) instead of prefixes.

## Generated Files

All files in this directory (except this README) are generated during project execution:

- **`/implement sprint-N`** creates `sprint-N/reviewer.md`
- **`/review-sprint sprint-N`** creates `sprint-N/engineer-feedback.md`
- **`/audit-sprint sprint-N`** creates `sprint-N/auditor-sprint-feedback.md`
- **`/deploy-production`** creates deployment artifacts

## Note for Template Users

This directory is intentionally empty in the template. Files are generated when you run Loa commands on your project. The `.gitignore` excludes all generated files while preserving this README.
