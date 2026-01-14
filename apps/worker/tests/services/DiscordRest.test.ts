import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordRestService } from '../../src/services/DiscordRest.js';
import type { Logger } from 'pino';

// Mock @discordjs/rest
const mockRestPost = vi.fn();
const mockRestPatch = vi.fn();
const mockRestPut = vi.fn();
const mockRestDelete = vi.fn();
const mockRestGet = vi.fn();
const mockSetToken = vi.fn();

vi.mock('@discordjs/rest', () => ({
  REST: vi.fn().mockImplementation(() => ({
    post: mockRestPost,
    patch: mockRestPatch,
    put: mockRestPut,
    delete: mockRestDelete,
    get: mockRestGet,
    setToken: mockSetToken,
  })),
}));

// Mock discord-api-types
vi.mock('discord-api-types/v10', () => ({
  Routes: {
    interactionCallback: (id: string, token: string) => `/interactions/${id}/${token}/callback`,
    webhook: (appId: string, token: string) => `/webhooks/${appId}/${token}`,
    webhookMessage: (appId: string, token: string, messageId: string) =>
      `/webhooks/${appId}/${token}/messages/${messageId}`,
    guildMemberRole: (guildId: string, userId: string, roleId: string) =>
      `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    userChannels: () => '/users/@me/channels',
    channelMessages: (channelId: string) => `/channels/${channelId}/messages`,
    guildMember: (guildId: string, userId: string) => `/guilds/${guildId}/members/${userId}`,
  },
  InteractionResponseType: {
    DeferredChannelMessageWithSource: 5,
  },
  MessageFlags: {
    Ephemeral: 64,
  },
}));

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as Logger;

describe('DiscordRestService', () => {
  let discordRest: DiscordRestService;
  const applicationId = '123456789';

  beforeEach(() => {
    vi.clearAllMocks();
    discordRest = new DiscordRestService(applicationId, mockLogger);
  });

  describe('deferReply', () => {
    it('should send deferred response without auth', async () => {
      mockRestPost.mockResolvedValue(undefined);

      const result = await discordRest.deferReply('interaction-id', 'interaction-token');

      expect(result).toEqual({ success: true });
      expect(mockRestPost).toHaveBeenCalledWith(
        '/interactions/interaction-id/interaction-token/callback',
        {
          body: {
            type: 5,
            data: undefined,
          },
          auth: false,
        }
      );
    });

    it('should send ephemeral deferred response', async () => {
      mockRestPost.mockResolvedValue(undefined);

      const result = await discordRest.deferReply('interaction-id', 'interaction-token', true);

      expect(result).toEqual({ success: true });
      expect(mockRestPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: {
            type: 5,
            data: { flags: 64 },
          },
          auth: false,
        })
      );
    });

    it('should return error on failure', async () => {
      mockRestPost.mockRejectedValue(new Error('Token expired'));

      const result = await discordRest.deferReply('interaction-id', 'interaction-token');

      expect(result).toEqual({ success: false, error: 'Token expired' });
    });
  });

  describe('sendFollowup', () => {
    it('should send followup message', async () => {
      mockRestPost.mockResolvedValue({ id: 'message-123' });

      const result = await discordRest.sendFollowup('interaction-token', {
        content: 'Hello world',
      });

      expect(result).toEqual({ success: true, messageId: 'message-123' });
      expect(mockRestPost).toHaveBeenCalledWith(
        `/webhooks/${applicationId}/interaction-token`,
        expect.objectContaining({
          body: expect.objectContaining({
            content: 'Hello world',
          }),
          auth: false,
        })
      );
    });

    it('should support embeds and components', async () => {
      mockRestPost.mockResolvedValue({ id: 'message-456' });

      const embeds = [{ title: 'Test Embed' }];
      const components = [{ type: 1, components: [] }];

      const result = await discordRest.sendFollowup('interaction-token', {
        embeds,
        components,
        flags: 64,
      });

      expect(result).toEqual({ success: true, messageId: 'message-456' });
      expect(mockRestPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.objectContaining({
            embeds,
            components,
            flags: 64,
          }),
        })
      );
    });

    it('should return error on failure', async () => {
      mockRestPost.mockRejectedValue(new Error('Rate limited'));

      const result = await discordRest.sendFollowup('interaction-token', {
        content: 'Hello',
      });

      expect(result).toEqual({ success: false, error: 'Rate limited' });
    });
  });

  describe('editOriginal', () => {
    it('should edit the original message', async () => {
      mockRestPatch.mockResolvedValue({ id: 'message-123' });

      const result = await discordRest.editOriginal('interaction-token', {
        content: 'Updated content',
      });

      expect(result).toEqual({ success: true, messageId: 'message-123' });
      expect(mockRestPatch).toHaveBeenCalledWith(
        `/webhooks/${applicationId}/interaction-token/messages/@original`,
        expect.objectContaining({
          body: expect.objectContaining({
            content: 'Updated content',
          }),
          auth: false,
        })
      );
    });

    it('should return error on failure', async () => {
      mockRestPatch.mockRejectedValue(new Error('Not found'));

      const result = await discordRest.editOriginal('interaction-token', {
        content: 'Updated',
      });

      expect(result).toEqual({ success: false, error: 'Not found' });
    });
  });

  describe('setToken', () => {
    it('should set bot token for authenticated operations', () => {
      discordRest.setToken('bot-token-123');

      expect(mockSetToken).toHaveBeenCalledWith('bot-token-123');
    });
  });

  describe('assignRole', () => {
    it('should assign role to member', async () => {
      mockRestPut.mockResolvedValue(undefined);

      const result = await discordRest.assignRole('guild-id', 'user-id', 'role-id');

      expect(result).toEqual({ success: true });
      expect(mockRestPut).toHaveBeenCalledWith(
        '/guilds/guild-id/members/user-id/roles/role-id',
        { auth: true }
      );
    });

    it('should return error on failure', async () => {
      mockRestPut.mockRejectedValue(new Error('Missing permissions'));

      const result = await discordRest.assignRole('guild-id', 'user-id', 'role-id');

      expect(result).toEqual({ success: false, error: 'Missing permissions' });
    });
  });

  describe('removeRole', () => {
    it('should remove role from member', async () => {
      mockRestDelete.mockResolvedValue(undefined);

      const result = await discordRest.removeRole('guild-id', 'user-id', 'role-id');

      expect(result).toEqual({ success: true });
      expect(mockRestDelete).toHaveBeenCalledWith(
        '/guilds/guild-id/members/user-id/roles/role-id',
        { auth: true }
      );
    });

    it('should return error on failure', async () => {
      mockRestDelete.mockRejectedValue(new Error('Role not found'));

      const result = await discordRest.removeRole('guild-id', 'user-id', 'role-id');

      expect(result).toEqual({ success: false, error: 'Role not found' });
    });
  });

  describe('sendDM', () => {
    it('should create DM channel and send message', async () => {
      mockRestPost
        .mockResolvedValueOnce({ id: 'channel-123' }) // Create DM channel
        .mockResolvedValueOnce({ id: 'message-456' }); // Send message

      const result = await discordRest.sendDM('user-id', {
        content: 'Private message',
      });

      expect(result).toEqual({ success: true, messageId: 'message-456' });
      expect(mockRestPost).toHaveBeenCalledTimes(2);
      expect(mockRestPost).toHaveBeenNthCalledWith(1, '/users/@me/channels', {
        body: { recipient_id: 'user-id' },
        auth: true,
      });
      expect(mockRestPost).toHaveBeenNthCalledWith(2, '/channels/channel-123/messages', {
        body: { content: 'Private message', embeds: undefined, components: undefined },
        auth: true,
      });
    });

    it('should return error if DM channel creation fails', async () => {
      mockRestPost.mockRejectedValue(new Error('Cannot DM user'));

      const result = await discordRest.sendDM('user-id', {
        content: 'Hello',
      });

      expect(result).toEqual({ success: false, error: 'Cannot DM user' });
    });
  });

  describe('getGuildMember', () => {
    it('should return member info', async () => {
      mockRestGet.mockResolvedValue({
        nick: 'TestNick',
        roles: ['role-1', 'role-2'],
      });

      const result = await discordRest.getGuildMember('guild-id', 'user-id');

      expect(result).toEqual({
        nickname: 'TestNick',
        roles: ['role-1', 'role-2'],
      });
      expect(mockRestGet).toHaveBeenCalledWith('/guilds/guild-id/members/user-id', { auth: true });
    });

    it('should return null on error', async () => {
      mockRestGet.mockRejectedValue(new Error('Member not found'));

      const result = await discordRest.getGuildMember('guild-id', 'user-id');

      expect(result).toBeNull();
    });

    it('should handle member without nickname', async () => {
      mockRestGet.mockResolvedValue({
        roles: ['role-1'],
      });

      const result = await discordRest.getGuildMember('guild-id', 'user-id');

      expect(result).toEqual({
        nickname: undefined,
        roles: ['role-1'],
      });
    });
  });
});
