import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type CliIo, runCli } from '@gameclaw/gamekit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { definition } from '../src/definition.js';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'roguelike-cli-'));
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

describe('roguelike CLI', () => {
  it('starts a run and exposes the lineage phase', async () => {
    const output = io();
    expect(await run(['new', '--seed', '7', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.ok).toBe(true);
    expect(payload.phase).toBe('lineage');
    expect((payload.actions as { id: string }[]).map((action) => action.id)).toContain(
      'lineage:oracle',
    );
  });

  it('advances one turn per act and returns the next actions', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'lineage:gambler', '--json'], output)).toBe(0);
    const payload = json(output);
    expect(payload.turn).toBe(1);
    expect(payload.phase).toBe('encounter');
    expect(payload.next).toMatch(/^act enc:/);
    expect((payload.actions as { id: string }[]).length).toBe(4);
  });

  it('rejects illegal actions with exit code 4', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['act', 'enc:9', '--json'], output)).toBe(4);
    const payload = json(output) as { ok: boolean; error: { code: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('ILLEGAL_ACTION');
  });

  it('produces a markdown recap', async () => {
    const output = io();
    await run(['new', '--seed', '7', '--json'], output);
    await run(['act', 'lineage:crusher', '--json'], output);
    output.stdout.length = 0;
    expect(await run(['recap', '--format', 'markdown'], output)).toBe(0);
    expect(output.stdout.join('\n')).toContain('# 横着活');
  });
});
