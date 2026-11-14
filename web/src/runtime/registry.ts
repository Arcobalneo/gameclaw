import type { AnyGameModule } from '../gfx/scene';

/**
 * One dynamic import per game so each engine + renderer is its own chunk and
 * only downloads when that game is opened.
 */
const loaders: Record<string, () => Promise<{ default: AnyGameModule }>> = {
  'shrimp-trek': () => import('../games/shrimp-trek'),
  'shrimp-guard': () => import('../games/shrimp-guard'),
  'shrimp-heist': () => import('../games/shrimp-heist'),
  'shrimp-catch': () => import('../games/shrimp-catch'),
  'shrimp-look': () => import('../games/shrimp-look'),
  'shrimp-rampage': () => import('../games/shrimp-rampage'),
  'shrimp-ink': () => import('../games/shrimp-ink'),
  'shrimp-greens': () => import('../games/shrimp-greens'),
  'shrimp-conquest': () => import('../games/shrimp-conquest'),
  'shrimp-leap': () => import('../games/shrimp-leap'),
  'shrimp-burger': () => import('../games/shrimp-burger'),
  'claw-stamp': () => import('../games/claw-stamp'),
  'claw-melt': () => import('../games/claw-melt'),
  'claw-net': () => import('../games/claw-net'),
  'claw-beat': () => import('../games/claw-beat'),
};

const loaded = new Map<string, Promise<AnyGameModule>>();

export function hasGame(id: string): boolean {
  return id in loaders;
}

export function loadGame(id: string): Promise<AnyGameModule> {
  const loader = loaders[id];
  if (!loader) return Promise.reject(new Error(`Unknown game: ${id}`));
  let p = loaded.get(id);
  if (!p) {
    p = loader().then((m) => m.default);
    p.catch(() => loaded.delete(id));
    loaded.set(id, p);
  }
  return p;
}

export const GAME_IDS = Object.keys(loaders);
