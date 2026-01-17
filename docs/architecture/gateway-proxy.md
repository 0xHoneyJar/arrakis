# Gateway Proxy Pattern Architecture

## Overview

The Gateway Proxy pattern decouples Discord Gateway connection management from business logic processing through an event-driven architecture using RabbitMQ as the message broker.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Gateway Proxy Pattern                               │
│                                                                              │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐        │
│  │ Discord  │      │ Ingestor │      │ RabbitMQ │      │  Worker  │        │
│  │ Gateway  │─WSS──│ ("Ear")  │─AMQP─│  Broker  │─AMQP─│ ("Hand") │        │
│  └──────────┘      └──────────┘      └──────────┘      └──────────┘        │
│       │                                                      │              │
│       │                                                      │              │
│       └──────────────────────────────────────────────────────┘              │
│                         Discord REST API (responses)                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Ingestor ("The Ear")

**Purpose**: Lightweight Discord Gateway listener with zero business logic

**Responsibilities**:
- Maintain WebSocket connection to Discord Gateway
- Receive and serialize Discord events
- Publish events to RabbitMQ with appropriate routing
- Health monitoring and graceful shutdown

**Key Characteristics**:
- Zero caching of Discord entities (no members, channels, guilds)
- Memory footprint < 50MB
- Stateless (can restart without data loss)
- Single responsibility: listen and forward

**Location**: `apps/ingestor/`

### 2. RabbitMQ Broker

**Purpose**: Durable message queue for event buffering and routing

**Queue Topology**:
```
Exchange: arrakis.events (topic)
├── Queue: arrakis.interactions (priority queue, max-priority: 10)
│   └── Binding: interaction.#
├── Queue: arrakis.events.guild (normal queue)
│   └── Binding: event.#
└── Queue: arrakis.dlq (dead-letter queue, TTL: 7 days)
```

**Key Features**:
- Message persistence ensures no event loss during restarts
- Priority queue for interactions (user-facing commands)
- Dead-letter queue for failed message handling
- Publisher confirms for guaranteed delivery

**Infrastructure**: Amazon MQ (managed RabbitMQ)

### 3. Worker ("The Hand")

**Purpose**: Stateless queue consumer that processes events and responds via Discord REST API

**Responsibilities**:
- Consume messages from RabbitMQ queues
- Execute business logic (database queries, calculations)
- Respond to Discord via REST API
- Manage session state in Redis
- Handle errors and dead-lettering

**Key Characteristics**:
- Horizontally scalable (multiple instances)
- Stateless (state in Redis/PostgreSQL)
- Factory pattern for dependency injection
- Prefetch limits for back-pressure

**Location**: `apps/worker/`

## Data Flow

### Slash Command Flow

```
1. User types /profile in Discord
2. Discord Gateway sends INTERACTION_CREATE event
3. Ingestor receives event via WebSocket
4. Ingestor publishes to arrakis.interactions queue (priority: 8)
5. Worker consumes message
6. Worker calls discord.deferReply() via REST
7. Worker queries PostgreSQL for profile data
8. Worker calls discord.editOriginal() with embed
9. Worker acks message
```

### Member Event Flow

```
1. User joins Discord server
2. Discord Gateway sends GUILD_MEMBER_ADD event
3. Ingestor receives event via WebSocket
4. Ingestor publishes to arrakis.events.guild queue
5. Worker consumes message
6. Worker checks eligibility in database
7. Worker assigns roles via REST API
8. Worker acks message
```

## Message Schema

### DiscordEventPayload

```typescript
interface DiscordEventPayload {
  // Routing
  eventId: string;           // Unique event ID for idempotency
  eventType: 'interaction' | 'member_join' | 'member_leave' | 'member_update';
  timestamp: number;         // Unix timestamp ms

  // Context
  guildId?: string;
  userId?: string;
  channelId?: string;

  // Interaction-specific
  interactionId?: string;
  interactionToken?: string;
  commandName?: string;
  commandOptions?: Record<string, unknown>;
  componentType?: number;
  customId?: string;

  // Member-specific
  member?: {
    roles: string[];
    joinedAt: string;
    nick?: string;
  };
}
```

## Priority Levels

