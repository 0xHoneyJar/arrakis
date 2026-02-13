/**
 * Fixture Conformance Tests
 *
 * Validates that all committed JSON fixtures pass Zod schema validation.
 * These fixtures are the neutral source of truth — if a fixture fails
 * validation here, it means the TypeScript schema has drifted from the
 * wire format contract.
 *
 * The Rust gateway has a mirror test that validates its serialization
 * output against the same fixtures (see apps/gateway/src/events/serialize.rs).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GatewayEventSchema } from '../schemas/gateway-event.js';
import { InteractionPayloadSchema } from '../schemas/interaction-payload.js';
import {
  GuildJoinDataSchema,
  GuildLeaveDataSchema,
  MemberJoinDataSchema,
  MemberLeaveDataSchema,
  MemberUpdateDataSchema,
  InteractionCreateDataSchema,
} from '../schemas/event-data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../../fixtures');

function loadFixture(name: string): unknown {
  const raw = readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(raw);
}

describe('Fixture conformance: GatewayEventSchema', () => {
  const fixtures = [
    'guild-join',
    'guild-leave',
    'member-join',
    'member-leave',
    'member-update',
    'interaction-create',
  ];

  for (const name of fixtures) {
    it(`validates ${name}.json against GatewayEventSchema`, () => {
      const data = loadFixture(name);
      const result = GatewayEventSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  }
});

describe('Fixture conformance: event-specific data schemas', () => {
  it('guild-join data validates against GuildJoinDataSchema', () => {
    const fixture = loadFixture('guild-join') as { data: unknown };
    const result = GuildJoinDataSchema.safeParse(fixture.data);
    expect(result.success).toBe(true);
  });

  it('guild-leave data validates against GuildLeaveDataSchema', () => {
    const fixture = loadFixture('guild-leave') as { data: unknown };
    const result = GuildLeaveDataSchema.safeParse(fixture.data);
    expect(result.success).toBe(true);
  });

  it('member-join data validates against MemberJoinDataSchema', () => {
    const fixture = loadFixture('member-join') as { data: unknown };
    const result = MemberJoinDataSchema.safeParse(fixture.data);
    expect(result.success).toBe(true);
  });

  it('member-leave data validates against MemberLeaveDataSchema', () => {
    const fixture = loadFixture('member-leave') as { data: unknown };
    const result = MemberLeaveDataSchema.safeParse(fixture.data);
    expect(result.success).toBe(true);
  });

  it('member-update data validates against MemberUpdateDataSchema', () => {
    const fixture = loadFixture('member-update') as { data: unknown };
    const result = MemberUpdateDataSchema.safeParse(fixture.data);
    expect(result.success).toBe(true);
  });

  it('interaction-create data validates against InteractionCreateDataSchema', () => {
    const fixture = loadFixture('interaction-create') as { data: unknown };
    const result = InteractionCreateDataSchema.safeParse(fixture.data);
    expect(result.success).toBe(true);
  });
});

describe('Fixture conformance: InteractionPayloadSchema', () => {
  it('interaction-create.json validates against InteractionPayloadSchema', () => {
    const data = loadFixture('interaction-create');
    const result = InteractionPayloadSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('BB60-20 regression guard', () => {
  it('interaction fixture uses interaction_token (NOT token)', () => {
    const fixture = loadFixture('interaction-create') as {
      data: Record<string, unknown>;
    };
    expect(fixture.data).toHaveProperty('interaction_token');
    expect(fixture.data).not.toHaveProperty('token');
  });

  it('InteractionCreateDataSchema rejects payload with "token" instead of "interaction_token"', () => {
    const bad = {
      interaction_id: '444444444444444444',
      interaction_type: 'ApplicationCommand',
      token: 'this_field_name_is_wrong',
    };
    const result = InteractionCreateDataSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
