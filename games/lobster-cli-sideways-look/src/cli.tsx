#!/usr/bin/env node
import { parseArgs } from 'node:util';
import process from 'node:process';
import fs from 'node:fs/promises';
import { CASES, getCaseConfig } from './content.js';
import { applyAction, createState, getSnapshot } from './engine.js';
import { runObserverDaemon } from './observerDaemon.js';
import { ensureObserver, stopObserver } from './observer.js';
import { renderAsciiBlock, renderSnapshot } from './render.js';
import { writeReports } from './report.js';
import { appendJournal, ensureRoot, getLastSlot, listSaves, loadState, saveState, stateExists } from './storage.js';

const VERSION = '0.1.0';

function printHelp() {
  console.log(`lobster-cli-sideways-look v${VERSION}\n\nA single-step CLI visual horror for coding agents.\n\nCommands:\n  --help\n  --version\n  saves\n  new --slot <0|1|2> [--seed <n>] [--case <id>]\n  load --slot <0|1|2>\n  status --slot <0|1|2>\n  actions --slot <0|1|2>\n  act --slot <0|1|2> <action-id>\n  recap --slot <0|1|2> [--format text|html|md]\n  ascii --slot <0|1|2> [--latest]\n\nCases:\n${CASES.map((item) => `  - ${item.id} :: ${item.chineseName}`).join('\n')}\n\nDesign contract:\n  - every mutating command autosaves\n  - every action is one command\n  - status/actions never enter an interactive loop\n  - saves live under ~/.gameclaw/sideways-look\n`);
}

function parseSlot(values: Record<string, string | boolean | undefined>): number {
  const raw = values.slot;
  if (typeof raw !== 'string') throw new Error('Missing required flag --slot <0|1|2>');
  const slot = Number(raw);
  if (![0, 1, 2].includes(slot)) throw new Error('Slot must be 0, 1, or 2');
  return slot;
}

async function ensureObserverAndAnnotate(state: any) {
  const observer = await ensureObserver(state);
  state.observer = { port: observer.port, pid: observer.pid };
  if (observer.port) {
    console.log(`OBSERVER: http://127.0.0.1:${observer.port}`);
  }
}

async function printSnapshotForState(state: any) {
  const snapshot = getSnapshot(state);
  console.log(await renderSnapshot({ state, ...snapshot }));
}

async function maybeFinalize(state: any) {
  if (state.outcome !== 'ongoing') {
    stopObserver();
    const reports = await writeReports(state);
    console.log(`REPORT: ${reports.textPath}`);
    console.log(`REPORT_HTML: ${reports.htmlPath}`);
  }
}

async function main() {
  ensureRoot();
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (!command || command === '--help' || command === 'help') {
    printHelp();
    return;
  }
  if (command === '--version' || command === 'version') {
    console.log(VERSION);
    return;
  }
  if (command === 'observer-daemon') {
    const parsed = parseArgs({ args: argv.slice(1), options: { port: { type: 'string' } }, allowPositionals: true });
    runObserverDaemon(Number(parsed.values.port ?? '8000'));
    return;
  }
  if (command === 'saves') {
    const last = getLastSlot();
    for (const summary of listSaves()) {
      console.log(summary.exists ? `slot=${summary.slot} case=${summary.caseName} turn=${summary.turn} outcome=${summary.outcome} dread=${summary.dread} evidence=${summary.evidence}${last === summary.slot ? ' last=true' : ''}` : `slot=${summary.slot} empty${last === summary.slot ? ' last=true' : ''}`);
    }
    return;
  }
  if (command === 'new') {
    const parsed = parseArgs({ args: argv.slice(1), options: { slot: { type: 'string' }, seed: { type: 'string' }, case: { type: 'string' } }, allowPositionals: true });
    const slot = parseSlot(parsed.values);
    const caseId = typeof parsed.values.case === 'string' ? parsed.values.case : CASES[0]!.id;
    getCaseConfig(caseId);
    const seed = typeof parsed.values.seed === 'string' ? Number(parsed.values.seed) : Date.now() % 1000000;
    const state = createState(slot, caseId, seed);
    await ensureObserverAndAnnotate(state);
    await saveState(state);
    await printSnapshotForState(state);
    return;
  }
  if (['load', 'status', 'actions', 'recap', 'ascii', 'act'].includes(command)) {
    const parsed = parseArgs({
      args: argv.slice(1),
      options: { slot: { type: 'string' }, format: { type: 'string' }, latest: { type: 'boolean' } },
      allowPositionals: true
    });
    const slot = parseSlot(parsed.values);
    if (!stateExists(slot)) throw new Error(`No save found in slot ${slot}. Run new first.`);
    const state = loadState(slot);
    if (command === 'load' || command === 'status') {
      await ensureObserverAndAnnotate(state);
      await saveState(state);
      await printSnapshotForState(state);
      return;
    }
    if (command === 'actions') {
      const snapshot = getSnapshot(state);
      console.log(snapshot.actions.map((action) => `${action.id} :: ${action.label} [${action.risk}]`).join('\n'));
      return;
    }
    if (command === 'recap') {
      const reports = await writeReports(state);
      const format = (parsed.values.format as string | undefined) ?? 'text';
      if (format === 'html') {
        console.log(reports.htmlPath);
      } else {
        console.log(await fs.readFile(reports.textPath, 'utf8'));
      }
      return;
    }
    if (command === 'ascii') {
      console.log(await renderAsciiBlock(state.latestWitness ?? 'Latest witness', state.latestAscii));
      return;
    }
    if (command === 'act') {
      const actionId = parsed.positionals[0];
      if (!actionId) throw new Error('Usage: act --slot <n> <action-id>');
      await ensureObserverAndAnnotate(state);
      applyAction(state, actionId);
      await appendJournal(state, state.history[state.history.length - 1]!);
      await saveState(state);
      await printSnapshotForState(state);
      await maybeFinalize(state);
      return;
    }
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
