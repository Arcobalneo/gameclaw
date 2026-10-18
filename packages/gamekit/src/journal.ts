import fs from 'node:fs';
import path from 'node:path';

import type { GamePaths } from './paths';
import type { GameEvent, SaveFile } from './types';

export interface JournalEntry {
  turn: number;
  action: string;
  outcome: string;
  log: string[];
  events: GameEvent[];
}

export function journalFilePath(paths: GamePaths, runId: string): string {
  return path.join(paths.journalsDir, `${runId}.ndjson`);
}

export function appendJournal(paths: GamePaths, save: SaveFile, entry: JournalEntry): void {
  fs.mkdirSync(paths.journalsDir, { recursive: true });
  const payload = { at: new Date().toISOString(), ...entry };
  fs.appendFileSync(journalFilePath(paths, save.runId), `${JSON.stringify(payload)}\n`, 'utf8');
}
