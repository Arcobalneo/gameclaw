import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type CliIo, runCli } from '@gameclaw/gamekit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { definition } from '../src/definition';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'heist-cli-'));
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

function run(args: string[], output: CliIo): Promise<number> {
  return runCli(definition, {
    argv: [...args, '--state-dir', root, '--no-observer', '--no-report'],
    io: output,
  });
}

function json(output: { stdout: string[] }): Record<string, unknown> {
  return JSON.parse(output.stdout.join('')) as Record<string, unknown>;
}

const WIN_ROUTE = [
  'choose:runner',
  'move:e',
  'move:e',
  'move:e',
  'interact:objective',
  'gear',
  'move:e',
  'move:w',
  'move:w',
  'gear',
  'move:w',
  'move:w',
  'interact:extract',
];

describe('heist CLI', () => {
  it('starts a run and exposes the setup phase as JSON', async () => {
    const output = io();
    expect(await run(['new', '--seed', '7', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.ok).toBe(true);
    expect(payload.phase).toBe('setup');
    expect(payload.turn).toBe(0);
    expect((payload.actions as { id: string }[]).map((action) => action.id)).toEqual([
      'choose:shade',
      'choose:breaker',
      'choose:runner',
      'abort',
    ]);
  });

  it('advances one turn per act and returns the next actions', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'choose:shade', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.turn).toBe(1);
    expect(payload.phase).toBe('infiltrate');
    expect(payload.next).toMatch(/^act move:/);
    expect((payload.actions as { id: string }[]).map((action) => action.id)).toContain('move:e');
  });

  it('rejects illegal actions with exit code 4', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'move:n', '--json'], output)).toBe(4);
    const payload = json(output) as { ok: boolean; error: { code: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('ILLEGAL_ACTION');
  });

  it('plays a deterministic winning route through the CLI', async () => {
    const output = io();
    expect(await run(['new', '--seed', '7', '--json'], output)).toBe(0);
    let payload: Record<string, unknown> = {};
    for (const action of WIN_ROUTE) {
      output.stdout.length = 0;
      expect(await run(['act', action, '--json'], output)).toBe(0);
      payload = json(output);
    }
    expect(payload.outcome).toBe('won');
    expect(payload.turn).toBe(WIN_ROUTE.length);
    expect((payload.status as { headline: string }).headline).toContain('带货撤离');
    expect(payload.next).toBeNull();
  });

  it('writes a readable markdown recap', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    await run(['act', 'choose:shade', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['recap', '--format', 'markdown'], output)).toBe(0);
    const text = output.stdout.join('\n');
    expect(text).toContain('# 横着潜');
    expect(text).toContain('Memory prompt');
  });

  it('settles an abort without pretending it was a win or a loss', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'abort', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.outcome).toBe('aborted');
    expect((payload.actions as unknown[]).length).toBe(0);
  });
});