| Event Type | Priority | Queue | Rationale |
|------------|----------|-------|-----------|
| Slash Command | 8 | interactions | User waiting for response |
| Button Click | 8 | interactions | User waiting for response |
| Autocomplete | 9 | interactions | Highest - blocking user typing |
| Member Join | 5 | events.guild | Important but not urgent |
| Member Leave | 3 | events.guild | Cleanup, lower priority |
| Member Update | 4 | events.guild | Role changes |

## Error Handling

### Retryable Errors
- Database connection timeout → Requeue with delay
- Discord rate limit → Requeue with exponential backoff
- Redis connection error → Requeue

### Non-Retryable Errors
- Invalid payload → Dead-letter queue
- Unknown command → Dead-letter queue
- Authorization failure → Dead-letter queue

### Dead Letter Queue Processing
- Messages remain in DLQ for 7 days
- CloudWatch alarm fires on any DLQ message
- Manual investigation required
- Replay capability via RabbitMQ management console

## State Management

### Redis Usage
- **Sessions**: Interactive command state (directory pagination, alert settings)
- **Cooldowns**: Rate limiting for expensive operations
- **Cache**: Short-lived query results (TTL: 60s)

### PostgreSQL Usage
- **Profiles**: User data, badges, tier information
- **Communities**: Multi-tenant configuration
- **Notifications**: Alert preferences

## Scaling

### Horizontal Scaling

```
                    ┌─────────────┐
                    │  Ingestor   │  (1 per shard)
                    │   Shard 0   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  RabbitMQ   │  (single cluster)
                    │   Broker    │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
   │   Worker    │  │   Worker    │  │   Worker    │
   │  Instance 1 │  │  Instance 2 │  │  Instance 3 │
   └─────────────┘  └─────────────┘  └─────────────┘
```

### Scaling Triggers

| Metric | Threshold | Action |
|--------|-----------|--------|
| Queue depth > 100 | 2 min sustained | Add Worker |
| Worker CPU > 70% | 5 min sustained | Add Worker |
| Worker memory > 80% | Immediate | Investigate leak |
| Ingestor memory > 50MB | Immediate | Investigate cache |

## Monitoring

### CloudWatch Dashboard

The Gateway Proxy dashboard (`arrakis-{env}-gateway-proxy`) shows:

**Row 1: Service Health**
- Ingestor CPU/Memory
- RabbitMQ Queue Depth
- Worker CPU/Memory

**Row 2: Broker Metrics**
- Message Throughput (publish/ack rates)
- Broker Health (CPU, memory, disk)
- Connection Count

**Row 3: Task Status**
- Running vs Desired Tasks
- Redis Session State

**Row 4: Latency & Errors**
- Processing Latency (p99)
- Error Rates

### Key Alarms

| Alarm | Threshold | Severity |
|-------|-----------|----------|
| No Ingestor tasks | < 1 | CRITICAL |
| No Worker tasks | < 1 | CRITICAL |
| DLQ messages | > 0 | WARNING |
| Queue depth | > 100 | WARNING |
| Memory > 85% | Any service | WARNING |

## Deployment

### Prerequisites
- Amazon MQ broker deployed
- ECR repositories created
- Secrets in AWS Secrets Manager

### Deployment Order
1. RabbitMQ topology (queues, exchanges)
2. Ingestor service
3. Worker service

### Rollback Procedure
1. Scale Worker to 0
2. Scale Ingestor to 0
3. Messages buffer in RabbitMQ
4. Deploy previous version
5. Scale services back up
6. Messages process automatically

## Security

### Network Isolation
- Ingestor: No ingress, egress only to Discord + RabbitMQ
- Worker: No ingress, egress to RabbitMQ + Redis + PostgreSQL + Discord REST
- RabbitMQ: Ingress only from Ingestor/Worker security groups

### Secrets Management
- Discord bot token: AWS Secrets Manager
- RabbitMQ credentials: AWS Secrets Manager
- Database URL: AWS Secrets Manager

### Authorization
- Admin commands validated via Discord permissions
- Tenant isolation via community_id in all queries

## Related Documentation

- [Operations Runbook](../runbook/gateway-proxy-ops.md)
- [Sprint Plan](../../grimoires/loa/sprint-gateway-proxy.md)
- [SDD](../../grimoires/loa/sdd-gateway-proxy.md)
