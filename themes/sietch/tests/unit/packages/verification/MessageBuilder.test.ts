/**
 * MessageBuilder Tests
 *
 * Unit tests for signing message construction.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MessageBuilder,
  DEFAULT_TEMPLATE,
} from '../../../../src/packages/verification/MessageBuilder.js';
import type { MessageParams } from '../../../../src/packages/verification/types.js';

describe('MessageBuilder', () => {
  let builder: MessageBuilder;
  let defaultParams: MessageParams;

  beforeEach(() => {
    builder = new MessageBuilder();
    defaultParams = {
      communityName: 'Arrakis Community',
      walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      discordUsername: 'spice_trader#1234',
      nonce: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: new Date('2026-01-14T10:30:00Z'),
    };
  });

  describe('build', () => {
    it('should include community name', () => {
      const message = builder.build(defaultParams);
      expect(message).toContain('Welcome to Arrakis Community!');
    });

    it('should include wallet address', () => {
      const message = builder.build(defaultParams);
      expect(message).toContain('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    });

    it('should include Discord username', () => {
      const message = builder.build(defaultParams);
      expect(message).toContain('spice_trader#1234');
    });

    it('should include nonce', () => {
      const message = builder.build(defaultParams);
      expect(message).toContain('Nonce: 550e8400-e29b-41d4-a716-446655440000');
    });

    it('should include formatted timestamp', () => {
      const message = builder.build(defaultParams);
      expect(message).toContain('Timestamp: 2026-01-14T10:30:00.000Z');
    });

    it('should include transaction disclaimer', () => {
      const message = builder.build(defaultParams);
      expect(message).toContain('does NOT authorize any blockchain transactions');
      expect(message).toContain('transfer of funds');
    });

    it('should replace all placeholders', () => {
      const message = builder.build(defaultParams);
      expect(message).not.toContain('{{');
      expect(message).not.toContain('}}');
    });
  });

  describe('custom template', () => {
    it('should accept custom template in constructor', () => {
      const customTemplate = 'Sign for {{communityName}} with {{nonce}}';
      const customBuilder = new MessageBuilder(customTemplate);
      expect(customBuilder.getTemplate()).toBe(customTemplate);
    });

    it('should build message with custom template', () => {
      const customTemplate =
        '{{communityName}} verification\nWallet: {{walletAddress}}\nNonce: {{nonce}}\nTimestamp: {{timestamp}}\nUser: {{discordUsername}}';
      const customBuilder = new MessageBuilder(customTemplate);
      const message = customBuilder.build(defaultParams);

      expect(message).toContain('Arrakis Community verification');
      expect(message).toContain('Wallet: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    });
  });

  describe('buildCustom', () => {
    it('should build message with arbitrary parameters', () => {
      const template = 'Hello {{name}}, your code is {{code}}';
      const params = { name: 'Alice', code: 'ABC123' };
      const message = builder.buildCustom(template, params);

      expect(message).toBe('Hello Alice, your code is ABC123');
    });

    it('should replace multiple occurrences of same placeholder', () => {
      const template = '{{name}} said: "I am {{name}}"';
      const params = { name: 'Bob' };
      const message = builder.buildCustom(template, params);

      expect(message).toBe('Bob said: "I am Bob"');
    });

    it('should leave unknown placeholders unchanged', () => {
      const template = 'Hello {{name}}, unknown is {{unknown}}';
      const params = { name: 'Charlie' };
      const message = builder.buildCustom(template, params);

      expect(message).toBe('Hello Charlie, unknown is {{unknown}}');
    });
  });

  describe('validateTemplate', () => {
    it('should return empty array for valid template', () => {
      const missing = builder.validateTemplate(DEFAULT_TEMPLATE);
      expect(missing).toEqual([]);
    });

    it('should detect missing placeholders', () => {
      const partialTemplate = 'Welcome to {{communityName}}! Nonce: {{nonce}}';
      const missing = builder.validateTemplate(partialTemplate);

      expect(missing).toContain('walletAddress');
      expect(missing).toContain('discordUsername');
      expect(missing).toContain('timestamp');
      expect(missing).not.toContain('communityName');
      expect(missing).not.toContain('nonce');
    });

    it('should report all missing for empty template', () => {
      const missing = builder.validateTemplate('');
      expect(missing).toHaveLength(5);
      expect(missing).toContain('communityName');
      expect(missing).toContain('walletAddress');
      expect(missing).toContain('discordUsername');
      expect(missing).toContain('nonce');
      expect(missing).toContain('timestamp');
    });
  });

  describe('extractNonce', () => {
    it('should extract nonce from formatted message', () => {
      const message = builder.build(defaultParams);
      const nonce = builder.extractNonce(message);
      expect(nonce).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should return undefined if no nonce found', () => {
      const message = 'This message has no nonce';
      const nonce = builder.extractNonce(message);
      expect(nonce).toBeUndefined();
    });

    it('should handle nonce at end of message', () => {
      const message = 'Some text\nNonce: abc-123';
      const nonce = builder.extractNonce(message);
      expect(nonce).toBe('abc-123');
    });
  });

  describe('extractWalletAddress', () => {
    it('should extract wallet address from formatted message', () => {
      const message = builder.build(defaultParams);
      const address = builder.extractWalletAddress(message);
      expect(address).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    });

    it('should return undefined if no address found', () => {
      const message = 'This message has no wallet address';
      const address = builder.extractWalletAddress(message);
      expect(address).toBeUndefined();
    });

    it('should extract lowercase address', () => {
      const params = { ...defaultParams, walletAddress: '0xabcdef0123456789abcdef0123456789abcdef01' };
      const message = builder.build(params);
      const address = builder.extractWalletAddress(message);
      expect(address?.toLowerCase()).toBe('0xabcdef0123456789abcdef0123456789abcdef01');
    });
  });

  describe('sanitization', () => {
    it('should remove control characters', () => {
      const params = {
        ...defaultParams,
        communityName: 'Test\x00Community\x1F',
      };
      const message = builder.build(params);
      expect(message).toContain('Welcome to TestCommunity!');
      expect(message).not.toContain('\x00');
      expect(message).not.toContain('\x1F');
    });

    it('should preserve newlines in template', () => {
      const message = builder.build(defaultParams);
      expect(message).toContain('\n');
    });

    it('should trim whitespace from parameters', () => {
      const params = {
        ...defaultParams,
        communityName: '  Arrakis Community  ',
      };
      const message = builder.build(params);
      expect(message).toContain('Welcome to Arrakis Community!');
      expect(message).not.toContain('Welcome to   Arrakis');
    });

    it('should handle empty parameters', () => {
      const params = {
        ...defaultParams,
        communityName: '',
      };
      const message = builder.build(params);
      expect(message).toContain('Welcome to !');
    });

    it('should handle special characters in community name', () => {
      const params = {
        ...defaultParams,
        communityName: "Arrakis's & Friends <3",
      };
      const message = builder.build(params);
      expect(message).toContain("Welcome to Arrakis's & Friends <3!");
    });
  });

  describe('getTemplate', () => {
    it('should return default template', () => {
      expect(builder.getTemplate()).toBe(DEFAULT_TEMPLATE);
    });

    it('should return custom template when set', () => {
      const custom = 'Custom template';
      const customBuilder = new MessageBuilder(custom);
      expect(customBuilder.getTemplate()).toBe(custom);
    });
  });

  describe('DEFAULT_TEMPLATE export', () => {
    it('should be importable', () => {
      expect(DEFAULT_TEMPLATE).toBeDefined();
      expect(typeof DEFAULT_TEMPLATE).toBe('string');
    });

    it('should contain all required placeholders', () => {
      expect(DEFAULT_TEMPLATE).toContain('{{communityName}}');
      expect(DEFAULT_TEMPLATE).toContain('{{walletAddress}}');
      expect(DEFAULT_TEMPLATE).toContain('{{discordUsername}}');
      expect(DEFAULT_TEMPLATE).toContain('{{nonce}}');
      expect(DEFAULT_TEMPLATE).toContain('{{timestamp}}');
    });
  });
});
