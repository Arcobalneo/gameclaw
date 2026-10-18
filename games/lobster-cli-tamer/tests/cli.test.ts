import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type CliIo, runCli } from '@gameclaw/gamekit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { definition } from '../src/definition.js';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tamer-cli-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function io(): CliIo & { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    out: (text) => stdout.push(text),
    err: (text) => stderr.push(text),
    isTTY: false,
    readLine: async () => null,
  };
}

function run(args: string[], output: CliIo) {
  return runCli(definition, {
    argv: [...args, '--state-dir', root, '--no-observer', '--no-report'],
    io: output,
  });
}

function json(output: { stdout: string[] }): Record<string, unknown> {
  return JSON.parse(output.stdout.join('')) as Record<string, unknown>;
}

interface Envelope {
  ok: boolean;
  phase: string | null;
  outcome: string;
  turn: number;
  next: string | null;
  actions: { id: string; label: string }[];
  status: { headline: string; metrics: { label: string; value: string | number }[] };
  log: string[];
  error?: { code: string; message: string };
}

describe('tamer CLI', () => {
  it('starts a run in the menu phase with JSON actions', async () => {
    const output = io();
    expect(await run(['new', '--seed', '7', '--json'], output)).toBe(0);
    const payload = json(output) as unknown as Envelope;
    expect(payload.ok).toBe(true);
    expect(payload.phase).toBe('menu');
    expect(payload.outcome).toBe('ongoing');
    expect(payload.status.headline).toContain('营地');
    expect(payload.actions.map((action) => action.id)).toContain('menu:explore');
    expect(payload.actions.map((action) => action.id)).toContain('menu:abyss');
    expect(payload.actions.map((action) => action.id)).toContain('abort');
    expect(payload.next).toBe('act menu:explore');
  });

  it('advances one turn per act through encounter and battle', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'menu:battle', '--json'], output)).toBe(0);
    let payload = json(output) as unknown as Envelope;
    expect(payload.turn).toBe(1);
    expect(payload.phase).toBe('encounter');
    expect(payload.next).toMatch(/^act encounter:/);

    output.stdout.length = 0;
    expect(await run(['act', 'encounter:fight', '--json'], output)).toBe(0);
    payload = json(output) as unknown as Envelope;
    expect(payload.phase).toBe('battle');
    expect(payload.actions.map((action) => action.id)).toContain('move:0');
    expect(payload.actions.map((action) => action.id)).toContain('run');

    output.stdout.length = 0;
    expect(await run(['act', 'move:0', '--json'], output)).toBe(0);
    payload = json(output) as unknown as Envelope;
    expect(payload.turn).toBe(3);
    expect(payload.log.length).toBeGreaterThan(0);
  });

  it('walks through zone and sub-area selection deterministically', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    await run(['act', 'menu:explore', '--json'], output);
    expect((json(output) as unknown as Envelope).phase).toBe('zone');

    output.stdout.length = 0;
    await run(['act', 'zone:reef_zone', '--json'], output);
    expect((json(output) as unknown as Envelope).phase).toBe('subarea');

    output.stdout.length = 0;
    await run(['act', 'choice:sub:reef_surface', '--json'], output);
    expect((json(output) as unknown as Envelope).phase).toBe('explore');
  });

  it('rejects illegal actions with exit code 4', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'move:0', '--json'], output)).toBe(4);
    const payload = json(output) as unknown as Envelope;
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe('ILLEGAL_ACTION');
    expect(output.stderr).toHaveLength(0);
  });

  it('aborts cleanly and settles the run', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'abort', '--json'], output)).toBe(0);
    const payload = json(output) as unknown as Envelope;
    expect(payload.outcome).toBe('aborted');
    expect(payload.next).toBeNull();
    expect(payload.actions).toHaveLength(0);
  });

  it('prints the text anchors for humans', async () => {
    const output = io();
    await run(['new', '--seed', '7'], output);
    expect(output.stdout.join('\n')).toContain('GAME   lobster-cli-tamer v2.0.0');
    expect(output.stdout.join('\n')).toContain('STATE');
    expect(output.stdout.join('\n')).toContain('STAT');
    expect(output.stdout.join('\n')).toContain('NEXT');
  });

  it('produces a markdown recap', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    await run(['act', 'abort', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['recap', '--format', 'markdown'], output)).toBe(0);
    const text = output.stdout.join('\n');
    expect(text).toContain('# 横着抓');
    expect(text.length).toBeGreaterThan(40);
  });
});
