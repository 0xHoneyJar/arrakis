# Gateway Proxy Operations Runbook

## Quick Reference

| Component | Logs | Dashboard | Service |
|-----------|------|-----------|---------|
| Ingestor | `/ecs/arrakis-{env}/ingestor` | `arrakis-{env}-gateway-proxy` | `arrakis-{env}-ingestor` |
| Worker | `/ecs/arrakis-{env}/gp-worker` | `arrakis-{env}-gateway-proxy` | `arrakis-{env}-gp-worker` |
| RabbitMQ | `/aws/amazonmq/arrakis-{env}-rabbitmq` | AWS Console | `arrakis-{env}-rabbitmq` |

## Common Operations

### Check System Health

```bash
# View ECS service status
aws ecs describe-services \
  --cluster arrakis-staging-cluster \
  --services arrakis-staging-ingestor arrakis-staging-gp-worker \
  --query 'services[*].{name:serviceName,desired:desiredCount,running:runningCount,status:status}'

# Check RabbitMQ queue depths
aws cloudwatch get-metric-statistics \
  --namespace AWS/AmazonMQ \
  --metric-name MessageCount \
  --dimensions Name=Broker,Value=arrakis-staging-rabbitmq Name=Queue,Value=arrakis.interactions \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 \
  --statistics Average
```

### View Recent Logs

```bash
# Ingestor logs (last 30 minutes)
aws logs filter-log-events \
  --log-group-name /ecs/arrakis-staging/ingestor \
  --start-time $(date -u -d '30 minutes ago' +%s)000 \
  --filter-pattern "ERROR"

# Worker logs
aws logs filter-log-events \
  --log-group-name /ecs/arrakis-staging/gp-worker \
  --start-time $(date -u -d '30 minutes ago' +%s)000 \
  --filter-pattern "ERROR"
```

### Scale Services

```bash
# Scale Worker up
aws ecs update-service \
  --cluster arrakis-staging-cluster \
  --service arrakis-staging-gp-worker \
  --desired-count 3

# Scale Worker down
aws ecs update-service \
  --cluster arrakis-staging-cluster \
  --service arrakis-staging-gp-worker \
  --desired-count 1
```

### Force Service Restart

```bash
# Force new deployment (rolling restart)
aws ecs update-service \
  --cluster arrakis-staging-cluster \
  --service arrakis-staging-ingestor \
  --force-new-deployment
```

## Troubleshooting

### Alarm: No Ingestor Tasks Running

**Severity**: CRITICAL

**Impact**: Discord events not being captured. Users see no response to commands.

**Investigation**:
1. Check ECS service events:
   ```bash
   aws ecs describe-services \
     --cluster arrakis-staging-cluster \
     --services arrakis-staging-ingestor \
     --query 'services[0].events[:5]'
   ```

2. Check recent logs for crash reason:
   ```bash
   aws logs filter-log-events \
     --log-group-name /ecs/arrakis-staging/ingestor \
     --start-time $(date -u -d '1 hour ago' +%s)000 \
     --filter-pattern "fatal OR panic OR crash"
   ```

3. Check task failures:
   ```bash
   aws ecs list-tasks \
     --cluster arrakis-staging-cluster \
     --service-name arrakis-staging-ingestor \
     --desired-status STOPPED
   ```

**Resolution**:
- If OOM: Increase memory in task definition
- If crash loop: Check Discord token validity
- If network error: Check VPC/security groups

### Alarm: No Worker Tasks Running

**Severity**: CRITICAL

**Impact**: Queue messages accumulating. Commands deferred but never responded.

**Investigation**:
1. Same steps as Ingestor above, but for gp-worker service

