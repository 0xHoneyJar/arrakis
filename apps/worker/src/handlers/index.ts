/**
 * Handler registry - maps event types to handler functions
 * Handlers will be implemented in Sprint 4
 */

import type { DiscordEventPayload, ConsumeResult } from '../types.js';
import type { Logger } from 'pino';

export type HandlerFn = (
  payload: DiscordEventPayload,
  logger: Logger
) => Promise<ConsumeResult>;

/**
 * Command handler registry
 * Key: command name (e.g., "check-eligibility")
 * Value: handler function
 */
export const commandHandlers: Map<string, HandlerFn> = new Map();

/**
 * Event handler registry
 * Key: event type (e.g., "member.join")
 * Value: handler function
 */
export const eventHandlers: Map<string, HandlerFn> = new Map();

/**
 * Register a command handler
 */
export function registerCommandHandler(command: string, handler: HandlerFn): void {
  commandHandlers.set(command, handler);
}

/**
 * Register an event handler
 */
export function registerEventHandler(eventType: string, handler: HandlerFn): void {
  eventHandlers.set(eventType, handler);
}

/**
 * Get handler for a command
 */
export function getCommandHandler(command: string): HandlerFn | undefined {
  return commandHandlers.get(command);
}

/**
 * Get handler for an event type
 */
export function getEventHandler(eventType: string): HandlerFn | undefined {
  return eventHandlers.get(eventType);
}

/**
 * Default handler for unregistered commands
 * Returns 'ack' to prevent blocking the queue
 */
export const defaultCommandHandler: HandlerFn = async (payload, logger) => {
  logger.warn(
    { eventType: payload.eventType, eventId: payload.eventId },
    'No handler registered for command, acknowledging to prevent queue buildup'
  );
  return 'ack';
};

/**
 * Default handler for unregistered events
 */
export const defaultEventHandler: HandlerFn = async (payload, logger) => {
  logger.debug(
    { eventType: payload.eventType, eventId: payload.eventId },
    'No handler registered for event type'
  );
  return 'ack';
};
