import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { GameState, JournalEntry, SaveSummary } from './model.js';

export function getSaveRoot(): string {
  return path.join(os.homedir(), '.gameclaw', 'sideways-look');
}

export function ensureRoot(): void {
  for (const dir of ['saves', 'journals', 'reports', 'observer']) {
    fs.mkdirSync(path.join(getSaveRoot(), dir), { recursive: true });
  }
}

export function slotPath(slot: number): string {
  return path.join(getSaveRoot(), 'saves', `slot-${slot}.json`);
}

export async function saveState(state: GameState): Promise<void> {
  ensureRoot();
  await fsp.writeFile(slotPath(state.slot), JSON.stringify(state, null, 2), 'utf8');
  await fsp.writeFile(path.join(getSaveRoot(), 'last_slot'), String(state.slot), 'utf8');
  await updateObserverState(state);
}

export function loadState(slot: number): GameState {
  ensureRoot();
  return JSON.parse(fs.readFileSync(slotPath(slot), 'utf8')) as GameState;
}

export function stateExists(slot: number): boolean {
  return fs.existsSync(slotPath(slot));
}

export async function appendJournal(state: GameState, entry: JournalEntry): Promise<void> {
  ensureRoot();
  const line = JSON.stringify(entry) + '\n';
  await fsp.appendFile(path.join(getSaveRoot(), 'journals', `run-${state.runId}.ndjson`), line, 'utf8');
}

export async function updateObserverState(state: GameState): Promise<void> {
  ensureRoot();
  const payload = {
    runId: state.runId,
    slot: state.slot,
    caseId: state.caseId,
    caseName: state.caseName,
    turn: state.turn,
    roomId: state.roomId,
    focus: state.focus,
    nerve: state.nerve,
    dread: state.dread,
    evidence: state.evidence,
    outcome: state.outcome,
    latestResult: state.latestResult,
    latestWitness: state.latestWitness,
    latestAscii: state.latestAscii,
    history: state.history.slice(-8)
  };
  await fsp.writeFile(path.join(getSaveRoot(), 'observer', 'latest-state.json'), JSON.stringify(payload, null, 2), 'utf8');
}

export function getLastSlot(): number | undefined {
  try {
    return Number(fs.readFileSync(path.join(getSaveRoot(), 'last_slot'), 'utf8').trim());
  } catch {
    return undefined;
  }
}

export function listSaves(): SaveSummary[] {
  ensureRoot();
  return [0, 1, 2].map((slot) => {
    if (!stateExists(slot)) {
      return { slot, exists: false };
    }
    const state = loadState(slot);
    return {
      slot,
      exists: true,
      caseName: state.caseName,
      turn: state.turn,
      outcome: state.outcome,
      dread: state.dread,
      evidence: state.evidence
    };
  });
}
