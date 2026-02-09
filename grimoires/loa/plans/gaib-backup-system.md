# Plan: Gaib Backup & Snapshot System

## Overview

Comprehensive backup and snapshot system for Gaib Discord IaC with tiered service levels (Free/Premium).

**Goals:**
1. State Backup - Terraform state files to S3 with versioning
2. Config Export - Export Discord server config to YAML
3. Full Snapshots - Periodic snapshots with versioning and rollback
4. Theme Registry - Central registry of deployed themes with audit history
5. Tiered Service - Free (daily/7-day) vs Premium (hourly/90-day)

---

## Current State (What Exists)

### Gaib CLI
- ✅ S3Backend with DynamoDB locking (`packages/cli/src/commands/server/iac/backends/S3Backend.ts`)
- ✅ LocalBackend for development
- ✅ State versioning with serial numbers and lineage
- ✅ WorkspaceManager for environment isolation
- ✅ Export command (basic)
- ❌ No backup/snapshot functionality
- ❌ No rollback capability
- ❌ No theme registry

### Terraform Infrastructure
- ✅ S3 bucket for Terraform state (`arrakis-tfstate-891376933289`)
- ✅ DynamoDB for state locking
- ✅ KMS encryption
- ❌ No S3 versioning on state bucket
- ❌ No dedicated backup bucket
- ❌ No cross-region replication

---

## Service Tiers

| Feature | Free Tier | Premium Tier |
|---------|-----------|--------------|
| Backup Frequency | Daily | Hourly |
| On-demand Backups | 1/day | Unlimited |
| Retention | 7 days | 90 days |
| Cross-Region | No | Yes |
| Full Snapshots | Manual | Weekly auto |
| Theme History | Last 5 | Unlimited |
| Storage Class | Standard | Standard → Glacier |

---

## S3 Storage Structure

```
s3://gaib-backups-{account_id}/
├── state/{server_id}/{workspace}/
│   └── backup.{timestamp}.json.gz
├── exports/{server_id}/
│   ├── config.{timestamp}.yaml
│   └── config.latest.yaml
├── snapshots/{server_id}/{snapshot_id}/
│   ├── manifest.json
│   ├── state.json.gz
│   ├── config.yaml.gz
│   └── theme-registry.json.gz
├── themes/{server_id}/
│   ├── registry.json
│   └── audit/{timestamp}.json
└── metadata/{server_id}/
    └── backup-schedule.json
```

---

## CLI Commands

### Backup Commands
```bash
gaib server backup create [--message "..."]
gaib server backup list [--limit 20]
gaib server backup restore <backup-id> [--dry-run]
gaib server backup delete <backup-id>
```

### Snapshot Commands
```bash
gaib server snapshot create [--message "..."]
gaib server snapshot list
gaib server snapshot restore <snapshot-id> [--dry-run] [--apply]
gaib server snapshot download <snapshot-id> -o ./backup/
gaib server snapshot compare <id1> <id2>
```

### Theme Registry Commands
```bash
gaib server theme registry          # Show current + last 5
gaib server theme history [--limit] # Full deployment history
gaib server theme rollback [--steps 1] [--to <deployment-id>]
```

---

## Terraform Infrastructure

### New File: `infrastructure/terraform/gaib-backups.tf`

**Resources:**
1. **S3 Bucket** (`gaib-backups-{account}`)
   - Versioning enabled
   - KMS encryption
   - Lifecycle rules by tier tag
   - Public access blocked

2. **KMS Key** for backup encryption

3. **DynamoDB Table** (`gaib-backup-metadata`)
   - Partition key: `SERVER#{server_id}`
   - Sort key: `BACKUP#{timestamp}#{id}`
   - TTL for auto-expiration
   - Point-in-time recovery

4. **S3 Replication** (Premium only)
   - Cross-region to us-west-2
   - Filter by `Tier=premium` tag

5. **CloudWatch Alarms**
   - Backup errors
   - Bucket size warnings

6. **EventBridge Rules**
   - Free: Daily at 03:00 UTC
   - Premium: Hourly

---

## Implementation Phases

### Phase 1: Foundation (Sprint 1)
- [ ] Create `BackupManager` class
- [ ] `gaib server backup create` command
- [ ] `gaib server backup list` command
- [ ] Terraform: S3 bucket, KMS, DynamoDB table
- [ ] Unit tests

