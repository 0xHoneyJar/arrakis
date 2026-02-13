/**
 * @arrakis/nats-schemas
 *
 * Shared NATS wire format schemas between Rust gateway and TypeScript workers.
 * The committed JSON fixtures in fixtures/ are the neutral source of truth;
 * both Rust serialization tests and these Zod schemas validate against them.
 */

export { GatewayEventSchema, type GatewayEvent, type GatewayEventPayload } from './schemas/gateway-event.js';
export { InteractionPayloadSchema, type InteractionPayload } from './schemas/interaction-payload.js';
export {
  GuildJoinDataSchema,
  GuildLeaveDataSchema,
  MemberJoinDataSchema,
  MemberLeaveDataSchema,
  MemberUpdateDataSchema,
  InteractionCreateDataSchema,
  type GuildJoinData,
  type GuildLeaveData,
  type MemberJoinData,
  type MemberLeaveData,
  type MemberUpdateData,
  type InteractionCreateData,
} from './schemas/event-data.js';
export { NATS_ROUTING, type NatsRouting } from './routing.js';
