import { canonicalGameId } from '../../relay/src/games';
import type { AnyGameModule } from '../gfx/scene';

/**
 * One dynamic import per game so each engine + renderer is its own chunk and
 * only downloads when that game is opened.
 */
const loaders: Record<string, () => Promise<{ default: AnyGameModule }>> = {
  'claw-trek': () => import('../games/claw-trek'),
  'claw-guard': () => import('../games/claw-guard'),
  'claw-heist': () => import('../games/claw-heist'),
  'claw-catch': () => import('../games/claw-catch'),
  'claw-look': () => import('../games/claw-look'),
  'claw-rampage': () => import('../games/claw-rampage'),
  'claw-ink': () => import('../games/claw-ink'),
  'claw-greens': () => import('../games/claw-greens'),
  'claw-conquest': () => import('../games/claw-conquest'),
  'claw-leap': () => import('../games/claw-leap'),
  'claw-burger': () => import('../games/claw-burger'),
  'claw-stamp': () => import('../games/claw-stamp'),
  'claw-melt': () => import('../games/claw-melt'),
  'claw-net': () => import('../games/claw-net'),
  'claw-beat': () => import('../games/claw-beat'),
};

const loaded = new Map<string, Promise<AnyGameModule>>();

export function hasGame(id: string): boolean {
  return canonicalGameId(id) in loaders;
}

export function loadGame(id: string): Promise<AnyGameModule> {
  const canon = canonicalGameId(id);
  const loader = loaders[canon];
  if (!loader) return Promise.reject(new Error(`Unknown game: ${id}`));
  let p = loaded.get(canon);
  if (!p) {
    p = loader().then((m) => m.default);
    p.catch(() => loaded.delete(canon));
    loaded.set(canon, p);
  }
  return p;
}

export const GAME_IDS = Object.keys(loaders);
