/**
 * NATS routing constants loaded from the language-neutral nats-routing.json.
 *
 * TypeScript imports this directly; Rust validates its hardcoded constants
 * against the same JSON file in a CI-enforced test.
 */

import routingData from '../nats-routing.json' with { type: 'json' };

/** Stream configuration */
export interface StreamConfig {
  name: string;
  subjects: string[];
  description: string;
}

/** Subject namespace */
export interface SubjectNamespace {
  prefix: string;
  [key: string]: string;
}

/** Full routing configuration type */
export interface NatsRouting {
  streams: Record<string, StreamConfig>;
  subjects: Record<string, SubjectNamespace>;
  event_type_to_subject: Record<string, string>;
}

/**
 * The routing constants — single source of truth for stream names,
 * subject prefixes, and event-type-to-subject mapping.
 */
export const NATS_ROUTING: NatsRouting = routingData as NatsRouting;
