/**
 * InteractionPayload schema — typed specialization of GatewayEvent
 * for event_type = "interaction.create".
 *
 * This is what CommandNatsConsumer receives on the NATS wire.
 * The `data` field is narrowed from unknown to InteractionCreateData,
 * plus optional command routing fields that the worker may inject.
 */

import { z } from 'zod';
import { InteractionCreateDataSchema } from './event-data.js';

/**
 * Extended interaction data with optional command routing fields.
 * The base 3 fields come from Rust; command_name/subcommand/options
 * may be populated by a middleware layer or enrichment step.
 */
const InteractionDataSchema = InteractionCreateDataSchema.extend({
  command_name: z.string().optional(),
  subcommand: z.string().optional(),
  options: z.record(z.unknown()).optional(),
});

/**
 * Full interaction payload as received by CommandNatsConsumer.
 * Mirrors GatewayEvent but with typed `data`.
 */
export const InteractionPayloadSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.literal('interaction.create'),
  shard_id: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative(),
  guild_id: z.string().nullable(),
  channel_id: z.string().nullable(),
  user_id: z.string().nullable(),
  data: InteractionDataSchema,
});

export type InteractionPayload = z.infer<typeof InteractionPayloadSchema>;
