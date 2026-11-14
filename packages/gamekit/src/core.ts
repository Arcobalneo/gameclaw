/**
 * Browser-safe subset of gamekit.
 *
 * Everything exported here is free of `node:*` imports so a game's state
 * machine (`games/<id>/src/definition.ts`) can be bundled for the web portal.
 * The CLI keeps using the full `@gameclaw/gamekit` entry point.
 */
export * from './errors';
export * from './memory-session';
export * from './rng';
export * from './text';
export * from './types';