2. Check queue depth (messages are buffering):
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/AmazonMQ \
     --metric-name MessageCount \
     --dimensions Name=Broker,Value=arrakis-staging-rabbitmq Name=Queue,Value=arrakis.interactions \
     --start-time $(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
     --period 60 \
     --statistics Average
   ```

**Resolution**:
- Messages are preserved in queue
- Fix the issue and restart Worker
- Messages will process automatically

### Alarm: Queue Depth High

**Severity**: WARNING

**Impact**: Increased latency for command responses.

**Investigation**:
1. Check Worker task count and CPU:
   ```bash
   aws ecs describe-services \
     --cluster arrakis-staging-cluster \
     --services arrakis-staging-gp-worker \
     --query 'services[0].{running:runningCount,cpu:deployments[0].rolloutState}'
   ```

2. Check Worker logs for slow queries:
   ```bash
   aws logs filter-log-events \
     --log-group-name /ecs/arrakis-staging/gp-worker \
     --start-time $(date -u -d '15 minutes ago' +%s)000 \
     --filter-pattern "slow OR timeout"
   ```

**Resolution**:
- Scale up Workers: `aws ecs update-service --service arrakis-staging-gp-worker --desired-count 3`
- If sustained, investigate slow database queries
- Consider increasing prefetch limit

### Alarm: DLQ Messages

**Severity**: WARNING

**Impact**: Some events permanently failed. May indicate bug or data issue.

**Investigation**:
1. Access RabbitMQ Management Console:
   - URL in Secrets Manager: `arrakis-staging/rabbitmq` -> `management_url`
   - Credentials: `arrakis` / (password in secret)

2. In console:
   - Navigate to Queues -> arrakis.dlq
   - Click "Get Message(s)" with Ack Mode: Nack message requeue false
   - Examine message payload and headers

3. Check headers for error info:
   - `x-death`: Shows original queue and death reason
   - `x-first-death-reason`: Error message

**Resolution**:
- If bad data: Delete message from DLQ
- If bug: Fix code, replay message via management console
- If transient: Republish to original queue

### Alarm: Ingestor Memory High

**Severity**: WARNING

**Impact**: Potential memory leak. May crash if not addressed.

**Investigation**:
1. Check memory trend:
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/ECS \
     --metric-name MemoryUtilization \
     --dimensions Name=ClusterName,Value=arrakis-staging-cluster Name=ServiceName,Value=arrakis-staging-ingestor \
     --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
     --period 300 \
     --statistics Average
   ```

2. Check if memory is steadily increasing (leak) vs spike (normal)

**Resolution**:
- If leak: Restart service to clear memory, file bug
- If spike: May be normal during high traffic
- If sustained > 85%: Increase task memory allocation

## RabbitMQ Management

### Access Management Console

1. Get console URL from Secrets Manager:
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id arrakis-staging/rabbitmq \
     --query SecretString --output text | jq -r .management_url
   ```

2. Get credentials:
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id arrakis-staging/rabbitmq \
     --query SecretString --output text | jq -r '.username, .password'
   ```

### Purge Queue (Emergency Only)

Only use in emergency when messages are causing cascading failures:

1. Via Management Console:
   - Navigate to Queues -> target queue
   - Click "Purge" button
   - Confirm

2. Via CLI (if console unavailable):
   - Connect to a Worker container
   - Use rabbitmqadmin to purge

### Check Consumer Health

In Management Console:
1. Navigate to Connections
2. Verify Ingestor and Worker connections present
3. Check channel count matches expected workers

## Database Operations

### Check Slow Queries

```sql
-- In PostgreSQL
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
AND state != 'idle'
ORDER BY duration DESC;
```

### Check Connection Pool

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'arrakis';

-- Max connections
SHOW max_connections;
```

## Deployment Operations

### Deploy New Version

1. Build and push image:
   ```bash
   docker build -t arrakis-staging-gp-worker:latest apps/worker/
   aws ecr get-login-password | docker login --username AWS --password-stdin {account}.dkr.ecr.{region}.amazonaws.com
   docker push {account}.dkr.ecr.{region}.amazonaws.com/arrakis-staging-gp-worker:staging
   ```

2. Force deployment:
   ```bash
   aws ecs update-service \
     --cluster arrakis-staging-cluster \
     --service arrakis-staging-gp-worker \
     --force-new-deployment
   ```

3. Monitor rollout:
   ```bash
   aws ecs wait services-stable \
     --cluster arrakis-staging-cluster \
     --services arrakis-staging-gp-worker
   ```

### Rollback

1. Find previous task definition:
   ```bash
   aws ecs list-task-definitions \
     --family-prefix arrakis-staging-gp-worker \
     --sort DESC \
     --max-items 5
   ```

2. Update service to previous version:
   ```bash
   aws ecs update-service \
     --cluster arrakis-staging-cluster \
     --service arrakis-staging-gp-worker \
     --task-definition arrakis-staging-gp-worker:PREVIOUS_REVISION
   ```

## Emergency Procedures

### Complete System Restart

If both Ingestor and Worker are in bad state:

1. Scale down both services:
   ```bash
   aws ecs update-service --cluster arrakis-staging-cluster --service arrakis-staging-ingestor --desired-count 0
   aws ecs update-service --cluster arrakis-staging-cluster --service arrakis-staging-gp-worker --desired-count 0
   ```

2. Wait for tasks to drain (messages buffer in RabbitMQ):
   ```bash
   aws ecs wait services-stable --cluster arrakis-staging-cluster --services arrakis-staging-ingestor arrakis-staging-gp-worker
   ```

3. Scale back up:
   ```bash
   aws ecs update-service --cluster arrakis-staging-cluster --service arrakis-staging-gp-worker --desired-count 1
   aws ecs update-service --cluster arrakis-staging-cluster --service arrakis-staging-ingestor --desired-count 1
   ```

4. Verify queues are draining:
   - Check dashboard for queue depth decreasing
   - Check logs for successful processing

### Disable Gateway Proxy (Fallback to Monolith)

If Gateway Proxy is completely broken and must fail back:

1. Set environment variable in Sietch (monolith):
   ```bash
   # In sietch deployment, set:
   USE_GATEWAY_PROXY=false
   ```

2. Scale down Gateway Proxy services:
   ```bash
   aws ecs update-service --cluster arrakis-staging-cluster --service arrakis-staging-ingestor --desired-count 0
   aws ecs update-service --cluster arrakis-staging-cluster --service arrakis-staging-gp-worker --desired-count 0
   ```

3. Sietch will handle Discord Gateway directly

## Contacts

| Role | Contact | When |
|------|---------|------|
| On-Call Engineer | PagerDuty | CRITICAL alarms |
| Platform Team | #platform-alerts | Infrastructure issues |
| Discord Admin | Discord DM | Bot permission issues |

## Related Documentation

- [Architecture Overview](../architecture/gateway-proxy.md)
- [CloudWatch Dashboard](https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=arrakis-staging-gateway-proxy)
