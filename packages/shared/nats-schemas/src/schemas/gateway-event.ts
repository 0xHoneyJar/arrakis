/**
 * GatewayEvent schema — mirrors Rust GatewayEvent struct in serialize.rs
 *
 * The committed JSON fixtures in fixtures/ are the neutral source of truth.
 * Both this Zod schema and the Rust serialization tests validate against them.
 */

import { z } from 'zod';

/**
 * Base gateway event envelope.
 * Every message on the NATS wire matches this shape.
 *
 * Field-level contract (maps 1:1 to Rust GatewayEvent):
 *   event_id       — UUIDv4 string
 *   event_type     — dot-separated event classifier (e.g. "guild.join")
 *   shard_id       — Discord shard that produced the event
 *   timestamp      — Unix epoch milliseconds (u64 in Rust → number in JS)
 *   guild_id       — nullable Discord snowflake
 *   channel_id     — nullable Discord snowflake
 *   user_id        — nullable Discord snowflake
 *   data           — event-specific payload (opaque at this level)
 */
export const GatewayEventSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.string().min(1),
  shard_id: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative(),
  guild_id: z.string().nullable(),
  channel_id: z.string().nullable(),
  user_id: z.string().nullable(),
  data: z.unknown(),
});

/** Inferred TypeScript type from the Zod schema */
export type GatewayEvent = z.infer<typeof GatewayEventSchema>;

/**
 * Backward-compatible alias.
 * EventNatsConsumer.ts previously defined its own GatewayEventPayload interface;
 * this alias lets consumers migrate without renaming all references.
 */
export type GatewayEventPayload = GatewayEvent;