### Phase 2: Restore (Sprint 2)
- [ ] `RestoreEngine` with integrity checks
- [ ] `gaib server backup restore` command
- [ ] Lineage validation
- [ ] Integration tests

### Phase 3: Snapshots (Sprint 3)
- [ ] `SnapshotManager` for full bundles
- [ ] `gaib server snapshot create/list/restore`
- [ ] Compression (gzip/zstd)
- [ ] Checksum verification

### Phase 4: Theme Registry (Sprint 4)
- [ ] `ThemeRegistryManager`
- [ ] Integration with theme deployment
- [ ] `gaib server theme registry/history/rollback`
- [ ] Audit logging

### Phase 5: Service Tiers (Sprint 5)
- [ ] `TierManager` with usage tracking
- [ ] S3 lifecycle policies
- [ ] EventBridge scheduled backups
- [ ] Cross-region replication

### Phase 6: Polish (Sprint 6)
- [ ] CloudWatch alarms
- [ ] Documentation
- [ ] Error handling
- [ ] Performance optimization

---

## File Structure

### New CLI Files
```
packages/cli/src/commands/server/backup/
├── index.ts              # Command registration
├── types.ts              # Backup/snapshot types
├── BackupManager.ts      # Core backup operations
├── SnapshotManager.ts    # Full snapshot operations
├── RestoreEngine.ts      # Restore logic
├── ThemeRegistryManager.ts
├── TierManager.ts        # Service tier management
└── __tests__/
```

### New Terraform Files
```
infrastructure/terraform/
├── gaib-backups.tf       # Main backup infra
└── gaib-backups-iam.tf   # IAM roles
```

---

## Critical Files to Modify

| File | Action |
|------|--------|
| `packages/cli/src/commands/server/index.ts` | Add backup/snapshot commands |
| `packages/cli/src/commands/server/iac/backends/S3Backend.ts` | Reference for S3 patterns |
| `packages/cli/src/commands/server/export.ts` | Enhance with backup flag |
| `infrastructure/terraform/variables.tf` | Add backup variables |

---

## Verification

1. **Unit Tests**: BackupManager, RestoreEngine, ThemeRegistryManager
2. **Integration Tests**: Full backup → restore cycle
3. **Manual Testing**:
   - Create backup, list, restore
   - Create snapshot, download, restore
   - Theme rollback
   - Verify S3 lifecycle policies
   - Test tier limits

---

## Key Decisions

### 1. Scheduled Backups: ECS Scheduled Tasks
**Rationale**: Works with existing ECS infrastructure, fully Terraform-manageable, consistent environment with CLI.

```hcl
# EventBridge rule triggers ECS task
resource "aws_cloudwatch_event_rule" "backup_schedule" {
  schedule_expression = "cron(0 3 * * ? *)"  # Daily
}

resource "aws_cloudwatch_event_target" "backup_ecs" {
  rule     = aws_cloudwatch_event_rule.backup_schedule.name
  arn      = aws_ecs_cluster.main.arn
  role_arn = aws_iam_role.eventbridge_ecs.arn

  ecs_target {
    task_definition_arn = aws_ecs_task_definition.backup.arn
    launch_type         = "FARGATE"
  }
}
```

### 2. Premium Tier: Feature Flag (Phase 1)
**Rationale**: Not yet defined - start simple with DynamoDB feature flag, expand later.

```typescript
// Initial implementation - simple flag
interface ServerConfig {
  serverId: string;
  tier: "free" | "premium";  // Manual toggle initially
  // Future: stripeCustomerId, licenseKey, etc.
}
```

**Future Options** (when monetization defined):
- Stripe integration for self-service
- License key system for enterprise
- Usage-based billing

### 3. Notifications: SNS Fan-out (Best Practice)
**Rationale**: Decoupled architecture, multiple delivery channels, standard AWS pattern.

```
SNS Topic: gaib-backup-notifications
├── Discord Webhook (Lambda subscriber)
├── Email via SES (direct subscription)
└── CloudWatch Logs (for audit)
```

**Terraform**:
```hcl
resource "aws_sns_topic" "backup_notifications" {
  name = "gaib-backup-notifications"
}

# Lambda for Discord webhook
resource "aws_lambda_function" "discord_notifier" {
  # Posts to Discord when backup completes/fails
}

resource "aws_sns_topic_subscription" "discord" {
  topic_arn = aws_sns_topic.backup_notifications.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.discord_notifier.arn
}
```
