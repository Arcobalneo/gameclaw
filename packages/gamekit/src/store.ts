import fs from 'node:fs';
import path from 'node:path';

import { GameError } from './errors';
import type { GamePaths } from './paths';
import { lastSlotFilePath, slotFilePath } from './paths';
import type { Outcome, SaveFile, SaveSummary } from './types';

const SCHEMA = 1 as const;

export function ensureDirs(paths: GamePaths): void {
  for (const dir of [
    paths.gameDir,
    paths.savesDir,
    paths.journalsDir,
    paths.reportsDir,
    paths.observerDir,
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function atomicWrite(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, file);
}

export function saveExists(paths: GamePaths, slot: number): boolean {
  return fs.existsSync(slotFilePath(paths, slot));
}

export function readSave<S>(paths: GamePaths, slot: number): SaveFile<S> {
  const file = slotFilePath(paths, slot);
  if (!fs.existsSync(file)) {
    throw new GameError(
      'NO_SAVE',
      `No save in slot ${slot} for this game.`,
      `Start a run first: new --slot ${slot}`,
    );
  }
  let parsed: SaveFile<S>;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as SaveFile<S>;
  } catch {
    throw new GameError(
      'STATE_CORRUPT',
      `Save file is not valid JSON: ${file}`,
      `Delete the file or start a fresh run with: new --slot ${slot} --force`,
    );
  }
  if (parsed.schema !== SCHEMA) {
    throw new GameError(
      'STATE_CORRUPT',
      `Unsupported save schema ${String(parsed.schema)} (expected ${SCHEMA}).`,
      'Start a fresh run with: new --force',
    );
  }
  return parsed;
}

export function writeSave<S>(paths: GamePaths, save: SaveFile<S>): void {
  ensureDirs(paths);
  save.updatedAt = new Date().toISOString();
  atomicWrite(slotFilePath(paths, save.slot), `${JSON.stringify(save, null, 2)}\n`);
  atomicWrite(lastSlotFilePath(paths), String(save.slot));
}

export function writeLastSlot(paths: GamePaths, slot: number): void {
  ensureDirs(paths);
  atomicWrite(lastSlotFilePath(paths), String(slot));
}

export function readLastSlot(paths: GamePaths): number | undefined {
  try {
    const raw = fs.readFileSync(lastSlotFilePath(paths), 'utf8').trim();
    const slot = Number(raw);
    return Number.isInteger(slot) ? slot : undefined;
  } catch {
    return undefined;
  }
}

export function listSlots(paths: GamePaths): number[] {
  if (!fs.existsSync(paths.savesDir)) return [];
  return fs
    .readdirSync(paths.savesDir)
    .map((name) => /^slot-(\d+)\.json$/.exec(name)?.[1])
    .filter((value): value is string => value !== undefined)
    .map((value) => Number(value))
    .sort((a, b) => a - b);
}

export function summarizeSaves<S>(
  paths: GamePaths,
  describe: (state: S) => { turn: number; outcome: Outcome; headline: string },
): SaveSummary[] {
  return listSlots(paths).map((slot) => {
    try {
      const save = readSave<S>(paths, slot);
      const view = describe(save.state);
      return {
        slot,
        exists: true,
        game: save.game,
        turn: view.turn,
        outcome: view.outcome,
        headline: view.headline,
        updatedAt: save.updatedAt,
      };
    } catch {
      return { slot, exists: true, game: undefined };
    }
  });
}

export function removeSave(paths: GamePaths, slot: number): void {
  const file = slotFilePath(paths, slot);
  if (fs.existsSync(file)) fs.rmSync(file);
}
