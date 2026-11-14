/**
 * GameClaw runtime library.
 *
 * Browser-safe: no `node:` imports. Games implement `GameDefinition` and are
 * bundled by the web portal. The portal and the relay own sessions, MCP, and
 * persistence. A game must not parse argv, exit the process, or open sockets.
 */
export * from './errors';
export * from './memory-session';
export * from './player-name';
export * from './rng';
export * from './text';
export * from './types';
