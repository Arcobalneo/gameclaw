import os from 'node:os';
import path from 'node:path';

export interface GamePaths {
  root: string;
  gameDir: string;
  savesDir: string;
  journalsDir: string;
  reportsDir: string;
  observerDir: string;
}

export const DEFAULT_HOME_DIRNAME = '.gameclaw';

/** Resolve the state root: explicit flag > GAMECLAW_HOME > ~/.gameclaw. */
export function resolveRoot(explicit?: string, env: NodeJS.ProcessEnv = process.env): string {
  const candidate = explicit ?? env.GAMECLAW_HOME ?? path.join(os.homedir(), DEFAULT_HOME_DIRNAME);
  return path.resolve(candidate);
}

export function gamePaths(root: string, gameId: string): GamePaths {
  const gameDir = path.join(root, gameId);
  return {
    root,
    gameDir,
    savesDir: path.join(gameDir, 'saves'),
    journalsDir: path.join(gameDir, 'journals'),
    reportsDir: path.join(gameDir, 'reports'),
    observerDir: path.join(gameDir, 'observer'),
  };
}

export function slotFilePath(paths: GamePaths, slot: number): string {
  return path.join(paths.savesDir, `slot-${slot}.json`);
}

export function lastSlotFilePath(paths: GamePaths): string {
  return path.join(paths.gameDir, 'last-slot');
}

export function observerFilePath(paths: GamePaths): string {
  return path.join(paths.observerDir, 'daemon.json');
}
