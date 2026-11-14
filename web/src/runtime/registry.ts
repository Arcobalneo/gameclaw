import { canonicalGameId } from '../../../relay/src/games';
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
  'claw-count': () => import('../games/claw-count'),
  'claw-mask': () => import('../games/claw-mask'),
  'claw-clock': () => import('../games/claw-clock'),
  'claw-flip': () => import('../games/claw-flip'),
  'claw-round': () => import('../games/claw-round'),
  'claw-coil': () => import('../games/claw-coil'),
  'claw-sum': () => import('../games/claw-sum'),
  'claw-berth': () => import('../games/claw-berth'),
  'claw-delve': () => import('../games/claw-delve'),
  'claw-fair': () => import('../games/claw-fair'),
  'claw-reef': () => import('../games/claw-reef'),
  'claw-lamp': () => import('../games/claw-lamp'),
  'claw-raft': () => import('../games/claw-raft'),
  'claw-stow': () => import('../games/claw-stow'),
  'claw-glass': () => import('../games/claw-glass'),
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
